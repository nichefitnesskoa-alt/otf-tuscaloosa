import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';

export interface AttribIntro {
  bookingId: string;
  member: string;
  classDate: string | null;
  source: string | null;
  resultLabel: string;       // see labelForRun()
  via?: 'direct' | '2nd_intro';
  via2ndIntroSale?: boolean; // true on a Coached row whose Total Journey ended in a sale via 2nd intro
}

export interface CoachAttribution {
  coached: AttribIntro[];        // counted in "Coached"
  closes: AttribIntro[];         // counted in "Closes"
  excluded: AttribIntro[];       // visible context — not counted
}

type Metric = 'coached' | 'closes';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  coach: string | null;
  metric: Metric;
  source: 'wig' | 'studio';
  rangeLabel: string;
  attribution: CoachAttribution | null;
}

const RESULT_TONE: Record<string, string> = {
  'SALE': 'bg-success/15 text-success border-success/40',
  'Follow-Up': 'bg-warning/15 text-warning border-warning/40',
  'No Show': 'bg-muted text-muted-foreground border-border',
  'Booked 2nd': 'bg-primary/10 text-primary border-primary/30',
  'Planning to Buy': 'bg-primary/10 text-primary border-primary/30',
  'Not Interested': 'bg-destructive/10 text-destructive border-destructive/30',
  '5 Class Pack': 'bg-primary/10 text-primary border-primary/30',
  'VIP Intro': 'bg-muted text-muted-foreground border-border italic',
  'Unresolved': 'bg-muted text-muted-foreground border-border',
  '—': 'bg-muted text-muted-foreground border-border',
};

export function CoachAttributionDrillDown({
  open, onOpenChange, coach, metric, source, rangeLabel, attribution,
}: Props) {
  if (!coach) return null;
  const list = metric === 'coached' ? attribution?.coached || [] : attribution?.closes || [];
  const excluded = attribution?.excluded || [];

  const directCloses = (attribution?.closes || []).filter(x => x.via !== '2nd_intro').length;
  const journeyCloses = (attribution?.closes || []).filter(x => x.via === '2nd_intro').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-sm flex items-center gap-2">
            <span>{coach}</span>
            <span className="text-muted-foreground">·</span>
            <span>{metric === 'coached' ? 'Coached' : 'Closes'}</span>
            <Badge variant="outline" className="ml-auto text-[10px]">{list.length}</Badge>
          </DialogTitle>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {source === 'wig' ? 'WIG tab' : 'Studio tab'}
            </Badge>
            <span>{rangeLabel}</span>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto -mx-6 px-6 space-y-1.5 flex-1">
          {list.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No intros in this bucket.</p>
          ) : (
            list.map(i => (
              <div
                key={`${i.bookingId}-${i.via || 'd'}`}
                className="rounded-md border border-border p-2 bg-card"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{i.member}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {i.classDate ? format(parseLocalDate(i.classDate), 'MMM d') : '—'}
                      {i.source && <> · {i.source}</>}
                      {i.via === '2nd_intro' && <> · <span className="text-primary font-semibold">via 2nd intro</span></>}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${RESULT_TONE[i.resultLabel] || RESULT_TONE['—']}`}>
                    {i.resultLabel}
                  </span>
                </div>
              </div>
            ))
          )}

          {excluded.length > 0 && (
            <div className="pt-3 mt-3 border-t border-border">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">
                Excluded from this count ({excluded.length})
              </p>
              {excluded.map(i => (
                <div key={`x-${i.bookingId}`} className="flex items-center justify-between gap-2 py-1 text-[11px]">
                  <span className="truncate text-muted-foreground">
                    {i.member} <span className="opacity-60">· {i.classDate ? format(parseLocalDate(i.classDate), 'MMM d') : '—'}</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground italic whitespace-nowrap">{i.resultLabel}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reconciliation footer */}
        <div className="border-t border-border pt-2 mt-2 space-y-1 text-[10px] text-muted-foreground">
          <div className="flex justify-between"><span>Counted as Coached</span><span className="tabular-nums">{attribution?.coached.length ?? 0}</span></div>
          <div className="flex justify-between"><span>Counted as Close (direct sale)</span><span className="tabular-nums">{directCloses}</span></div>
          <div className="flex justify-between"><span>Counted as Close (2nd intro · Total Journey)</span><span className="tabular-nums">{journeyCloses}</span></div>
          <div className="flex justify-between"><span>Excluded</span><span className="tabular-nums">{excluded.length}</span></div>
          <p className="pt-1 italic opacity-80">
            {source === 'wig'
              ? 'WIG: only intros that ran (excludes No-Show, Unresolved, VIP Intro). VIP coach takes credit on VIP-class intros.'
              : 'Studio: every first-intro run in range (VIP Intro excluded). Coach credit follows the run; VIP class coach overrides.'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
