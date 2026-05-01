import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Users, Check, Clock, Loader2 } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { isSaleInRange, getRunSaleDate } from '@/lib/sales-detection';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { toast } from 'sonner';
import type { DateRange } from '@/lib/pay-period';

interface Props {
  dateRange: DateRange | null;
}

interface Row {
  bookingId: string;
  memberName: string;
  introOwner: string;
  saleDate: string;
  coachReferralAsked: boolean;
  followupPending: boolean;
}

export function ReferralAskTracker({ dateRange }: Props) {
  const { user } = useAuth();
  const { introsRun, introsBooked, isLoading } = useData();
  const [showCompleted, setShowCompleted] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  // Local optimistic overrides for fields we mutate
  const [overrides, setOverrides] = useState<Record<string, { coach_referral_asked?: boolean; referral_ask_followup_pending?: boolean }>>({});

  const bookingMap = useMemo(() => {
    const m = new Map<string, any>();
    (introsBooked || []).forEach((b: any) => m.set(b.id, b));
    return m;
  }, [introsBooked]);

  const rows: Row[] = useMemo(() => {
    const sales = (introsRun || []).filter((r: any) => isSaleInRange(r, dateRange));
    const result: Row[] = [];
    for (const run of sales) {
      const bookingId = (run as any).linked_intro_booked_id;
      if (!bookingId) continue;
      const b = bookingMap.get(bookingId);
      if (!b) continue;
      if (b.is_vip) continue;
      const status = (b.booking_status_canon || '').toUpperCase();
      if (status === 'DELETED_SOFT') continue;
      const ov = overrides[bookingId] || {};
      result.push({
        bookingId,
        memberName: b.member_name || 'Unknown',
        introOwner: b.intro_owner || b.booked_by || 'Unknown',
        saleDate: getRunSaleDate(run as any),
        coachReferralAsked: ov.coach_referral_asked ?? !!b.coach_referral_asked,
        followupPending: ov.referral_ask_followup_pending ?? !!(b as any).referral_ask_followup_pending,
      });
    }
    // Sort: pending follow-ups first, then not-yet-asked, then completed; newest first
    return result.sort((a, b) => {
      const score = (r: Row) => r.coachReferralAsked ? 2 : (r.followupPending ? 1 : 0);
      const sa = score(a), sb = score(b);
      if (sa !== sb) return sa - sb;
      return b.saleDate.localeCompare(a.saleDate);
    });
  }, [introsRun, bookingMap, dateRange, overrides]);

  const visibleRows = showCompleted ? rows : rows.filter(r => !r.coachReferralAsked);
  const completedCount = rows.filter(r => r.coachReferralAsked).length;
  const pendingCount = rows.filter(r => !r.coachReferralAsked).length;

  const updateBooking = async (bookingId: string, updates: { coach_referral_asked?: boolean; referral_ask_followup_pending?: boolean }, reason: string) => {
    setSavingId(bookingId);
    setOverrides(prev => ({ ...prev, [bookingId]: { ...(prev[bookingId] || {}), ...updates } }));
    const { error } = await supabase
      .from('intros_booked')
      .update({
        ...updates,
        last_edited_by: user?.name || 'Unknown',
        last_edited_at: new Date().toISOString(),
        edit_reason: reason,
      } as any)
      .eq('id', bookingId);
    setSavingId(null);
    if (error) {
      toast.error('Failed to save — try again');
      // revert
      setOverrides(prev => {
        const copy = { ...prev };
        delete copy[bookingId];
        return copy;
      });
      return;
    }
  };

  const handleAskedAtPos = (r: Row) =>
    updateBooking(r.bookingId, { coach_referral_asked: true, referral_ask_followup_pending: false }, 'POS referral ask logged on WIG');

  const handleAskLater = (r: Row) =>
    updateBooking(r.bookingId, { referral_ask_followup_pending: true }, 'Referral ask deferred from WIG');

  const handleDoneLater = (r: Row) =>
    updateBooking(r.bookingId, { coach_referral_asked: true, referral_ask_followup_pending: false }, 'Referral asked after the fact from WIG');

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Ask for a referral
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Every new member from this period. Tap once you've asked.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="px-4 py-2 border-b flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">{pendingCount}</span> to do
            </span>
            <span className="text-muted-foreground">
              <span className="font-medium text-success">{completedCount}</span> asked
            </span>
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
              const saving = savingId === r.bookingId;
              const dateLabel = (() => {
                try { return format(parseLocalDate(r.saleDate), 'MMM d'); } catch { return r.saleDate; }
              })();
              return (
                <div key={r.bookingId} className="p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
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
                    ) : null}
                  </div>
                  {!r.coachReferralAsked && (
                    <div className="flex flex-wrap gap-2">
                      {r.followupPending ? (
                        <Button
                          size="sm"
                          className="h-9 text-xs"
                          onClick={() => handleDoneLater(r)}
                          disabled={saving}
                        >
                          <Check className="w-3.5 h-3.5 mr-1" /> Done — asked them
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            className="h-9 text-xs"
                            onClick={() => handleAskedAtPos(r)}
                            disabled={saving}
                          >
                            <Check className="w-3.5 h-3.5 mr-1" /> Asked at POS
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 text-xs"
                            onClick={() => handleAskLater(r)}
                            disabled={saving}
                          >
                            <Clock className="w-3.5 h-3.5 mr-1" /> Ask later
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
