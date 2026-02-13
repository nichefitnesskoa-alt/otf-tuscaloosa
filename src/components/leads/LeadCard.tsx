import { Tables } from '@/integrations/supabase/types';
import { formatDistanceToNow, parseISO, isBefore, differenceInMinutes, differenceInDays } from 'date-fns';
import { AlertCircle, Flame } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LeadSourceTag } from '@/components/dashboard/IntroTypeBadge';
import { LeadActionBar } from '@/components/ActionBar';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LeadCardProps {
  lead: Tables<'leads'>;
  activityCount: number;
  lastActivityDate?: string | null;
  onClick: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onBookIntro?: () => void;
  onMarkContacted?: () => void;
  onMarkAlreadyBooked?: () => void;
}

export function LeadCard({ lead, activityCount, lastActivityDate, onClick, onDragStart, onBookIntro, onMarkContacted, onMarkAlreadyBooked }: LeadCardProps) {
  const now = new Date();
  const createdAt = parseISO(lead.created_at);
  const isNew = differenceInMinutes(now, createdAt) < 60;
  const isOverdue = lead.follow_up_at && isBefore(parseISO(lead.follow_up_at), now) && lead.stage !== 'lost';
  const isLost = lead.stage === 'lost';

  // Stale detection
  const lastDate = lastActivityDate ? parseISO(lastActivityDate) : createdAt;
  const daysSinceAny = differenceInDays(now, lastDate);
  const isStale = (lead.stage === 'new' || lead.stage === 'contacted') && daysSinceAny >= 7 && daysSinceAny < 14;
  const isGoingCold = (lead.stage === 'new' || lead.stage === 'contacted') && daysSinceAny >= 14;

  // 6C: Hot lead detection from questionnaire
  const [isHot, setIsHot] = useState(false);
  useEffect(() => {
    const fn = async () => {
      const { data: q } = await supabase
        .from('intro_questionnaires')
        .select('q2_fitness_level, q6_weekly_commitment, q5_emotional_driver' as any)
        .ilike('client_first_name', lead.first_name)
        .ilike('client_last_name', lead.last_name)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!q) return;
      const qd = q as any;
      const highFitness = (qd.q2_fitness_level || 0) >= 4;
      const highCommit = (qd.q6_weekly_commitment || '').match(/[4-7]/);
      const strongWhy = (qd.q5_emotional_driver || '').length > 30;
      if ((highFitness && highCommit) || (highFitness && strongWhy) || (highCommit && strongWhy)) {
        setIsHot(true);
      }
    };
    fn();
  }, [lead.first_name, lead.last_name]);

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
            {isGoingCold && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Going Cold</Badge>
            )}
            {isStale && !isGoingCold && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-warning text-warning">Stale</Badge>
            )}
            <LeadSourceTag source={lead.source} />
            {isHot && (
              <Badge className="text-[10px] px-1.5 py-0 h-4 bg-orange-500 text-white border-transparent gap-0.5">
                <Flame className="w-2.5 h-2.5" />
                Hot
              </Badge>
            )}
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
        onMarkAlreadyBooked={onMarkAlreadyBooked}
      />
    </div>
  );
}
