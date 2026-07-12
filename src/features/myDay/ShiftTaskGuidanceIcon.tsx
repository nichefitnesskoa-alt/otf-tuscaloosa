/**
 * Tap-to-open how-to playbook icon for shift checklist tasks.
 *
 * Mirrors ScoringGuideTooltip.tsx's BulletGuidanceIcon: same Info icon,
 * same Popover, same e.stopPropagation on trigger + content so opening the
 * tip NEVER toggles the row's checkbox/completion state.
 *
 * Renders a scrollable multi-lane playbook: any lane marked
 * `is_safety_note` sticks at the top and is always visible; every other
 * lane collapses to its title and expands on click to show why + numbered
 * steps. Unmapped lanes render with a small "unmapped" tag.
 */
import { useState } from 'react';
import { Info, ChevronDown, AlertTriangle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useShiftTaskGuidance } from '@/hooks/useShiftTaskGuidance';

export function ShiftTaskGuidanceIcon({ taskName }: { taskName: string }) {
  const { data: lanes } = useShiftTaskGuidance(taskName);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (!lanes || lanes.length === 0) return null;

  const safety = lanes.filter(l => l.is_safety_note);
  const playbook = lanes.filter(l => !l.is_safety_note);

  const toggle = (id: string) =>
    setExpanded(p => ({ ...p, [id]: !p[id] }));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`How to: ${taskName}`}
          onClick={e => e.stopPropagation()}
          className="inline-flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer shrink-0"
        >
          <Info className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        className="w-[320px] sm:w-[360px] p-0 max-h-[70vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-3 border-b bg-muted/30">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            How to — playbook
          </p>
          <p className="text-xs font-semibold mt-0.5 leading-snug">{taskName}</p>
        </div>

        {safety.length > 0 && (
          <div className="p-3 border-b bg-warning-dim/40 space-y-1.5">
            {safety.map(s => (
              <div key={s.id}>
                <p className="text-[10px] font-bold uppercase tracking-wide text-warning flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {s.lane_title}
                </p>
                {s.why_line && (
                  <p className="text-[11px] leading-snug text-foreground/80 mt-0.5">{s.why_line}</p>
                )}
                <ul className="mt-1 space-y-0.5">
                  {s.steps.map((step, i) => (
                    <li key={i} className="text-[11px] leading-snug flex gap-1.5">
                      <span className="text-warning">•</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className="overflow-y-auto flex-1 divide-y">
          {playbook.map(lane => {
            const isOpen = !!expanded[lane.id];
            return (
              <div key={lane.id}>
                <button
                  type="button"
                  onClick={() => toggle(lane.id)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50 cursor-pointer"
                >
                  <span className="text-[10px] font-bold tabular-nums text-muted-foreground w-5 shrink-0">
                    {lane.lane_order}
                  </span>
                  <span className="text-xs font-semibold flex-1 leading-snug">{lane.lane_title}</span>
                  {lane.is_unmapped && (
                    <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      unmapped
                    </span>
                  )}
                  <ChevronDown
                    className={cn(
                      'w-3.5 h-3.5 shrink-0 transition-transform text-muted-foreground',
                      isOpen && 'rotate-180',
                    )}
                  />
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 pl-10 space-y-1.5 bg-muted/20">
                    {lane.why_line && (
                      <p className="text-[11px] leading-snug italic text-foreground/75">
                        {lane.why_line}
                      </p>
                    )}
                    <ol className="space-y-1">
                      {lane.steps.map((step, i) => (
                        <li key={i} className="text-[11px] leading-snug flex gap-2">
                          <span className="tabular-nums font-bold text-brand shrink-0">{i + 1}.</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
