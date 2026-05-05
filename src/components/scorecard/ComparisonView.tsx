import { useState } from 'react';
import { useScorecard, useAddComment } from '@/hooks/useScorecards';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { BULLETS, COLUMNS, LEVEL_COPY } from '@/lib/scorecard/levels';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';

const SCORE_LABEL = ['Missed', 'Partial', 'Hit'];
const SCORE_COLOR = ['hsl(0 84% 60%)', 'hsl(40 91% 49%)', 'hsl(142 71% 45%)'];

export function ComparisonView({ scorecardId, open, onOpenChange }: {
  scorecardId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { user } = useAuth();
  const { data } = useScorecard(scorecardId);
  const addComment = useAddComment();
  const [draft, setDraft] = useState('');

  if (!data?.scorecard) return null;
  const sc = data.scorecard;
  const bulletMap = Object.fromEntries(data.bullets.map(b => [b.bullet_key, b.score]));
  const copy = LEVEL_COPY[sc.level];

  const submitComment = async () => {
    if (!draft.trim()) return;
    await addComment.mutateAsync({ scorecard_id: sc.id, author_name: user?.name || 'Unknown', body: draft });
    setDraft('');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Scorecard — {sc.practice_name || 'First-Timer'}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <Card className="p-4 flex items-center justify-between">
            <div>
              <Badge variant={sc.eval_type === 'self_eval' ? 'secondary' : 'default'}>
                {sc.eval_type === 'self_eval' ? 'Self-eval' : 'Formal eval'}
              </Badge>
              <p className="text-sm font-medium mt-2">{sc.evaluatee_name}</p>
              <p className="text-xs text-muted-foreground">
                Evaluated by {sc.evaluator_name} · {format(new Date(sc.class_date), 'MMM d')}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black tabular-nums" style={{ color: copy.color }}>L{sc.level}</div>
              <div className="text-xs font-bold tabular-nums">{sc.total_score}/15</div>
            </div>
          </Card>

          {/* Bullet table */}
          <Card className="p-4">
            <h3 className="font-bold text-sm mb-3">Bullets</h3>
            <div className="space-y-3">
              {COLUMNS.map(col => (
                <div key={col.key}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold tracking-wide">{col.label.toUpperCase()}</p>
                    <span className="text-xs font-bold tabular-nums">{(sc as any)[`${col.key}_score`]}/6</span>
                  </div>
                  <div className="space-y-1">
                    {BULLETS[col.key].map(b => {
                      const s = bulletMap[b.key];
                      return (
                        <div key={b.key} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                          <span className="text-foreground/80 flex-1">{b.label}</span>
                          <span
                            className="ml-2 px-2 py-0.5 rounded text-white text-[10px] font-bold"
                            style={{ backgroundColor: s != null ? SCORE_COLOR[s] : 'hsl(var(--muted))' }}
                          >
                            {s != null ? SCORE_LABEL[s] : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Notes */}
          {(sc.interactions_notes || sc.otbeat_notes || sc.handback_notes) && (
            <Card className="p-4 space-y-2">
              <h3 className="font-bold text-sm">Notes</h3>
              {sc.interactions_notes && <div><p className="text-[10px] uppercase text-muted-foreground">Interactions</p><p className="text-sm">{sc.interactions_notes}</p></div>}
              {sc.otbeat_notes && <div><p className="text-[10px] uppercase text-muted-foreground">OTBeat</p><p className="text-sm">{sc.otbeat_notes}</p></div>}
              {sc.handback_notes && <div><p className="text-[10px] uppercase text-muted-foreground">Handback</p><p className="text-sm">{sc.handback_notes}</p></div>}
            </Card>
          )}

          {/* Comments */}
          <Card className="p-4 space-y-3">
            <h3 className="font-bold text-sm">Comments</h3>
            <div className="space-y-2">
              {data.comments.length === 0 && <p className="text-xs text-muted-foreground italic">No comments yet</p>}
              {data.comments.map(c => (
                <div key={c.id} className="rounded-md bg-muted/50 px-3 py-2">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-semibold">{c.author_name}</span>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(c.created_at), 'MMM d, h:mm a')}</span>
                  </div>
                  <p className="text-sm">{c.body}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Add a comment…" className="min-h-[60px]" />
              <Button onClick={submitComment} disabled={!draft.trim()} className="w-full text-white font-bold" style={{ minHeight: '44px', backgroundColor: '#E8540A' }}>
                Post comment
              </Button>
            </div>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
