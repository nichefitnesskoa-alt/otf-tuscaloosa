import { format, parseISO } from 'date-fns';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { ScriptSendLogEntry, useScriptSendLog } from '@/hooks/useScriptSendLog';
import { ScriptTemplate, useScriptTemplates } from '@/hooks/useScriptTemplates';

interface SequenceTrackerProps {
  leadId?: string;
  bookingId?: string;
  category: string;
}

export function SequenceTracker({ leadId, bookingId, category }: SequenceTrackerProps) {
  const { data: logs = [] } = useScriptSendLog({ leadId, bookingId });
  const { data: templates = [] } = useScriptTemplates(category);

  const sequenceTemplates = templates
    .filter((t) => t.sequence_order !== null && t.is_active)
    .sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0));

  if (sequenceTemplates.length === 0) return null;

  const sentSteps = new Set(logs.map((l) => l.sequence_step_number));
  const totalSteps = sequenceTemplates.length;
  const completedSteps = sequenceTemplates.filter((t) => sentSteps.has(t.sequence_order)).length;
  const nextStep = sequenceTemplates.find((t) => !sentSteps.has(t.sequence_order));
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">Sequence Progress</p>
        <span className="text-[11px] text-muted-foreground">
          Step {completedSteps} of {totalSteps}
        </span>
      </div>

      <Progress value={progress} className="h-1.5" />

      <div className="space-y-1.5">
        {sequenceTemplates.map((t) => {
          const logEntry = logs.find((l) => l.sequence_step_number === t.sequence_order);
          const isSent = !!logEntry;
          const isNext = nextStep?.id === t.id;

          return (
            <div key={t.id} className="flex items-start gap-2 text-xs">
              {isSent ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
              ) : isNext ? (
                <Clock className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className={isNext ? 'font-semibold text-primary' : isSent ? 'text-muted-foreground' : ''}>
                  {t.name}
                </p>
                {isSent && logEntry && (
                  <p className="text-[11px] text-muted-foreground">
                    Sent {format(parseISO(logEntry.sent_at), 'MMM d')} by {logEntry.sent_by}
                  </p>
                )}
                {isNext && t.timing_note && (
                  <p className="text-[11px] text-primary/70">{t.timing_note}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
