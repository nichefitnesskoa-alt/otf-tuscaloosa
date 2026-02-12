import { Tables } from '@/integrations/supabase/types';
import { LeadCard } from './LeadCard';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface LeadKanbanBoardProps {
  leads: Tables<'leads'>[];
  activities: Tables<'lead_activities'>[];
  onLeadClick: (lead: Tables<'leads'>) => void;
  onStageChange: (leadId: string, newStage: string) => void;
  onBookIntro?: (lead: Tables<'leads'>) => void;
  onMarkAlreadyBooked?: (leadId: string) => void;
}

const COLUMNS = [
  { stage: 'new', label: 'New', color: 'bg-info/10 border-info/30' },
  { stage: 'contacted', label: 'Contacted', color: 'bg-warning/10 border-warning/30' },
  { stage: 'won', label: 'Purchased', color: 'bg-amber-500/10 border-amber-500/30' },
  { stage: 'lost', label: 'Do Not Contact', color: 'bg-muted border-muted-foreground/20' },
];

export function LeadKanbanBoard({ leads, activities, onLeadClick, onStageChange, onBookIntro, onMarkAlreadyBooked }: LeadKanbanBoardProps) {
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const getActivityCount = (leadId: string) =>
    activities.filter(a => a.lead_id === leadId && ['call', 'text'].includes(a.activity_type)).length;

  const activeLeads = leads.filter(l => !l.booked_intro_id);

  return (
    <div className="grid grid-cols-4 gap-2 min-h-[300px]">
      {COLUMNS.map(col => {
        const columnLeads = activeLeads.filter(l => l.stage === col.stage);
        return (
          <div
            key={col.stage}
            className={cn(
              'rounded-lg border p-2 transition-colors',
              col.color,
              dragOverStage === col.stage && 'ring-2 ring-primary'
            )}
            onDragOver={e => {
              e.preventDefault();
              setDragOverStage(col.stage);
            }}
            onDragLeave={() => setDragOverStage(null)}
            onDrop={e => {
              e.preventDefault();
              setDragOverStage(null);
              const leadId = e.dataTransfer.getData('text/plain');
              if (leadId) onStageChange(leadId, col.stage);
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {col.label}
              </h3>
              <span className="text-xs font-medium text-muted-foreground bg-background/80 rounded-full px-1.5">
                {columnLeads.length}
              </span>
            </div>
            <div className="space-y-2">
              {columnLeads.map(lead => {
                const leadActs = activities.filter(a => a.lead_id === lead.id);
                const lastAct = leadActs.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
                return (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  activityCount={getActivityCount(lead.id)}
                  lastActivityDate={lastAct?.created_at || null}
                  onClick={() => onLeadClick(lead)}
                  onDragStart={e => e.dataTransfer.setData('text/plain', lead.id)}
                  onBookIntro={onBookIntro ? () => onBookIntro(lead) : undefined}
                  onMarkContacted={lead.stage === 'new' ? () => onStageChange(lead.id, 'contacted') : undefined}
                  onMarkAlreadyBooked={onMarkAlreadyBooked ? () => onMarkAlreadyBooked(lead.id) : undefined}
                />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
