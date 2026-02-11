import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Plus, LayoutGrid, List } from 'lucide-react';
import { LeadMetricsBar } from '@/components/leads/LeadMetricsBar';
import { LeadKanbanBoard } from '@/components/leads/LeadKanbanBoard';
import { LeadListView } from '@/components/leads/LeadListView';
import { LeadDetailSheet } from '@/components/leads/LeadDetailSheet';
import { AddLeadDialog } from '@/components/leads/AddLeadDialog';
import { MarkLostDialog } from '@/components/leads/MarkLostDialog';
import { toast } from 'sonner';

export default function Leads() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [selectedLead, setSelectedLead] = useState<Tables<'leads'> | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [lostDialogLeadId, setLostDialogLeadId] = useState<string | null>(null);

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

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    queryClient.invalidateQueries({ queryKey: ['lead_activities'] });
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
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Lead
          </Button>
        </div>
      </div>

      <LeadMetricsBar leads={leads} activities={activities} />

      {view === 'kanban' ? (
        <LeadKanbanBoard
          leads={leads}
          activities={activities}
          onLeadClick={handleLeadClick}
          onStageChange={handleStageChange}
        />
      ) : (
        <LeadListView
          leads={leads}
          activities={activities}
          onLeadClick={handleLeadClick}
          onStageChange={handleStageChange}
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
