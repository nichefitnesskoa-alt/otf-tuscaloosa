/**
 * Shared queue + mutations for the "Ask for a referral" workflow.
 *
 * Single source of truth for both:
 *   - MyDay  → ReferralAskActions (the actionable card SAs work from)
 *   - WIG    → ReferralAskTracker  (read-only stats / accountability)
 *
 * Pulls every membership-sale ran intro whose linked booking is still
 * standard (non-VIP, non-deleted) and returns the row plus mutations to
 * mark it asked / pending follow-up. Optimistic with revert-on-error.
 */
import { useMemo, useState, useCallback } from 'react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { isSaleInRange, getRunSaleDate } from '@/lib/sales-detection';
import { toast } from 'sonner';
import type { DateRange } from '@/lib/pay-period';

export interface ReferralAskRow {
  bookingId: string;
  memberName: string;
  introOwner: string;
  saleDate: string;            // YYYY-MM-DD
  phone: string | null;        // raw on the booking
  coachReferralAsked: boolean;
  followupPending: boolean;
}

interface Options {
  dateRange?: DateRange | null;
}

type Override = { coach_referral_asked?: boolean; referral_ask_followup_pending?: boolean };

export function useReferralAskQueue({ dateRange = null }: Options = {}) {
  const { user } = useAuth();
  const { introsRun, introsBooked, isLoading, silentRefreshData } = useData();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});

  const bookingMap = useMemo(() => {
    const m = new Map<string, any>();
    (introsBooked || []).forEach((b: any) => m.set(b.id, b));
    return m;
  }, [introsBooked]);

  const rows: ReferralAskRow[] = useMemo(() => {
    const sales = (introsRun || []).filter((r: any) => isSaleInRange(r, dateRange));
    const out: ReferralAskRow[] = [];
    for (const run of sales) {
      const bookingId = (run as any).linked_intro_booked_id;
      if (!bookingId) continue;
      const b = bookingMap.get(bookingId);
      if (!b) continue;
      if (b.is_vip) continue;
      const status = (b.booking_status_canon || '').toUpperCase();
      if (status === 'DELETED_SOFT') continue;
      const ov = overrides[bookingId] || {};
      out.push({
        bookingId,
        memberName: b.member_name || 'Unknown',
        introOwner: b.intro_owner || b.booked_by || 'Unknown',
        saleDate: getRunSaleDate(run as any),
        phone: b.phone || b.phone_e164 || null,
        coachReferralAsked: ov.coach_referral_asked ?? !!b.coach_referral_asked,
        followupPending: ov.referral_ask_followup_pending ?? !!(b as any).referral_ask_followup_pending,
      });
    }
    // Pending (oldest first → SLA visibility), then follow-up pending, then asked last
    return out.sort((a, b) => {
      const score = (r: ReferralAskRow) => r.coachReferralAsked ? 2 : (r.followupPending ? 1 : 0);
      const sa = score(a), sb = score(b);
      if (sa !== sb) return sa - sb;
      // Within same status: oldest sale first for to-do, newest first for asked
      if (sa === 2) return b.saleDate.localeCompare(a.saleDate);
      return a.saleDate.localeCompare(b.saleDate);
    });
  }, [introsRun, bookingMap, dateRange, overrides]);

  const pendingCount = useMemo(() => rows.filter(r => !r.coachReferralAsked).length, [rows]);
  const completedCount = useMemo(() => rows.filter(r => r.coachReferralAsked).length, [rows]);

  const updateBooking = useCallback(async (bookingId: string, updates: Override, reason: string) => {
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
      setOverrides(prev => {
        const copy = { ...prev };
        delete copy[bookingId];
        return copy;
      });
    }
  }, [user?.name]);

  const markAsked = useCallback((bookingId: string, reason: string) =>
    updateBooking(bookingId, { coach_referral_asked: true, referral_ask_followup_pending: false }, reason),
    [updateBooking]);

  const markFollowupPending = useCallback((bookingId: string, reason: string) =>
    updateBooking(bookingId, { referral_ask_followup_pending: true }, reason),
    [updateBooking]);

  return {
    rows,
    pendingCount,
    completedCount,
    isLoading,
    savingId,
    markAsked,
    markFollowupPending,
  };
}
