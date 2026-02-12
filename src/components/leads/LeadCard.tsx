import { Tables } from '@/integrations/supabase/types';
import { formatDistanceToNow, parseISO, isBefore, differenceInMinutes } from 'date-fns';
import { Phone, Clock, AlertCircle, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useScriptSendLog } from '@/hooks/useScriptSendLog';
import { LeadSourceTag } from '@/components/dashboard/IntroTypeBadge';

interface LeadCardProps {
  lead: Tables<'leads'>;
  activityCount: number;
  onClick: () => void;
  onDragStart?: (e: React.DragEvent) => void;
}

export function LeadCard({ lead, activityCount, onClick, onDragStart }: LeadCardProps) {
  const { data: sendLogs = [] } = useScriptSendLog({ leadId: lead.id });
  const now = new Date();
  const createdAt = parseISO(lead.created_at);
  const isNew = differenceInMinutes(now, createdAt) < 60;
  const isOverdue = lead.follow_up_at && isBefore(parseISO(lead.follow_up_at), now) && lead.stage !== 'lost';
  const isLost = lead.stage === 'lost';
  const hasSequenceActivity = sendLogs.length > 0;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={cn(
        'rounded-lg border p-3 cursor-pointer transition-all hover:shadow-md bg-card select-none',
        isOverdue && 'border-destructive ring-1 ring-destructive/30',
        isLost && 'opacity-50',
        isNew && !isLost && 'animate-pulse border-primary/50'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-semibold text-sm truncate">
              {lead.first_name} {lead.last_name}
            </p>
            {isNew && !isLost && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-primary">
                NEW
              </Badge>
            )}
            <LeadSourceTag source={lead.source} />
          </div>
          <a
            href={`tel:${lead.phone}`}
            onClick={e => e.stopPropagation()}
            className="text-xs text-muted-foreground flex items-center gap-1 mt-1 hover:text-primary"
          >
            <Phone className="w-3 h-3" />
            {lead.phone}
          </a>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {activityCount > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              {activityCount}
            </Badge>
          )}
          {isOverdue && (
            <AlertCircle className="w-3.5 h-3.5 text-destructive" />
          )}
          {lead.follow_up_at && !isOverdue && lead.stage !== 'lost' && (
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          {hasSequenceActivity && (
            <MessageSquare className="w-3.5 h-3.5 text-primary" />
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-1.5">
        <p className="text-[11px] text-muted-foreground">
          {formatDistanceToNow(createdAt, { addSuffix: true })}
        </p>
        {lead.booked_intro_id && lead.stage === 'booked' && (
          <Badge className="text-[10px] px-1.5 py-0 h-4 bg-emerald-600 text-white border-transparent">
            Already Booked
          </Badge>
        )}
        {lead.stage === 'won' && (
          <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-500 text-white border-transparent">
            Purchased
          </Badge>
        )}
      </div>
    </div>
  );
}
