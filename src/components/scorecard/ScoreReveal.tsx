import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LEVEL_COPY } from '@/lib/scorecard/levels';

export function ScoreReveal({ level, total, onClose }: { level: 1 | 2 | 3; total: number; onClose: () => void }) {
  const copy = LEVEL_COPY[level];

  useEffect(() => {
    if (level === 3) {
      const fire = (particleRatio: number, opts: confetti.Options) => {
        confetti({ ...opts, origin: { y: 0.6 }, particleCount: Math.floor(220 * particleRatio) });
      };
      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1, { spread: 120, startVelocity: 45 });
    }
  }, [level]);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md text-center">
        <div className="py-8 space-y-4">
          <div
            className="mx-auto w-28 h-28 rounded-full flex items-center justify-center text-white shadow-2xl"
            style={{ backgroundColor: copy.color }}
          >
            <div>
              <div className="text-4xl font-black leading-none">L{level}</div>
              <div className="text-xs font-bold opacity-90 mt-1">{total}/30</div>
            </div>
          </div>
          <h2 className="text-2xl font-black">{copy.headline}</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">{copy.body}</p>
          <Button onClick={onClose} className="w-full text-white font-bold" style={{ minHeight: '44px', backgroundColor: '#E8540A' }}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
