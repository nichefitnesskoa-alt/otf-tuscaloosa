/**
 * Follow-Up data hook — queries intros_run + intros_booked to build 4 follow-up arrays.
 *
 * Tab 1: No-Show — result_canon = 'NO_SHOW' OR past booking with no run. Exclude future unrun bookings.
 * Tab 2: Follow-Up Needed — result = 'Follow-up needed' AND no future 2nd intro. OR 2nd intro ran non-terminal.
 * Tab 3: 2nd Intro — originating_booking_id IS NOT NULL AND no matching run.
 * Tab 4: Plans to Reschedule — booking_status_canon = 'PLANNING_RESCHEDULE' AND no future booking.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, subDays } from 'date-fns';
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
}

const TERMINAL_OUTCOMES = ['Purchased', 'Not Interested'];
const PURCHASE_RESULTS = ['Premier', 'Elite', 'Basic', 'Premier + OTbeat', 'Elite + OTbeat', 'Basic + OTbeat'];

function isTerminal(result: string | null): boolean {
  if (!result) return false;
  if (TERMINAL_OUTCOMES.includes(result)) return true;
  return PURCHASE_RESULTS.some(p => result.includes(p));
}

export function useFollowUpData() {
  const [noShow, setNoShow] = useState<FollowUpItem[]>([]);
  const [missedGuest, setMissedGuest] = useState<FollowUpItem[]>([]);
  const [followUpNeeded, setFollowUpNeeded] = useState<FollowUpItem[]>([]);
  const [secondIntro, setSecondIntro] = useState<FollowUpItem[]>([]);
  const [plansToReschedule, setPlansToReschedule] = useState<FollowUpItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const cutoff = format(subDays(new Date(), 90), 'yyyy-MM-dd');

      // Fetch all runs in last 90 days (exclude VIP)
      const { data: runs } = await supabase
        .from('intros_run')
        .select('id, member_name, result, result_canon, linked_intro_booked_id, coach_name, run_date, class_time, lead_source, primary_objection, notes, is_vip')
        .gte('run_date', cutoff)
        .eq('is_vip', false)
        .order('run_date', { ascending: false });

      // Fetch all bookings in last 90 days (exclude VIP/COMP)
      const { data: bookings } = await supabase
        .from('intros_booked')
        .select('id, member_name, class_date, intro_time, coach_name, lead_source, phone, email, booking_status_canon, originating_booking_id, deleted_at, reschedule_contact_date, booking_type_canon, is_vip')
        .gte('class_date', cutoff)
        .is('deleted_at', null)
        .not('booking_type_canon', 'in', '("VIP","COMP")');

      // Fetch recent touches for last contact info
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

      // Future unrun bookings by member name (for exclusion)
      const futureUnrunByName = new Map<string, typeof bookings>();
      for (const b of bookings) {
        if (b.class_date >= today && !runsByBookingId.has(b.id)) {
          const name = b.member_name.toLowerCase();
          const arr = futureUnrunByName.get(name) || [];
          arr.push(b);
          futureUnrunByName.set(name, arr);
        }
      }

      // 2nd intro bookings (unrun) by originating_booking_id
      const secondIntroByOrigin = new Map<string, (typeof bookings)[0]>();
      for (const b of bookings) {
        if (b.originating_booking_id && !runsByBookingId.has(b.id) && b.class_date >= today) {
          secondIntroByOrigin.set(b.originating_booking_id, b);
        }
      }

      // Touch lookup by booking_id
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
      const fuNeededItems: FollowUpItem[] = [];
      const secondIntroItems: FollowUpItem[] = [];
      const plansItems: FollowUpItem[] = [];

      // Track processed member names to avoid duplicates
      const processed = new Set<string>();

      // Process runs for No-Show and Follow-Up Needed
      for (const r of runs) {
        const bookingId = r.linked_intro_booked_id;
        if (!bookingId) continue;
        const key = `${r.member_name.toLowerCase()}-${bookingId}`;
        if (processed.has(key)) continue;

        const booking = bookings.find(b => b.id === bookingId);
        const memberNameLower = r.member_name.toLowerCase();
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
        };

        // No-Show tab
        if (r.result_canon === 'NO_SHOW' && !hasFutureUnrun) {
          processed.add(key);
          noShowItems.push(item);
          continue;
        }

        // Follow-Up Needed tab
        const isFUNeeded = r.result === 'Follow-up needed' || r.result_canon === 'DIDNT_BUY';
        if (isFUNeeded) {
          // Check if 2nd intro already booked (unrun)
          if (secondIntroByOrigin.has(bookingId)) {
            // State C: auto-moves to 2nd Intro tab — skip here
          } else {
            processed.add(key);
            item.followUpState = 'A';
            fuNeededItems.push(item);
          }
          continue;
        }

        // State B: 2nd intro ran with non-terminal outcome
        if (booking?.originating_booking_id && !isTerminal(r.result)) {
          processed.add(key);
          item.followUpState = 'B';
          item.isSecondIntro = true;
          fuNeededItems.push(item);
          continue;
        }

        // Plans to Reschedule (from run result)
        if (r.result === 'Plans to Reschedule' || r.result_canon === 'PLANNING_RESCHEDULE') {
          if (!hasFutureUnrun) {
            processed.add(key);
            // Default contact date: 2 days after class
            if (!item.rescheduleContactDate && item.classDate) {
              try {
                const d = new Date(item.classDate + 'T12:00:00');
                d.setDate(d.getDate() + 2);
                item.rescheduleContactDate = format(d, 'yyyy-MM-dd');
              } catch {}
            }
            plansItems.push(item);
          }
          continue;
        }
      }

      // Process bookings for missed guests (past, no run, no outcome)
      for (const b of bookings) {
        if (b.class_date >= today) continue; // not past
        if (runsByBookingId.has(b.id)) continue; // has a run
        if (b.originating_booking_id) continue; // 2nd intro booking handled separately
        const memberNameLower = b.member_name.toLowerCase();
        const key = `${memberNameLower}-${b.id}`;
        if (processed.has(key)) continue;
        if (futureUnrunByName.has(memberNameLower)) continue;
        if (b.booking_status_canon === 'CANCELLED') continue;

        const touch = touchByBooking.get(b.id);
        const item: FollowUpItem = {
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
        };
        processed.add(key);
        missedGuestItems.push(item);
      }

      // Process bookings for 2nd Intro tab (unrun 2nd intro bookings)
      for (const b of bookings) {
        if (!b.originating_booking_id) continue;
        if (runsByBookingId.has(b.id)) continue; // already ran
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
        });
      }

      // Process bookings for Plans to Reschedule (by booking status)
      for (const b of bookings) {
        if (b.booking_status_canon !== 'PLANNING_RESCHEDULE') continue;
        const memberNameLower = b.member_name.toLowerCase();
        const key = `plan-${b.id}`;
        if (processed.has(key)) continue;
        if (futureUnrunByName.has(memberNameLower)) continue;

        const touch = touchByBooking.get(b.id);
        let contactDate = (b as any).reschedule_contact_date;
        if (!contactDate && b.class_date) {
          try {
            const d = new Date(b.class_date + 'T12:00:00');
            d.setDate(d.getDate() + 2);
            contactDate = format(d, 'yyyy-MM-dd');
          } catch {}
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
        });
      }

      // Sort all by class date descending (most recent first)
      const sortByDate = (a: FollowUpItem, b: FollowUpItem) =>
        b.classDate.localeCompare(a.classDate);

      setNoShow(noShowItems.sort(sortByDate));
      setMissedGuest(missedGuestItems.sort(sortByDate));
      setFollowUpNeeded(fuNeededItems.sort(sortByDate));
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
    missedGuest: missedGuest.length,
    followUpNeeded: followUpNeeded.length,
    secondIntro: secondIntro.length,
    plansToReschedule: plansToReschedule.length,
    total: noShow.length + missedGuest.length + followUpNeeded.length + secondIntro.length + plansToReschedule.length,
  }), [noShow, missedGuest, followUpNeeded, secondIntro, plansToReschedule]);

  return {
    noShow,
    missedGuest,
    followUpNeeded,
    secondIntro,
    plansToReschedule,
    counts,
    isLoading,
    refresh: fetchData,
  };
}
