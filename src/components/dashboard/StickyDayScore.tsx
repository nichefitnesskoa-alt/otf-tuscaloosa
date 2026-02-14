import { useState, useEffect, useRef } from 'react';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StickyDayScoreProps {
  completedActions: number;
  totalActions: number;
}

export function StickyDayScore({ completedActions, totalActions }: StickyDayScoreProps) {
  const [isSticky, setIsSticky] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsSticky(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-1px 0px 0px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (totalActions === 0) return null;

  const pct = Math.round((completedActions / totalActions) * 100);
  const allDone = pct >= 100;

  return (
    <>
      <div ref={sentinelRef} className="h-0" />
      <div
        className={cn(
          'transition-all duration-200 z-30',
          isSticky && 'fixed top-0 left-0 right-0 px-4 pt-2 pb-2 bg-background/95 backdrop-blur-sm border-b shadow-sm'
        )}
      >
        {isSticky ? (
          // Compact sticky version
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {allDone ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-primary" />
              )}
              <span className="text-xs font-semibold">
                {completedActions}/{totalActions} ({pct}%)
              </span>
            </div>
            <Progress value={pct} className="h-1.5 flex-1" />
          </div>
        ) : (
          // Full version
          <div className={cn(
            'rounded-xl border p-3 space-y-1.5',
            allDone ? 'bg-emerald-50 border-emerald-200' : 'bg-card'
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {allDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Zap className="w-4 h-4 text-primary" />
                )}
                <span className="text-sm font-semibold">
                  {allDone ? 'All caught up!' : "Today's Progress"}
                </span>
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {completedActions}/{totalActions} actions ({pct}%)
              </span>
            </div>
            <Progress value={pct} className="h-2.5" />
          </div>
        )}
      </div>
    </>
  );
}
