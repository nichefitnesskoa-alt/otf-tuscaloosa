import { Tables } from '@/integrations/supabase/types';
import { formatDistanceToNow, parseISO, isBefore, differenceInMinutes } from 'date-fns';
import { AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LeadSourceTag } from '@/components/dashboard/IntroTypeBadge';
import { LeadActionBar } from '@/components/ActionBar';

interface LeadCardProps {
  lead: Tables<'leads'>;
  activityCount: number;
  onClick: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onBookIntro?: () => void;
  onMarkContacted?: () => void;
}

export function LeadCard({ lead, activityCount, onClick, onDragStart, onBookIntro, onMarkContacted }: LeadCardProps) {
  const now = new Date();
  const createdAt = parseISO(lead.created_at);
  const isNew = differenceInMinutes(now, createdAt) < 60;
  const isOverdue = lead.follow_up_at && isBefore(parseISO(lead.follow_up_at), now) && lead.stage !== 'lost';
  const isLost = lead.stage === 'lost';

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={cn(
        'rounded-lg border p-3 transition-all bg-card select-none space-y-2',
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
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {formatDistanceToNow(createdAt, { addSuffix: true })}
            {lead.booked_intro_id && lead.stage === 'booked' && (
              <Badge className="ml-1.5 text-[10px] px-1.5 py-0 h-4 bg-emerald-600 text-white border-transparent">
                Already Booked
              </Badge>
            )}
            {lead.stage === 'won' && (
              <Badge className="ml-1.5 text-[10px] px-1.5 py-0 h-4 bg-amber-500 text-white border-transparent">
                Purchased
              </Badge>
            )}
          </p>
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
        </div>
      </div>

      {/* Inline action bar */}
      <LeadActionBar
        leadId={lead.id}
        firstName={lead.first_name}
        lastName={lead.last_name}
        phone={lead.phone}
        source={lead.source}
        stage={lead.stage}
        onOpenDetail={onClick}
        onBookIntro={onBookIntro || onClick}
        onMarkContacted={onMarkContacted}
      />
    </div>
  );
}
