/**
 * Follow-Up data hook — queries intros_run + intros_booked to build 5 follow-up arrays.
 *
 * 1. No Show (1st Intro) — NO_SHOW + not 2nd intro
 * 2. No Show (2nd Intro) — NO_SHOW + is 2nd intro
 * 3. Planning to Reschedule — PLANNING_RESCHEDULE
 * 4. Didn't Buy (1st Intro) — DIDNT_BUY + not 2nd intro
 * 5. Didn't Buy (2nd Intro) — DIDNT_BUY + is 2nd intro / State B
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format, subDays, addDays, differenceInHours } from 'date-fns';
import { localDateToStartISO } from '@/lib/dateUtils';
import { supabase } from '@/integrations/supabase/client';

export type FollowUpType = 'noshow_1st' | 'noshow_2nd' | 'reschedule' | 'didnt_buy_1st' | 'didnt_buy_2nd' | 'planning_to_buy';

export interface FollowUpItem {
  bookingId: string;
  runId: string | null;
  memberName: string;
  classDate: string;
  introTime: string | null;
  coachName: string | null;
  leadSource: string | null;
  phone: string | null;
  email: string | null;
  result: string | null;
  resultCanon: string | null;
  isSecondIntro: boolean;
  originatingBookingId: string | null;
  rescheduleContactDate: string | null;
  followUpState: 'A' | 'B' | null;
  lastContactAt: string | null;
  lastContactSummary: string | null;
  contactNextDate: string | null;
  badgeType?: 'no_outcome' | 'follow_up_needed' | 'state_b';
  followUpType: FollowUpType;
  transferredFromCoach?: string | null;
  plannedBuyDate?: string | null;
}

const TERMINAL_OUTCOMES = ['Purchased', 'Not Interested'];
const PURCHASE_RESULTS = ['Premier', 'Elite', 'Basic', 'Premier + OTbeat', 'Elite + OTbeat', 'Basic + OTbeat'];

function isTerminal(result: string | null): boolean {
  if (!result) return false;
  if (TERMINAL_OUTCOMES.includes(result)) return true;
  return PURCHASE_RESULTS.some(p => result.includes(p));
}

function computeContactNext(classDate: string, type: FollowUpType): string | null {
  try {
    const d = new Date(classDate + 'T12:00:00');
    switch (type) {
      case 'noshow_1st':
      case 'noshow_2nd':
        return format(addDays(d, 1), 'yyyy-MM-dd');
      case 'didnt_buy_1st':
      case 'didnt_buy_2nd':
        return format(addDays(d, 3), 'yyyy-MM-dd');
      case 'reschedule':
        return format(addDays(d, 2), 'yyyy-MM-dd');
      case 'planning_to_buy':
        return null; // Handled by scheduled_date from follow_up_queue
    }
  } catch { return null; }
}

export function useFollowUpData() {
  const [noShow1st, setNoShow1st] = useState<FollowUpItem[]>([]);
  const [noShow1stCooling, setNoShow1stCooling] = useState<FollowUpItem[]>([]);
  const [noShow2nd, setNoShow2nd] = useState<FollowUpItem[]>([]);
  const [noShow2ndCooling, setNoShow2ndCooling] = useState<FollowUpItem[]>([]);
  const [didntBuy1st, setDidntBuy1st] = useState<FollowUpItem[]>([]);
  const [didntBuy1stCooling, setDidntBuy1stCooling] = useState<FollowUpItem[]>([]);
  const [didntBuy2nd, setDidntBuy2nd] = useState<FollowUpItem[]>([]);
  const [didntBuy2ndCooling, setDidntBuy2ndCooling] = useState<FollowUpItem[]>([]);
  const [plansToReschedule, setPlansToReschedule] = useState<FollowUpItem[]>([]);
  const [plansToRescheduleCooling, setPlansToRescheduleCooling] = useState<FollowUpItem[]>([]);
  const [planningToBuy, setPlanningToBuy] = useState<FollowUpItem[]>([]);
  const [planningToBuyCooling, setPlanningToBuyCooling] = useState<FollowUpItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isFirstLoad = useRef(true);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const cutoff = format(subDays(new Date(), 90), 'yyyy-MM-dd');

      // Get coach-owned booking IDs to exclude from SA view
      const { data: coachOwned } = await (supabase
        .from('follow_up_queue')
        .select('booking_id, coach_owner, transferred_to_sa_at') as any)
        .eq('owner_role', 'Coach')
        .is('not_interested_at', null)
        .is('transferred_to_sa_at', null);
      const coachOwnedBookingIds = new Set((coachOwned || []).filter((c: any) => c.booking_id).map((c: any) => c.booking_id));

      // Get transferred records to mark with badge
      const { data: transferred } = await (supabase
        .from('follow_up_queue')
        .select('booking_id, coach_owner, transferred_to_sa_at') as any)
        .eq('owner_role', 'SA')
        .not('transferred_to_sa_at', 'is', null);
      const transferredMap = new Map<string, string>();
      for (const t of transferred || []) {
        if (t.booking_id && t.coach_owner) transferredMap.set(t.booking_id, t.coach_owner);
      }

      // Get not-interested booking IDs to exclude
      const { data: notInterested } = await (supabase
        .from('follow_up_queue')
        .select('booking_id') as any)
        .not('not_interested_at', 'is', null);
      const notInterestedIds = new Set((notInterested || []).filter((n: any) => n.booking_id).map((n: any) => n.booking_id));

      const { data: runs } = await supabase
        .from('intros_run')
        .select('id, member_name, result, result_canon, linked_intro_booked_id, coach_name, run_date, class_time, lead_source, primary_objection, notes, is_vip')
        .gte('run_date', cutoff)
        .eq('is_vip', false)
        .order('run_date', { ascending: false });

      const { data: bookings } = await supabase
        .from('intros_booked')
        .select('id, member_name, class_date, intro_time, coach_name, lead_source, phone, email, booking_status_canon, originating_booking_id, deleted_at, reschedule_contact_date, booking_type_canon, is_vip, followup_dismissed_at')
        .gte('class_date', cutoff)
        .is('deleted_at', null)
        .is('followup_dismissed_at' as any, null)
        .not('booking_type_canon', 'in', '("VIP","COMP")');

      const { data: touches } = await supabase
        .from('script_actions')
        .select('booking_id, completed_at, action_type, script_category')
        .gte('completed_at', localDateToStartISO(cutoff))
        .order('completed_at', { ascending: false })
        .limit(500);

      if (!runs || !bookings) { setIsLoading(false); return; }

      // Build lookup maps
      const runsByBookingId = new Map<string, typeof runs>();
      for (const r of runs) {
        if (!r.linked_intro_booked_id) continue;
        const arr = runsByBookingId.get(r.linked_intro_booked_id) || [];
        arr.push(r);
        runsByBookingId.set(r.linked_intro_booked_id, arr);
      }

      // Check terminal outcomes across ALL runs for a member name
      const terminalMembers = new Set<string>();
      for (const r of runs) {
        if (isTerminal(r.result)) {
          terminalMembers.add(r.member_name.toLowerCase());
        }
      }

      // Future unrun bookings by member name
      const futureUnrunByName = new Map<string, typeof bookings>();
      for (const b of bookings) {
        if (b.class_date >= today && !runsByBookingId.has(b.id)) {
          const name = b.member_name.toLowerCase();
          const arr = futureUnrunByName.get(name) || [];
          arr.push(b);
          futureUnrunByName.set(name, arr);
        }
      }

      // 2nd intro bookings by originating_booking_id
      const secondIntroByOrigin = new Map<string, (typeof bookings)[0]>();
      for (const b of bookings) {
        if (b.originating_booking_id && !runsByBookingId.has(b.id) && b.class_date >= today) {
          secondIntroByOrigin.set(b.originating_booking_id, b);
        }
      }

      // Touch lookup
      const touchByBooking = new Map<string, { at: string; summary: string }>();
      for (const t of (touches || [])) {
        if (!t.booking_id || touchByBooking.has(t.booking_id)) continue;
        touchByBooking.set(t.booking_id, {
          at: t.completed_at,
          summary: `${t.action_type}${t.script_category ? ` (${t.script_category})` : ''}`,
        });
      }

      const noShow1stItems: FollowUpItem[] = [];
      const noShow2ndItems: FollowUpItem[] = [];
      const didntBuy1stItems: FollowUpItem[] = [];
      const didntBuy2ndItems: FollowUpItem[] = [];
      const plansItems: FollowUpItem[] = [];

      const processed = new Set<string>();
      const plansBookingIds = new Set<string>();

      // Build a map for quick originating booking name lookup
      const bookingById = new Map(bookings.map(b => [b.id, b]));

      const checkIsSecondIntro = (booking: typeof bookings[0] | undefined): boolean => {
        if (!booking?.originating_booking_id) return false;
        const orig = bookingById.get(booking.originating_booking_id);
        return !!orig && orig.member_name.toLowerCase().replace(/\s+/g, '') === booking.member_name.toLowerCase().replace(/\s+/g, '');
      };

      // Process runs for No-Show, Didn't Buy, Plans to Reschedule
      for (const r of runs) {
        const bookingId = r.linked_intro_booked_id;
        if (!bookingId) continue;
        const key = `${r.member_name.toLowerCase()}-${bookingId}`;
        if (processed.has(key)) continue;
        const memberNameLower = r.member_name.toLowerCase();

        // Skip terminal outcomes
        if (terminalMembers.has(memberNameLower)) continue;
        // Skip coach-owned and not-interested bookings
        if (coachOwnedBookingIds.has(bookingId)) continue;
        if (notInterestedIds.has(bookingId)) continue;

        const booking = bookings.find(b => b.id === bookingId);
        const hasFutureUnrun = futureUnrunByName.has(memberNameLower);
        const touch = touchByBooking.get(bookingId);
        const is2nd = checkIsSecondIntro(booking);

        const item: FollowUpItem = {
          bookingId,
          runId: r.id,
          memberName: r.member_name,
          classDate: r.run_date || booking?.class_date || '',
          introTime: r.class_time || booking?.intro_time || null,
          coachName: r.coach_name || booking?.coach_name || null,
          leadSource: r.lead_source || booking?.lead_source || null,
          phone: booking?.phone || null,
          email: booking?.email || null,
          result: r.result,
          resultCanon: r.result_canon,
          isSecondIntro: is2nd,
          originatingBookingId: booking?.originating_booking_id || null,
          rescheduleContactDate: (booking as any)?.reschedule_contact_date || null,
          followUpState: null,
          lastContactAt: touch?.at || null,
          lastContactSummary: touch?.summary || null,
          contactNextDate: null,
          badgeType: undefined,
          followUpType: 'noshow_1st', // will be reassigned below
          transferredFromCoach: transferredMap.get(bookingId) || null,
        };

        // No-Show tab — split by 1st/2nd
        if (r.result_canon === 'NO_SHOW' && !hasFutureUnrun) {
          processed.add(key);
          const fuType: FollowUpType = is2nd ? 'noshow_2nd' : 'noshow_1st';
          item.followUpType = fuType;
          item.contactNextDate = item.rescheduleContactDate || computeContactNext(item.classDate, fuType);
          if (is2nd) {
            noShow2ndItems.push(item);
          } else {
            noShow1stItems.push(item);
          }
          continue;
        }

        // Didn't Buy / Follow-Up Needed
        const isFUNeeded = r.result === 'Follow-up needed' || r.result_canon === 'DIDNT_BUY';
        if (isFUNeeded) {
          if (!secondIntroByOrigin.has(bookingId)) {
            processed.add(key);
            const fuType: FollowUpType = is2nd ? 'didnt_buy_2nd' : 'didnt_buy_1st';
            item.followUpState = is2nd ? 'B' : 'A';
            item.badgeType = is2nd ? 'state_b' : 'follow_up_needed';
            item.followUpType = fuType;
            item.contactNextDate = item.rescheduleContactDate || computeContactNext(item.classDate, fuType);
            if (is2nd) {
              didntBuy2ndItems.push(item);
            } else {
              didntBuy1stItems.push(item);
            }
          }
          continue;
        }

        // State B: 2nd intro ran with non-terminal outcome → Didn't Buy (2nd)
        if (booking?.originating_booking_id && !isTerminal(r.result)) {
          processed.add(key);
          item.followUpState = 'B';
          item.isSecondIntro = true;
          item.badgeType = 'state_b';
          item.followUpType = 'didnt_buy_2nd';
          item.contactNextDate = item.rescheduleContactDate || computeContactNext(item.classDate, 'didnt_buy_2nd');
          didntBuy2ndItems.push(item);
          continue;
        }

        // Plans to Reschedule
        if (r.result === 'Plans to Reschedule' || r.result_canon === 'PLANNING_RESCHEDULE') {
          if (!hasFutureUnrun) {
            processed.add(key);
            plansBookingIds.add(bookingId);
            if (!item.rescheduleContactDate && item.classDate) {
              item.rescheduleContactDate = computeContactNext(item.classDate, 'reschedule');
            }
            item.contactNextDate = item.rescheduleContactDate;
            item.followUpType = 'reschedule';
            plansItems.push(item);
          }
          continue;
        }
      }

      // Process bookings for missed guests (past, no run, no outcome) → Didn't Buy 1st
      for (const b of bookings) {
        if (b.class_date >= today) continue;
        if (runsByBookingId.has(b.id)) continue;
        if (b.originating_booking_id) continue;
        const memberNameLower = b.member_name.toLowerCase();
        if (terminalMembers.has(memberNameLower)) continue;
        const key = `${memberNameLower}-${b.id}`;
        if (processed.has(key)) continue;
        if (futureUnrunByName.has(memberNameLower)) continue;
        if (b.booking_status_canon === 'CANCELLED') continue;
        if (coachOwnedBookingIds.has(b.id)) continue;
        if (notInterestedIds.has(b.id)) continue;

        const touch = touchByBooking.get(b.id);
        processed.add(key);
        didntBuy1stItems.push({
          bookingId: b.id,
          runId: null,
          memberName: b.member_name,
          classDate: b.class_date,
          introTime: b.intro_time || null,
          coachName: b.coach_name,
          leadSource: b.lead_source,
          phone: b.phone,
          email: b.email,
          result: null,
          resultCanon: null,
          isSecondIntro: false,
          originatingBookingId: null,
          rescheduleContactDate: null,
          followUpState: null,
          lastContactAt: touch?.at || null,
          lastContactSummary: touch?.summary || null,
          contactNextDate: computeContactNext(b.class_date, 'didnt_buy_1st'),
          badgeType: 'no_outcome',
          followUpType: 'didnt_buy_1st',
          transferredFromCoach: transferredMap.get(b.id) || null,
        });
      }

      // Unrun 2nd intro bookings → Didn't Buy 1st (they need to show up for their 2nd)
      for (const b of bookings) {
        if (!b.originating_booking_id) continue;
        if (runsByBookingId.has(b.id)) continue;
        const memberNameLower = b.member_name.toLowerCase();
        if (terminalMembers.has(memberNameLower)) continue;
        const key = `2nd-${b.id}`;
        if (processed.has(key)) continue;
        if (coachOwnedBookingIds.has(b.id)) continue;
        if (notInterestedIds.has(b.id)) continue;

        const touch = touchByBooking.get(b.id);
        processed.add(key);
        didntBuy1stItems.push({
          bookingId: b.id,
          runId: null,
          memberName: b.member_name,
          classDate: b.class_date,
          introTime: b.intro_time || null,
          coachName: b.coach_name,
          leadSource: b.lead_source,
          phone: b.phone,
          email: b.email,
          result: null,
          resultCanon: null,
          isSecondIntro: true,
          originatingBookingId: b.originating_booking_id,
          rescheduleContactDate: null,
          followUpState: null,
          lastContactAt: touch?.at || null,
          lastContactSummary: touch?.summary || null,
          contactNextDate: b.class_date < today ? computeContactNext(b.class_date, 'didnt_buy_1st') : null,
          badgeType: undefined,
          followUpType: 'didnt_buy_1st',
          transferredFromCoach: transferredMap.get(b.id) || null,
        });
      }

      // Process bookings for Plans to Reschedule (booking-status-based)
      const inRescheduleTab = new Set<string>(plansBookingIds);
      for (const b of bookings) {
        if (b.booking_status_canon !== 'PLANNING_RESCHEDULE') continue;
        if (plansBookingIds.has(b.id)) { inRescheduleTab.add(b.id); continue; }
        const memberNameLower = b.member_name.toLowerCase();
        if (terminalMembers.has(memberNameLower)) continue;
        const key = `plan-${b.id}`;
        if (processed.has(key)) continue;
        if (futureUnrunByName.has(memberNameLower)) continue;
        if (coachOwnedBookingIds.has(b.id)) continue;
        if (notInterestedIds.has(b.id)) continue;

        const touch = touchByBooking.get(b.id);
        let contactDate = (b as any).reschedule_contact_date;
        if (!contactDate && b.class_date) {
          contactDate = computeContactNext(b.class_date, 'reschedule');
        }

        processed.add(key);
        inRescheduleTab.add(b.id);
        plansItems.push({
          bookingId: b.id,
          runId: null,
          memberName: b.member_name,
          classDate: b.class_date,
          introTime: b.intro_time || null,
          coachName: b.coach_name,
          leadSource: b.lead_source,
          phone: b.phone,
          email: b.email,
          result: null,
          resultCanon: null,
          isSecondIntro: false,
          originatingBookingId: null,
          rescheduleContactDate: contactDate,
          followUpState: null,
          lastContactAt: touch?.at || null,
          lastContactSummary: touch?.summary || null,
          contactNextDate: contactDate,
          badgeType: undefined,
          followUpType: 'reschedule',
          transferredFromCoach: transferredMap.get(b.id) || null,
        });
      }

      // Remove didntBuy1st items that are also in reschedule tab
      const dedupedDidntBuy1st = didntBuy1stItems.filter(item => !inRescheduleTab.has(item.bookingId));

      const sortByDate = (a: FollowUpItem, b: FollowUpItem) =>
        b.classDate.localeCompare(a.classDate);

      // 7-day cooling filter
      const COOLING_HOURS = 7 * 24;
      const splitCooling = (items: FollowUpItem[]) => {
        const active: FollowUpItem[] = [];
        const cooling: FollowUpItem[] = [];
        for (const item of items) {
          if (item.lastContactAt) {
            const hoursSince = differenceInHours(new Date(), new Date(item.lastContactAt));
            if (hoursSince < COOLING_HOURS) {
              cooling.push(item);
              continue;
            }
          }
          active.push(item);
        }
        return { active: active.sort(sortByDate), cooling: cooling.sort(sortByDate) };
      };

      const ns1 = splitCooling(noShow1stItems);
      const ns2 = splitCooling(noShow2ndItems);
      const db1 = splitCooling(dedupedDidntBuy1st);
      const db2 = splitCooling(didntBuy2ndItems);
      const plansSplit = splitCooling(plansItems);

      setNoShow1st(ns1.active);
      setNoShow1stCooling(ns1.cooling);
      setNoShow2nd(ns2.active);
      setNoShow2ndCooling(ns2.cooling);
      setDidntBuy1st(db1.active);
      setDidntBuy1stCooling(db1.cooling);
      setDidntBuy2nd(db2.active);
      setDidntBuy2ndCooling(db2.cooling);
      setPlansToReschedule(plansSplit.active);
      setPlansToRescheduleCooling(plansSplit.cooling);
    } catch (err) {
      console.error('Follow-up data fetch error:', err);
    } finally {
      setIsLoading(false);
      isFirstLoad.current = false;
    }
  }, []);

  const silentRefresh = useCallback(() => fetchData(true), [fetchData]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const counts = useMemo(() => ({
    noShow1st: noShow1st.length,
    noShow2nd: noShow2nd.length,
    didntBuy1st: didntBuy1st.length,
    didntBuy2nd: didntBuy2nd.length,
    plansToReschedule: plansToReschedule.length,
    total: noShow1st.length + noShow2nd.length + didntBuy1st.length + didntBuy2nd.length + plansToReschedule.length,
  }), [noShow1st, noShow2nd, didntBuy1st, didntBuy2nd, plansToReschedule]);

  const allItems = useMemo(() => [
    ...noShow1st, ...noShow1stCooling,
    ...noShow2nd, ...noShow2ndCooling,
    ...didntBuy1st, ...didntBuy1stCooling,
    ...didntBuy2nd, ...didntBuy2ndCooling,
    ...plansToReschedule, ...plansToRescheduleCooling,
  ], [noShow1st, noShow1stCooling, noShow2nd, noShow2ndCooling, didntBuy1st, didntBuy1stCooling, didntBuy2nd, didntBuy2ndCooling, plansToReschedule, plansToRescheduleCooling]);

  return {
    noShow1st, noShow1stCooling,
    noShow2nd, noShow2ndCooling,
    didntBuy1st, didntBuy1stCooling,
    didntBuy2nd, didntBuy2ndCooling,
    plansToReschedule, plansToRescheduleCooling,
    allItems,
    counts,
    isLoading,
    refresh: fetchData,
    silentRefresh,
  };
}
