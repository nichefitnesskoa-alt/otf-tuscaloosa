/**
 * ReferralAskTracker — WIG accountability view (read-only stats).
 *
 * Actions live on MyDay (see ReferralAskActions). This card is purely for
 * visibility on the WIG tab: counts, drill-downs, and the per-member status
 * list. Both surfaces share useReferralAskQueue so the numbers always agree.
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Users, Check, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { PersonListDrillDown, DrillNumber, PersonRow } from './PersonListDrillDown';
import { useReferralAskQueue } from '@/features/referralAsk/useReferralAskQueue';
import type { DateRange } from '@/lib/pay-period';

interface Props {
  dateRange: DateRange | null;
}

export function ReferralAskTracker({ dateRange }: Props) {
  const { rows, pendingCount, completedCount, isLoading } = useReferralAskQueue({ dateRange });
  const [showCompleted, setShowCompleted] = useState(false);
  const [drill, setDrill] = useState<'pending' | 'completed' | null>(null);

  const visibleRows = showCompleted ? rows : rows.filter(r => !r.coachReferralAsked);

  const drillRows: PersonRow[] = useMemo(() => {
    if (!drill) return [];
    const list = drill === 'pending' ? rows.filter(r => !r.coachReferralAsked) : rows.filter(r => r.coachReferralAsked);
    return list.map(r => ({
      id: r.bookingId,
      name: r.memberName,
      subtitle: `sold by ${r.introOwner} · ${(() => { try { return format(parseLocalDate(r.saleDate), 'MMM d'); } catch { return r.saleDate; } })()}`,
      rightLabel: r.coachReferralAsked ? 'Asked' : r.followupPending ? 'Pending' : 'To do',
      rightTone: r.coachReferralAsked ? 'success' : r.followupPending ? 'warning' : 'destructive',
    }));
  }, [drill, rows]);

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Ask for a referral
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Goal: every new member gets a referral ask within 24 hours of joining — at the POS desk if you can, or by text right after.
          </p>
          <p className="text-[11px] text-primary mt-1">
            Log asks from <span className="font-semibold">My Day → Ask for a referral</span>.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="px-4 py-2 border-b flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs">
              <DrillNumber value={pendingCount} onClick={() => setDrill('pending')} ariaLabel={`View ${pendingCount} pending referral asks`} tone="destructive" className="text-xs" />
              <span className="text-muted-foreground">to do</span>
              <DrillNumber value={completedCount} onClick={() => setDrill('completed')} ariaLabel={`View ${completedCount} completed referral asks`} tone="success" className="text-xs ml-2" />
              <span className="text-muted-foreground">asked</span>
            </div>
            {completedCount > 0 && (
              <div className="flex items-center gap-2">
                <Switch id="show-completed-ref" checked={showCompleted} onCheckedChange={setShowCompleted} />
                <Label htmlFor="show-completed-ref" className="text-xs text-muted-foreground cursor-pointer">Show completed</Label>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mr-2" />
              <span className="text-xs text-muted-foreground">Loading…</span>
            </div>
          ) : rows.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              No membership sales in this period — nothing to ask about yet.
            </p>
          ) : visibleRows.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              All caught up — every new member has been asked.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {visibleRows.map(r => {
                const dateLabel = (() => {
                  try { return format(parseLocalDate(r.saleDate), 'MMM d'); } catch { return r.saleDate; }
                })();
                return (
                  <div key={r.bookingId} className="p-3 flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{r.memberName}</span>
                    <span className="text-[11px] text-muted-foreground">sold by {r.introOwner} · {dateLabel}</span>
                    {r.coachReferralAsked ? (
                      <Badge className="bg-success/20 text-success border-success/40 hover:bg-success/20 text-[9px] h-4">
                        <Check className="w-2.5 h-2.5 mr-0.5" /> Asked
                      </Badge>
                    ) : r.followupPending ? (
                      <Badge className="bg-warning/20 text-warning border-warning/40 hover:bg-warning/20 text-[9px] h-4">
                        <Clock className="w-2.5 h-2.5 mr-0.5" /> Follow up pending
                      </Badge>
                    ) : (
                      <Badge className="bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/15 text-[9px] h-4">
                        To do
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <PersonListDrillDown
        open={!!drill}
        onOpenChange={(o) => { if (!o) setDrill(null); }}
        title={drill === 'pending' ? 'Referral asks to do' : 'Referral asks completed'}
        scopeBadge="WIG tab"
        rows={drillRows}
        emptyText="Nothing here."
      />
    </>
  );
}
