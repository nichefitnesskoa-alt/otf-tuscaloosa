import { MeetingMetrics } from '@/hooks/useMeetingAgenda';
import { MeetingSection } from './MeetingSection';
import { ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  metrics: MeetingMetrics;
  isPresentMode: boolean;
}

export function ObjectionSection({ metrics, isPresentMode }: Props) {
  const { objections, totalNonCloses, topObjection } = metrics;
  const entries = Object.entries(objections).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    return (
      <MeetingSection title="Where We're Getting Stuck" icon={<ShieldAlert className={isPresentMode ? 'w-10 h-10' : 'w-5 h-5'} />} sectionId="objections" isPresentMode={isPresentMode}>
        <p className={isPresentMode ? 'text-xl text-primary-foreground/60' : 'text-sm text-muted-foreground'}>
          No objection data this week. Start logging objections in shift recaps to see what's stopping people from buying.
        </p>
      </MeetingSection>
    );
  }

  return (
    <MeetingSection title="Where We're Getting Stuck" icon={<ShieldAlert className={isPresentMode ? 'w-10 h-10' : 'w-5 h-5'} />} sectionId="objections" isPresentMode={isPresentMode}>
      <p className={isPresentMode ? 'text-lg text-primary-foreground/50 mb-6' : 'text-xs text-muted-foreground mb-3'}>
        From {totalNonCloses} non-closes this week:
      </p>
      <div className={isPresentMode ? 'space-y-4' : 'space-y-2'}>
        {entries.map(([name, count], i) => {
          const pct = totalNonCloses > 0 ? (count / totalNonCloses) * 100 : 0;
          const isTop = i === 0;
          return (
            <div key={name} className={cn(
              isPresentMode ? 'flex items-center gap-4 text-xl' : 'flex items-center gap-2 text-sm',
              isTop && 'font-bold'
            )}>
              <div className={cn(
                'rounded-full',
                isPresentMode ? 'w-3 h-3' : 'w-2 h-2',
                isTop ? 'bg-danger' : 'bg-card/30'
              )} />
              <span className={isPresentMode ? 'text-primary-foreground' : ''}>{name}: {count} ({pct.toFixed(0)}%)</span>
              {isTop && (
                <span className={isPresentMode ? 'text-warning text-base' : 'text-xs text-warning'}>
                  ← Recommended drill
                </span>
              )}
            </div>
          );
        })}
      </div>
    </MeetingSection>
  );
}
