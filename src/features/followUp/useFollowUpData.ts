/**
 * Follow-Up data hook — queries intros_run + intros_booked to build 4 follow-up arrays.
 *
 * Tab 1: No-Show — result_canon = 'NO_SHOW'.
 * Tab 2: Missed Guests — merged missed guest (no outcome, past) + follow-up needed.
 * Tab 3: 2nd Intro — originating_booking_id IS NOT NULL AND no matching run.
 * Tab 4: Plans to Reschedule — booking_status_canon = 'PLANNING_RESCHEDULE' AND no future booking.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, subDays, addDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

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
  /** For Follow-Up Needed: A = no 2nd booked, B = 2nd ran non-terminal */
  followUpState: 'A' | 'B' | null;
  /** Last touch info */
  lastContactAt: string | null;
  lastContactSummary: string | null;
  /** Contact next date */
  contactNextDate: string | null;
  /** Badge type for merged tab */
  badgeType?: 'no_outcome' | 'follow_up_needed' | 'state_b';
}

const TERMINAL_OUTCOMES = ['Purchased', 'Not Interested'];
const PURCHASE_RESULTS = ['Premier', 'Elite', 'Basic', 'Premier + OTbeat', 'Elite + OTbeat', 'Basic + OTbeat'];

function isTerminal(result: string | null): boolean {
  if (!result) return false;
  if (TERMINAL_OUTCOMES.includes(result)) return true;
  return PURCHASE_RESULTS.some(p => result.includes(p));
}

function computeContactNext(classDate: string, type: 'noshow' | 'missed' | 'secondintro' | 'reschedule'): string | null {
  try {
    const d = new Date(classDate + 'T12:00:00');
    switch (type) {
      case 'noshow':
        return format(addDays(d, 1), 'yyyy-MM-dd');
      case 'missed':
        return format(addDays(d, 3), 'yyyy-MM-dd');
      case 'secondintro':
        return format(addDays(d, 1), 'yyyy-MM-dd');
      case 'reschedule':
        return format(addDays(d, 2), 'yyyy-MM-dd');
    }
  } catch { return null; }
}

export function useFollowUpData() {
  const [noShow, setNoShow] = useState<FollowUpItem[]>([]);
  const [missedGuests, setMissedGuests] = useState<FollowUpItem[]>([]);
  const [secondIntro, setSecondIntro] = useState<FollowUpItem[]>([]);
  const [plansToReschedule, setPlansToReschedule] = useState<FollowUpItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const cutoff = format(subDays(new Date(), 90), 'yyyy-MM-dd');

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
        .gte('completed_at', cutoff + 'T00:00:00')
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

      const noShowItems: FollowUpItem[] = [];
      const missedGuestItems: FollowUpItem[] = [];
      const secondIntroItems: FollowUpItem[] = [];
      const plansItems: FollowUpItem[] = [];

      const processed = new Set<string>();
      // Track names in 2nd intro tab for priority dedup
      const inSecondIntroTab = new Set<string>();

      // First pass: collect 2nd intro tab members
      for (const b of bookings) {
        if (b.originating_booking_id && !runsByBookingId.has(b.id)) {
          inSecondIntroTab.add(b.member_name.toLowerCase());
        }
      }

      // Process runs for No-Show, Missed Guests (follow-up needed), Plans to Reschedule
      for (const r of runs) {
        const bookingId = r.linked_intro_booked_id;
        if (!bookingId) continue;
        const key = `${r.member_name.toLowerCase()}-${bookingId}`;
        if (processed.has(key)) continue;
        const memberNameLower = r.member_name.toLowerCase();

        // Skip terminal outcomes
        if (terminalMembers.has(memberNameLower)) continue;

        const booking = bookings.find(b => b.id === bookingId);
        const hasFutureUnrun = futureUnrunByName.has(memberNameLower);
        const touch = touchByBooking.get(bookingId);

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
          isSecondIntro: !!booking?.originating_booking_id,
          originatingBookingId: booking?.originating_booking_id || null,
          rescheduleContactDate: (booking as any)?.reschedule_contact_date || null,
          followUpState: null,
          lastContactAt: touch?.at || null,
          lastContactSummary: touch?.summary || null,
          contactNextDate: null,
          badgeType: undefined,
        };

        // No-Show tab
        if (r.result_canon === 'NO_SHOW' && !hasFutureUnrun) {
          processed.add(key);
          item.contactNextDate = item.rescheduleContactDate || computeContactNext(item.classDate, 'noshow');
          noShowItems.push(item);
          continue;
        }

        // Follow-Up Needed → merged into Missed Guests tab
        const isFUNeeded = r.result === 'Follow-up needed' || r.result_canon === 'DIDNT_BUY';
        if (isFUNeeded) {
          if (secondIntroByOrigin.has(bookingId)) {
            // Auto-moves to 2nd Intro tab
          } else if (!inSecondIntroTab.has(memberNameLower)) {
            processed.add(key);
            item.followUpState = 'A';
            item.badgeType = 'follow_up_needed';
            item.contactNextDate = item.rescheduleContactDate || computeContactNext(item.classDate, 'missed');
            missedGuestItems.push(item);
          }
          continue;
        }

        // State B: 2nd intro ran with non-terminal outcome → merged into Missed Guests
        if (booking?.originating_booking_id && !isTerminal(r.result)) {
          if (!inSecondIntroTab.has(memberNameLower)) {
            processed.add(key);
            item.followUpState = 'B';
            item.isSecondIntro = true;
            item.badgeType = 'state_b';
            item.contactNextDate = item.rescheduleContactDate || computeContactNext(item.classDate, 'secondintro');
            missedGuestItems.push(item);
          }
          continue;
        }

        // Plans to Reschedule
        if (r.result === 'Plans to Reschedule' || r.result_canon === 'PLANNING_RESCHEDULE') {
          if (!hasFutureUnrun) {
            processed.add(key);
            if (!item.rescheduleContactDate && item.classDate) {
              item.rescheduleContactDate = computeContactNext(item.classDate, 'reschedule');
            }
            item.contactNextDate = item.rescheduleContactDate;
            plansItems.push(item);
          }
          continue;
        }
      }

      // Process bookings for missed guests (past, no run, no outcome)
      for (const b of bookings) {
        if (b.class_date >= today) continue;
        if (runsByBookingId.has(b.id)) continue;
        if (b.originating_booking_id) continue;
        const memberNameLower = b.member_name.toLowerCase();
        if (terminalMembers.has(memberNameLower)) continue;
        if (inSecondIntroTab.has(memberNameLower)) continue;
        const key = `${memberNameLower}-${b.id}`;
        if (processed.has(key)) continue;
        if (futureUnrunByName.has(memberNameLower)) continue;
        if (b.booking_status_canon === 'CANCELLED') continue;

        const touch = touchByBooking.get(b.id);
        processed.add(key);
        missedGuestItems.push({
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
          contactNextDate: computeContactNext(b.class_date, 'missed'),
          badgeType: 'no_outcome',
        });
      }

      // Process bookings for 2nd Intro tab
      for (const b of bookings) {
        if (!b.originating_booking_id) continue;
        if (runsByBookingId.has(b.id)) continue;
        const memberNameLower = b.member_name.toLowerCase();
        if (terminalMembers.has(memberNameLower)) continue;
        const key = `2nd-${b.id}`;
        if (processed.has(key)) continue;

        const touch = touchByBooking.get(b.id);
        processed.add(key);
        secondIntroItems.push({
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
          contactNextDate: b.class_date < today ? computeContactNext(b.class_date, 'secondintro') : null,
          badgeType: undefined,
        });
      }

      // Process bookings for Plans to Reschedule
      for (const b of bookings) {
        if (b.booking_status_canon !== 'PLANNING_RESCHEDULE') continue;
        const memberNameLower = b.member_name.toLowerCase();
        if (terminalMembers.has(memberNameLower)) continue;
        const key = `plan-${b.id}`;
        if (processed.has(key)) continue;
        if (futureUnrunByName.has(memberNameLower)) continue;

        const touch = touchByBooking.get(b.id);
        let contactDate = (b as any).reschedule_contact_date;
        if (!contactDate && b.class_date) {
          contactDate = computeContactNext(b.class_date, 'reschedule');
        }

        processed.add(key);
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
        });
      }

      const sortByDate = (a: FollowUpItem, b: FollowUpItem) =>
        b.classDate.localeCompare(a.classDate);

      setNoShow(noShowItems.sort(sortByDate));
      setMissedGuests(missedGuestItems.sort(sortByDate));
      setSecondIntro(secondIntroItems.sort(sortByDate));
      setPlansToReschedule(plansItems.sort(sortByDate));
    } catch (err) {
      console.error('Follow-up data fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const counts = useMemo(() => ({
    noShow: noShow.length,
    missedGuests: missedGuests.length,
    secondIntro: secondIntro.length,
    plansToReschedule: plansToReschedule.length,
    total: noShow.length + missedGuests.length + secondIntro.length + plansToReschedule.length,
  }), [noShow, missedGuests, secondIntro, plansToReschedule]);

  return {
    noShow,
    missedGuests,
    secondIntro,
    plansToReschedule,
    counts,
    isLoading,
    refresh: fetchData,
  };
}
