import { useState } from 'react';
import { useScorecards } from '@/hooks/useScorecards';
import { Badge } from '@/components/ui/badge';
import { ComparisonView } from './ComparisonView';
import { format } from 'date-fns';

export function BookingScorecards({ bookingId }: { bookingId: string }) {
  const { data: cards = [] } = useScorecards({ firstTimerId: bookingId });
  const [openId, setOpenId] = useState<string | null>(null);
  if (!cards.length) {
    return (
      <div className="border rounded-md p-3">
        <p className="text-xs font-bold uppercase mb-1">FV Scorecards</p>
        <p className="text-xs text-muted-foreground italic">None yet</p>
      </div>
    );
  }
  return (
    <div className="border rounded-md p-3 space-y-1">
      <p className="text-xs font-bold uppercase mb-1">FV Scorecards</p>
      {cards.map(s => (
        <button
          key={s.id}
          onClick={() => setOpenId(s.id)}
          className="w-full flex items-center justify-between text-left text-xs py-1 hover:bg-muted px-1 rounded"
        >
          <span>
            {s.eval_type === 'self_eval' ? 'Self' : 'Formal'} · {s.evaluator_name} → {s.evaluatee_name}
            {s.submitted_at ? ` · ${format(new Date(s.submitted_at), 'MMM d')}` : ' · draft'}
          </span>
          <Badge variant={s.level === 3 ? 'default' : 'secondary'}>L{s.level} · {s.total_score}/30</Badge>
        </button>
      ))}
      <ComparisonView scorecardId={openId} open={!!openId} onOpenChange={(o) => { if (!o) setOpenId(null); }} />
    </div>
  );
}
