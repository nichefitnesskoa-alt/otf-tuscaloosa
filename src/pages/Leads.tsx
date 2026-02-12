import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { BookIntroDialog } from '@/components/leads/BookIntroDialog';
import { Plus, LayoutGrid, List, Sparkles } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { LeadMetricsBar } from '@/components/leads/LeadMetricsBar';
import { FollowUpQueue } from '@/components/leads/FollowUpQueue';
import { LeadKanbanBoard } from '@/components/leads/LeadKanbanBoard';
import { LeadListView } from '@/components/leads/LeadListView';
import { LeadDetailSheet } from '@/components/leads/LeadDetailSheet';
import { AddLeadDialog } from '@/components/leads/AddLeadDialog';
import { MarkLostDialog } from '@/components/leads/MarkLostDialog';
import { toast } from 'sonner';

export default function Leads() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'kanban' | 'list'>('list');
  const [cleaning, setCleaning] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Tables<'leads'> | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [lostDialogLeadId, setLostDialogLeadId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>('most_recent');
  const [bookIntroLead, setBookIntroLead] = useState<Tables<'leads'> | null>(null);

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['lead_activities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_activities')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const sortedLeads = useMemo(() => {
    const arr = [...leads];
    switch (sortBy) {
      case 'oldest': arr.sort((a, b) => a.created_at.localeCompare(b.created_at)); break;
      case 'alpha_az': arr.sort((a, b) => a.last_name.localeCompare(b.last_name)); break;
      case 'alpha_za': arr.sort((a, b) => b.last_name.localeCompare(a.last_name)); break;
      default: arr.sort((a, b) => b.created_at.localeCompare(a.created_at)); break;
    }
    return arr;
  }, [leads, sortBy]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    queryClient.invalidateQueries({ queryKey: ['lead_activities'] });
  };

  const handleCleanDuplicates = async () => {
    setCleaning(true);
    try {
      const newLeads = leads.filter(l => l.stage === 'new' || l.stage === 'contacted');
      if (newLeads.length === 0) {
        toast.info('No leads to check');
        setCleaning(false);
        return;
      }

      let cleaned = 0;
      for (const lead of newLeads) {
        const fullName = `${lead.first_name} ${lead.last_name}`;
        
        // Check intros_booked for matching name
        const { data: nameMatch } = await supabase
          .from('intros_booked')
          .select('id, booking_status')
          .ilike('member_name', fullName)
          .is('deleted_at', null)
          .limit(1)
          .maybeSingle();

        if (nameMatch) {
          // Check if already purchased (booking closed as bought)
          const isBought = (nameMatch as any).booking_status === 'Closed – Bought';
          
          // Also check intros_run for a sale result
          const { data: saleRun } = await supabase
            .from('intros_run')
            .select('id')
            .ilike('member_name', fullName)
            .or('result.ilike.%premier%,result.ilike.%elite%,result.ilike.%basic%')
            .limit(1)
            .maybeSingle();

          if (isBought || saleRun) {
            // Already purchased → delete the lead entirely
            await supabase.from('lead_activities').delete().eq('lead_id', lead.id);
            await supabase.from('leads').delete().eq('id', lead.id);
          } else {
            // Active booking → set to "booked" stage (not DNC)
            await supabase.from('leads').update({
              stage: 'booked',
              booked_intro_id: nameMatch.id,
            }).eq('id', lead.id);
          }
          cleaned++;
        }
      }

      if (cleaned > 0) {
        toast.success(`${cleaned} duplicate${cleaned > 1 ? 's' : ''} cleaned`);
        refresh();
      } else {
        toast.info('No duplicates found');
      }
    } catch {
      toast.error('Failed to clean duplicates');
    } finally {
      setCleaning(false);
    }
  };

  const handleStageChange = async (leadId: string, newStage: string) => {
    if (newStage === 'lost') {
      setLostDialogLeadId(leadId);
      return;
    }

    try {
      await supabase.from('leads').update({ stage: newStage }).eq('id', leadId);
      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        activity_type: 'stage_change',
        performed_by: user?.name || 'Unknown',
        notes: `Stage changed to ${newStage}`,
      });
      refresh();
    } catch {
      toast.error('Failed to update stage');
    }
  };

  const handleMarkAlreadyBooked = async (leadId: string) => {
    try {
      await supabase.from('leads').update({ stage: 'booked' }).eq('id', leadId);
      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        activity_type: 'stage_change',
        performed_by: user?.name || 'Unknown',
        notes: 'Manually marked as Already Booked',
      });
      toast.success('Lead moved to Booked');
      refresh();
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleLeadClick = (lead: Tables<'leads'>) => {
    // Refresh to get latest data before opening
    setSelectedLead(lead);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Leads Pipeline</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={view === 'kanban' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setView('kanban')}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant={view === 'list' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setView('list')}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={handleCleanDuplicates} disabled={cleaning}>
            <Sparkles className="w-4 h-4 mr-1" /> {cleaning ? 'Cleaning...' : 'Clean Duplicates'}
          </Button>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Lead
          </Button>
        </div>
      </div>

      {/* Sort control */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Sort:</span>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-7 w-[160px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="most_recent">Most Recent</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="alpha_az">A → Z</SelectItem>
            <SelectItem value="alpha_za">Z → A</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <FollowUpQueue />

      <LeadMetricsBar leads={sortedLeads} activities={activities} />

      {view === 'kanban' ? (
        <LeadKanbanBoard
          leads={sortedLeads}
          activities={activities}
          onLeadClick={handleLeadClick}
          onStageChange={handleStageChange}
          onBookIntro={(lead) => setBookIntroLead(lead)}
          onMarkAlreadyBooked={handleMarkAlreadyBooked}
        />
      ) : (
        <LeadListView
          leads={sortedLeads}
          activities={activities}
          onLeadClick={handleLeadClick}
          onStageChange={handleStageChange}
          onBookIntro={(lead) => setBookIntroLead(lead)}
          onMarkAlreadyBooked={handleMarkAlreadyBooked}
        />
      )}

      <LeadDetailSheet
        lead={selectedLead}
        activities={activities}
        open={!!selectedLead}
        onOpenChange={open => { if (!open) setSelectedLead(null); }}
        onRefresh={() => {
          refresh();
          // Re-select the lead with fresh data
          if (selectedLead) {
            const fresh = leads.find(l => l.id === selectedLead.id);
            if (fresh) setSelectedLead(fresh);
          }
        }}
      />

      <AddLeadDialog open={showAddDialog} onOpenChange={setShowAddDialog} onLeadAdded={refresh} />

      {bookIntroLead && (
        <BookIntroDialog
          open={!!bookIntroLead}
          onOpenChange={open => { if (!open) setBookIntroLead(null); }}
          lead={bookIntroLead}
          onDone={() => { setBookIntroLead(null); refresh(); }}
        />
      )}

      {lostDialogLeadId && (
        <MarkLostDialog
          open={!!lostDialogLeadId}
          onOpenChange={open => { if (!open) setLostDialogLeadId(null); }}
          leadId={lostDialogLeadId}
          onDone={() => {
            setLostDialogLeadId(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
