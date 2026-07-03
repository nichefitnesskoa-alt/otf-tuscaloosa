import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notifyDataChanged } from '@/lib/data/invalidation';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { BookIntroDialog } from '@/components/leads/BookIntroDialog';
import { Plus, LayoutGrid, List, Sparkles, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { LeadMetricsBar } from '@/components/leads/LeadMetricsBar';
import { FollowUpQueue } from '@/components/leads/FollowUpQueue';
import { LeadKanbanBoard } from '@/components/leads/LeadKanbanBoard';
import { LeadListView } from '@/components/leads/LeadListView';
import { LeadDetailSheet } from '@/components/leads/LeadDetailSheet';
import { SelfSourcedLeadDialog } from '@/components/leads/SelfSourcedLeadDialog';
import { MarkLostDialog } from '@/components/leads/MarkLostDialog';
import { toast } from 'sonner';
import { OTF, brandFont } from '@/lib/otfBrand';


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
  const [search, setSearch] = useState('');

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
    let arr = [...leads];
    const q = search.trim().toLowerCase();
    if (q) {
      const digits = q.replace(/\D/g, '');
      arr = arr.filter(l => {
        const name = `${l.first_name ?? ''} ${l.last_name ?? ''}`.toLowerCase();
        const phoneDigits = (l.phone ?? '').replace(/\D/g, '');
        if (name.includes(q)) return true;
        if (digits && phoneDigits.includes(digits)) return true;
        return false;
      });
    }
    switch (sortBy) {
      case 'oldest': arr.sort((a, b) => a.created_at.localeCompare(b.created_at)); break;
      case 'alpha_az': arr.sort((a, b) => a.last_name.localeCompare(b.last_name)); break;
      case 'alpha_za': arr.sort((a, b) => b.last_name.localeCompare(a.last_name)); break;
      default: arr.sort((a, b) => b.created_at.localeCompare(a.created_at)); break;
    }
    return arr;
  }, [leads, sortBy, search]);

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
          
          // Canon-side sale check (mirror of SALE_CANONS in @/lib/sales-detection).
          const { data: saleRun } = await supabase
            .from('intros_run')
            .select('id')
            .ilike('member_name', fullName)
            .in('result_canon', ['SALE', 'PREMIER', 'PREMIER_OTBEAT', 'ELITE', 'BASIC'])
            .limit(1)
            .maybeSingle();

          if (isBought || saleRun) {
            // Soft-archive: flip stage to 'already_in_system' instead of hard-deleting.
            // Preserves lead history + lead_activities trail for reporting/audit.
            // Active lead queries filter on stage so the lead drops off the queue.
            await supabase.from('leads').update({
              stage: 'already_in_system',
              lost_reason: 'Duplicate of purchased member — auto-cleaned',
            }).eq('id', lead.id);
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
        notifyDataChanged(['leads', 'intros_booked'], 'duplicate-cleaner');
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
    <div
      className="p-4 pb-8 space-y-4"
      style={{ backgroundColor: OTF.dark, color: OTF.bone, minHeight: '100%', ...brandFont }}
    >
      {/* OTF brand page header */}
      <div
        className="pt-2 pb-4"
        style={{ borderBottom: `1px solid ${OTF.bone}22` }}
      >
        <p
          className="text-[10px] uppercase mb-1"
          style={{ color: OTF.bone, opacity: 0.55, letterSpacing: '0.18em' }}
        >
          Lead tracking
        </p>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <h1
            className="text-3xl leading-none"
            style={{ color: OTF.bone, fontWeight: 800, ...brandFont }}
          >
            Leads<span style={{ color: OTF.orange }}>.</span>
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('kanban')}
              className="h-9 w-9 flex items-center justify-center transition-opacity"
              style={{
                backgroundColor: view === 'kanban' ? OTF.bone : 'transparent',
                color: view === 'kanban' ? OTF.dark : OTF.bone,
                border: `1px solid ${OTF.bone}55`,
              }}
              aria-label="Kanban view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className="h-9 w-9 flex items-center justify-center transition-opacity"
              style={{
                backgroundColor: view === 'list' ? OTF.bone : 'transparent',
                color: view === 'list' ? OTF.dark : OTF.bone,
                border: `1px solid ${OTF.bone}55`,
              }}
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={handleCleanDuplicates}
              disabled={cleaning}
              className="h-9 px-3 text-xs inline-flex items-center gap-1.5 transition-opacity disabled:opacity-50"
              style={{
                color: OTF.bone,
                border: `1px solid ${OTF.bone}55`,
                fontWeight: 600,
                ...brandFont,
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {cleaning ? 'Cleaning…' : 'Clean dupes'}
            </button>
            <button
              onClick={() => setShowAddDialog(true)}
              className="h-9 px-3 text-xs inline-flex items-center gap-1.5 transition-opacity hover:opacity-90"
              style={{
                backgroundColor: OTF.orange,
                color: OTF.dark,
                fontWeight: 700,
                ...brandFont,
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add lead
            </button>
          </div>
        </div>
        <p className="text-xs mt-2" style={{ color: OTF.bone, opacity: 0.65 }}>
          {sortedLeads.length} lead{sortedLeads.length === 1 ? '' : 's'} · speed to contact wins.
        </p>
      </div>


      {/* Sort + search controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Sort:</span>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="most_recent">Most Recent</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="alpha_az">A → Z</SelectItem>
            <SelectItem value="alpha_za">Z → A</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search leads by name or phone…"
            className="h-8 pl-8 pr-8 text-xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {search && (
          <span className="text-xs text-muted-foreground">
            {sortedLeads.length} match{sortedLeads.length === 1 ? '' : 'es'}
          </span>
        )}
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
          onMarkLost={(leadId) => setLostDialogLeadId(leadId)}
        />
      ) : (
        <LeadListView
          leads={sortedLeads}
          activities={activities}
          onLeadClick={handleLeadClick}
          onStageChange={handleStageChange}
          onBookIntro={(lead) => setBookIntroLead(lead)}
          onMarkAlreadyBooked={handleMarkAlreadyBooked}
          onMarkLost={(leadId) => setLostDialogLeadId(leadId)}
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

      <SelfSourcedLeadDialog open={showAddDialog} onOpenChange={setShowAddDialog} onLeadAdded={refresh} />

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
