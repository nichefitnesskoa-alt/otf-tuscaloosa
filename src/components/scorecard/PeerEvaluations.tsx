import { useMemo, useState } from 'react';
import { format, subMonths } from 'date-fns';
import { formatScorecardDate } from '@/lib/dateUtils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users } from 'lucide-react';
import { useScorecards } from '@/hooks/useScorecards';
import { ComparisonView } from './ComparisonView';

/**
 * Peer Evaluations — formal evaluations this coach has received
 * from anyone (other coaches OR admin) in the last quarter (90 days).
 *
 * Two-way visibility: coaches see who's evaluating them; Koa sees
 * coach-on-coach activity. Self-evals are excluded — this is about
 * what others observed.
 */
export function PeerEvaluations({ coachName }: { coachName: string }) {
  const from = format(subMonths(new Date(), 3), 'yyyy-MM-dd');
  const to = format(new Date(), 'yyyy-MM-dd');
  const { data: cards = [], isLoading } = useScorecards({ from, to, evaluatee: coachName });
  const [openId, setOpenId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const peer = cards.filter(
      c => !!c.submitted_at && c.eval_type === 'formal_eval' && c.evaluator_name !== coachName,
    );
    const map = new Map<string, typeof peer>();
    for (const c of peer) {
      const list = map.get(c.evaluator_name) || [];
      list.push(c);
      map.set(c.evaluator_name, list);
    }
    // Sort each list by class_date desc
    for (const list of map.values()) {
      list.sort((a, b) => (b.class_date > a.class_date ? 1 : -1));
    }
    // Sort evaluators by most-recent eval desc
    return [...map.entries()].sort((a, b) => {
      const aMax = a[1][0]?.class_date || '';
      const bMax = b[1][0]?.class_date || '';
      return bMax > aMax ? 1 : -1;
    });
  }, [cards, coachName]);

  const totalCount = grouped.reduce((s, [, list]) => s + list.length, 0);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Peer evaluations received
        </h3>
        <Badge variant="outline" className="text-[10px]">
          last 90 days · {totalCount}
        </Badge>
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : grouped.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No peer evaluations yet this quarter. Coach evaluations are open to every coach —
          encourage your teammates to start scoring each other.
        </p>
      ) : (
        <div className="space-y-3">
          {grouped.map(([evaluator, list]) => (
            <div key={evaluator}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
                {evaluator} <span className="text-muted-foreground/70 font-normal normal-case">· {list.length}</span>
              </p>
              <div className="space-y-1.5">
                {list.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setOpenId(s.id)}
                    className="w-full flex items-center justify-between p-2.5 rounded-md border hover:bg-muted text-left min-h-[44px] cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.practice_name || 'First-timer'}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(new Date(s.class_date + 'T12:00:00'), 'MMM d')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-base font-black tabular-nums ${s.level === 3 ? 'text-primary' : s.level === 2 ? 'text-success' : 'text-muted-foreground'}`}>
                        L{s.level}
                      </span>
                      <p className="text-[10px] text-muted-foreground">{s.total_score}/30</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ComparisonView scorecardId={openId} open={!!openId} onOpenChange={(o) => { if (!o) setOpenId(null); }} />
    </Card>
  );
}
