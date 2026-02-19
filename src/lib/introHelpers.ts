/**
 * Shared helpers for 1st/2nd intro detection and questionnaire auto-creation.
 * ALL surfaces must use isSecondIntro() from here — no scattered inline logic.
 */
import { supabase } from '@/integrations/supabase/client';
import { generateUniqueSlug } from '@/lib/utils';

// ─── 2nd Intro Detection ──────────────────────────────────────────────────────

/**
 * Returns true if the given bookingId is a 2nd (or later) intro visit.
 * Checks originating_booking_id first (definitive), then falls back to
 * name/phone matching across all provided bookings.
 */
export function isSecondIntroFromList(
  bookingId: string,
  allBookings: Array<{
    id: string;
    member_name: string;
    originating_booking_id?: string | null;
    class_date: string;
    created_at?: string;
    is_vip?: boolean | null;
    phone?: string | null;
    phone_e164?: string | null;
  }>
): boolean {
  const booking = allBookings.find(b => b.id === bookingId);
  if (!booking) return false;
  if (booking.is_vip) return false;
  // Definitive: has originating link
  if (booking.originating_booking_id) return true;

  const nonVip = allBookings.filter(b => !b.is_vip);

  // Name-based grouping
  const nameKey = booking.member_name.toLowerCase().replace(/\s+/g, '');
  const nameGroup = nonVip.filter(b => b.member_name.toLowerCase().replace(/\s+/g, '') === nameKey);

  // Phone-based grouping
  const rawPhone = (booking.phone_e164 || booking.phone || '').replace(/\D/g, '');
  const phoneGroup = rawPhone.length >= 7
    ? nonVip.filter(b => {
        const bp = ((b.phone_e164 || b.phone || '') as string).replace(/\D/g, '');
        return bp.length >= 7 && bp === rawPhone;
      })
    : [];

  // Merge unique
  const seen = new Set<string>();
  const combined: typeof nonVip = [];
  for (const b of [...nameGroup, ...phoneGroup]) {
    if (!seen.has(b.id)) { seen.add(b.id); combined.push(b); }
  }

  if (combined.length <= 1) return false;

  const sorted = [...combined].sort((a, c) => {
    const d = a.class_date.localeCompare(c.class_date);
    if (d !== 0) return d;
    return (a.created_at || '').localeCompare(c.created_at || '');
  });

  return sorted[0].id !== bookingId;
}

/**
 * Async helper: given a bookingId, looks up the person's prior booking
 * and returns the most recent completed questionnaire from it (for Prep).
 */
export async function fetchPriorVisitQuestionnaire(
  bookingId: string
): Promise<{
  questionnaire: {
    q1_fitness_goal: string | null;
    q2_fitness_level: number | null;
    q3_obstacle: string | null;
    q4_past_experience: string | null;
    q5_emotional_driver: string | null;
    q6_weekly_commitment: string | null;
    q6b_available_days: string | null;
    q7_coach_notes: string | null;
    status: string;
    last_opened_at: string | null;
  } | null;
  priorClassDate: string | null;
} | null> {
  // Fetch the current booking
  const { data: booking } = await supabase
    .from('intros_booked')
    .select('member_name, class_date, originating_booking_id, phone_e164, phone')
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking) return null;

  const isSecond = !!booking.originating_booking_id;
  if (!isSecond) return null;

  // Get the prior booking's questionnaire
  if (booking.originating_booking_id) {
    const { data: priorBooking } = await supabase
      .from('intros_booked')
      .select('id, class_date')
      .eq('id', booking.originating_booking_id)
      .maybeSingle();

    if (priorBooking) {
      const { data: qs } = await supabase
        .from('intro_questionnaires')
        .select('q1_fitness_goal, q2_fitness_level, q3_obstacle, q4_past_experience, q5_emotional_driver, q6_weekly_commitment, q6b_available_days, q7_coach_notes, status, last_opened_at')
        .eq('booking_id', priorBooking.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return { questionnaire: (qs as any) || null, priorClassDate: priorBooking.class_date };
    }
  }

  return { questionnaire: null, priorClassDate: null };
}

// ─── Auto-create questionnaire record ────────────────────────────────────────

/**
 * Silently creates an intro_questionnaires record for a new booking if one doesn't exist yet.
 * Generates a proper slug. Fire-and-forget safe.
 */
export async function autoCreateQuestionnaire(params: {
  bookingId: string;
  memberName: string;
  classDate: string;
}): Promise<void> {
  const { bookingId, memberName, classDate } = params;

  // Check if one already exists
  const { data: existing } = await supabase
    .from('intro_questionnaires')
    .select('id')
    .eq('booking_id', bookingId)
    .maybeSingle();

  if (existing) return; // Already exists

  // Parse name
  const parts = memberName.trim().split(/\s+/);
  const firstName = parts[0] || memberName;
  const lastName = parts.slice(1).join(' ') || '';

  const slug = await generateUniqueSlug(firstName, lastName, supabase, undefined, classDate);

  await supabase.from('intro_questionnaires').insert({
    booking_id: bookingId,
    client_first_name: firstName,
    client_last_name: lastName,
    scheduled_class_date: classDate,
    status: 'not_sent',
    slug,
  });
}
