/**
 * Shared person-list drilldown.
 * Mobile: bottom Sheet (90vh, drag-friendly).
 * Desktop: centered Dialog.
 *
 * Use via <PersonListDrillDown ...> for any person-tied metric.
 * Use <DrillNumber> as the trigger — handles 44px tap target, OTF Orange
 * underlined numerals, disabled-when-zero state, and accessible label.
 */
import { ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { OutcomeEditButton } from '@/components/shared/OutcomeEditButton';

export interface PersonRow {
  id: string;
  name: string;
  subtitle?: string;
  rightLabel?: string;
  rightTone?: 'success' | 'warning' | 'destructive' | 'primary' | 'muted';
  /** When set, the right-side becomes an inline outcome editor (distinct
   *  tap target — the row's name still opens the Journey card via onClick). */
  outcomeEdit?: { bookingId: string };
  href?: string; // when set, row becomes navigable
  onClick?: () => void; // when set, row becomes a tappable button (overrides href)
  /** Admin-only remove handler. When set, renders a trash icon button that
   *  confirms then runs the handler. Use to exclude a row from a metric
   *  without deleting the underlying record. */
  onRemove?: () => void | Promise<void>;
  /** Confirm message shown before onRemove runs. Defaults to a generic one. */
  removeConfirm?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  subtitle?: string;
  scopeBadge?: string; // e.g. "WIG tab", "Studio tab"
  rows: PersonRow[];
  emptyText?: string;
  footer?: ReactNode; // optional reconciliation footer
}

const TONE_CLASS: Record<NonNullable<PersonRow['rightTone']>, string> = {
  success: 'bg-success/15 text-success border-success/40',
  warning: 'bg-warning/15 text-warning border-warning/40',
  destructive: 'bg-destructive/10 text-destructive border-destructive/30',
  primary: 'bg-primary/10 text-primary border-primary/30',
  muted: 'bg-muted text-muted-foreground border-border',
};

function Body({ rows, emptyText, footer, subtitle, scopeBadge }: {
  rows: PersonRow[]; emptyText?: string; footer?: ReactNode; subtitle?: string; scopeBadge?: string;
}) {
  return (
    <>
      {(scopeBadge || subtitle) && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground -mt-1 mb-2">
          {scopeBadge && <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{scopeBadge}</Badge>}
          {subtitle && <span>{subtitle}</span>}
        </div>
      )}
      <div className="overflow-y-auto -mx-6 px-6 space-y-1.5 flex-1 min-h-0">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">{emptyText || 'No records.'}</p>
        ) : (
          rows.map(r => {
            const interactive = !!(r.onClick || r.href);
            const hasOutcomeEdit = !!r.outcomeEdit;

            const rightSlot = hasOutcomeEdit ? (
              <OutcomeEditButton
                bookingId={r.outcomeEdit!.bookingId}
                label={r.rightLabel || '—'}
                tone={r.rightTone || 'muted'}
              />
            ) : r.rightLabel ? (
              <span className={cn(
                'text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0',
                TONE_CLASS[r.rightTone || 'muted'],
              )}>
                {r.rightLabel}
              </span>
            ) : null;

            // When the outcome edit lives on this row, the name and the
            // outcome are DISTINCT tap targets (no nested buttons). Name
            // opens the Journey card; outcome opens the OutcomeDrawer.
            if (hasOutcomeEdit) {
              const NameEl: any = r.onClick ? 'button' : r.href ? 'a' : 'div';
              const nameProps: any = r.onClick
                ? { type: 'button', onClick: r.onClick }
                : r.href
                ? { href: r.href }
                : {};
              return (
                <div
                  key={r.id}
                  className="rounded-md border border-border p-2 bg-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <NameEl
                      {...nameProps}
                      className={cn(
                        'min-w-0 flex-1 text-left',
                        interactive && 'cursor-pointer hover:underline underline-offset-2 decoration-primary',
                      )}
                    >
                      <p className="text-sm font-semibold truncate">{r.name}</p>
                      {r.subtitle && <p className="text-[10px] text-muted-foreground font-normal">{r.subtitle}</p>}
                    </NameEl>
                    {rightSlot}
                  </div>
                </div>
              );
            }

            const inner = (
              <div className={cn(
                'rounded-md border border-border p-2 bg-card',
                interactive && 'cursor-pointer hover:border-primary/60 active:scale-[0.99] transition-all'
              )}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{r.name}</p>
                    {r.subtitle && <p className="text-[10px] text-muted-foreground">{r.subtitle}</p>}
                  </div>
                  {rightSlot}
                </div>
              </div>
            );
            if (r.onClick) {
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={r.onClick}
                  className="block w-full text-left"
                >
                  {inner}
                </button>
              );
            }
            return r.href ? (
              <a key={r.id} href={r.href} className="block no-underline text-current">{inner}</a>
            ) : (
              <div key={r.id}>{inner}</div>
            );
          })
        )}
      </div>
      {footer && (
        <div className="border-t border-border pt-2 mt-2 space-y-1 text-[10px] text-muted-foreground">
          {footer}
        </div>
      )}
    </>
  );
}

export function PersonListDrillDown({
  open, onOpenChange, title, subtitle, scopeBadge, rows, emptyText, footer,
}: Props) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[90vh] flex flex-col p-4 pt-3">
          <div className="mx-auto w-10 h-1 rounded-full bg-muted mb-2 shrink-0" aria-hidden />
          <SheetHeader className="text-left space-y-1 shrink-0">
            <SheetTitle className="text-sm flex items-center gap-2">
              <span className="truncate">{title}</span>
              <Badge variant="outline" className="ml-auto text-[10px] shrink-0">{rows.length}</Badge>
            </SheetTitle>
          </SheetHeader>
          <Body rows={rows} emptyText={emptyText} footer={footer} subtitle={subtitle} scopeBadge={scopeBadge} />
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-sm flex items-center gap-2">
            <span className="truncate">{title}</span>
            <Badge variant="outline" className="ml-auto text-[10px] shrink-0">{rows.length}</Badge>
          </DialogTitle>
        </DialogHeader>
        <Body rows={rows} emptyText={emptyText} footer={footer} subtitle={subtitle} scopeBadge={scopeBadge} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Tappable numeric trigger. 44px min tap target, OTF Orange underlined
 * numerals on hover/focus, disabled when count = 0.
 */
export function DrillNumber({
  value, onClick, className, ariaLabel, tone = 'default',
}: {
  value: number | string;
  onClick: () => void;
  className?: string;
  ariaLabel?: string;
  tone?: 'default' | 'success' | 'warning' | 'destructive';
}) {
  const numeric = typeof value === 'number' ? value : Number(value);
  const isZero = !Number.isNaN(numeric) && numeric === 0;
  const toneClass =
    tone === 'success' ? 'text-success' :
    tone === 'warning' ? 'text-warning' :
    tone === 'destructive' ? 'text-destructive' : '';
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isZero}
      onClick={onClick}
      aria-label={ariaLabel || `View ${value} records`}
      className={cn(
        'min-h-[44px] min-w-[44px] px-2 py-1 font-semibold tabular-nums',
        !isZero && 'hover:text-primary hover:underline underline-offset-4 decoration-primary',
        isZero && 'opacity-60 cursor-default hover:no-underline',
        toneClass,
        className,
      )}
    >
      {value}
    </Button>
  );
}
