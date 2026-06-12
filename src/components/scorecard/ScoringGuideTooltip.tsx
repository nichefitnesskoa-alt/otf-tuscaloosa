import { Info, HelpCircle, Star } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { BulletGuidance, ColumnGuidance, GlobalGuidance } from '@/hooks/useScoringGuidance';

const ROW_BASE = 'flex gap-2 items-start text-xs leading-snug rounded px-2 py-1.5 border';
const ROW_STYLES: Record<0 | 1 | 2, string> = {
  0: 'bg-muted/40 text-muted-foreground border-border',
  1: 'bg-warning-dim/60 text-warning border-warning/30',
  2: 'bg-success-dim/60 text-success border-success/30',
};
const LABEL: Record<0 | 1 | 2, string> = { 0: '0  Missed', 1: '1  Partial', 2: '2  Hit' };

export function BulletGuidanceIcon({ guidance, label }: { guidance?: BulletGuidance; label: string }) {
  if (!guidance) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`How to score: ${label}`}
          onClick={e => e.stopPropagation()}
          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer shrink-0"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-[280px] sm:w-[320px] p-3 space-y-2"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        {([0, 1, 2] as const).map(s => (
          <div key={s} className={`${ROW_BASE} ${ROW_STYLES[s]}`}>
            <span className="font-bold tabular-nums shrink-0 w-14">{LABEL[s]}</span>
            <span className="flex-1">{guidance[`score_${s}` as const]}</span>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function ColumnStarBadge({ column, label }: { column?: ColumnGuidance; label: string }) {
  if (!column?.is_starred || !column.why_matters) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Why ${label} matters`}
          className="inline-flex items-center justify-center w-5 h-5 rounded text-brand hover:bg-brand/10 cursor-pointer shrink-0"
        >
          <Star className="w-3.5 h-3.5 fill-current" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-[280px] p-3 space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-brand flex items-center gap-1">
          <Star className="w-3 h-3 fill-current" /> {label} · why this matters
        </p>
        <p className="text-xs leading-snug">{column.why_matters}</p>
      </PopoverContent>
    </Popover>
  );
}

export function HowToScoreButton({ global }: { global: GlobalGuidance | null }) {
  if (!global) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground border border-input rounded-md px-2.5 py-1.5 hover:bg-muted cursor-pointer"
          style={{ minHeight: '32px' }}
        >
          <HelpCircle className="w-3.5 h-3.5" /> How to score
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" className="w-[320px] p-3 space-y-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Two tests</p>
        <div className="space-y-1.5">
          <p className="text-xs leading-snug"><span className="font-bold">1. </span>{global.surface_test}</p>
          <p className="text-xs leading-snug"><span className="font-bold">2. </span>{global.awareness_test}</p>
        </div>
        <div className="border-t pt-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Scale</p>
          <p className="text-xs leading-snug">{global.scale_meaning}</p>
        </div>
        {global.bottom_line && (
          <div className="border-t pt-2">
            <p className="text-xs italic leading-snug text-foreground/80">{global.bottom_line}</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
