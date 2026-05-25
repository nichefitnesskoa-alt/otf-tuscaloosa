import { useState } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ClipboardCheck } from 'lucide-react';
import { ScorecardForm } from './ScorecardForm';
import { useAuth } from '@/context/AuthContext';
import { canScore, canFormalEval } from '@/lib/auth/roles';
import type { UnscoredIntro } from '@/hooks/useFvTrendData';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  coach: string;
  intros: UnscoredIntro[];
}

export function UnscoredDrillDown({ open, onOpenChange, coach, intros }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [active, setActive] = useState<UnscoredIntro | null>(null);

  // Hard block: SAs cannot score coaches. Belt-and-suspenders alongside UI hiding.
  if (!canScore(user)) return null;

  // Coaches self-eval their own classes. Koa (Admin) can do formal evals; everyone
  // else defaults to (and is locked to) self-eval. The form-level toggle is also
  // gated by canFormalEval, so this can never produce an SA-attributed formal_eval.
  const evalType: 'self_eval' | 'formal_eval' =
    canFormalEval(user) && user?.name !== coach ? 'formal_eval' : 'self_eval';

  return (
    <>
      <Dialog open={open && !active} onOpenChange={(o) => !o && onOpenChange(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-primary" />
              {coach} · {intros.length} unscored
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Tap any intro to score it. Form opens in {evalType === 'self_eval' ? 'self-eval' : 'formal-eval'} mode.
          </p>
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            {intros.length === 0 && (
              <p className="text-xs text-muted-foreground italic text-center py-6">
                Nothing left to score. Nice.
              </p>
            )}
            {intros.map((it) => (
              <button
                key={it.bookingId}
                type="button"
                onClick={() => setActive(it)}
                className="w-full flex items-center justify-between gap-2 p-3 rounded-md border hover:bg-muted text-left min-h-[44px] cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{it.memberName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {it.classDate ? format(new Date(it.classDate + 'T12:00:00'), 'MMM d') : '—'}
                    {it.introTime ? ` · ${it.introTime.slice(0, 5)}` : ''}
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-primary uppercase tracking-wide shrink-0">
                  Score →
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {active && (
        <ScorecardForm
          open={!!active}
          onOpenChange={(o) => {
            if (!o) {
              setActive(null);
              queryClient.invalidateQueries({ queryKey: ['fv_trend_scorecards'] });
              queryClient.invalidateQueries({ queryKey: ['fv_trend_ran_first_intros'] });
              queryClient.invalidateQueries({ queryKey: ['scorecards'] });
            }
          }}
          firstTimerId={active.bookingId}
          defaultMemberName={active.memberName}
          defaultClassDate={active.classDate}
          defaultCoachName={coach}
          defaultEvaluator={user?.name || coach}
          evalType={evalType}
          onSubmitted={() => {
            setActive(null);
            queryClient.invalidateQueries({ queryKey: ['fv_trend_scorecards'] });
            queryClient.invalidateQueries({ queryKey: ['fv_trend_ran_first_intros'] });
            queryClient.invalidateQueries({ queryKey: ['scorecards'] });
          }}
          showEvalToggle={user?.role === 'Admin'}
        />
      )}
    </>
  );
}
