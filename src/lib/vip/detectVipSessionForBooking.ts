/**
 * Auto-detect best-match VIP session for a booking.
 *
 * Priority:
 *   1. Exact registration match (name / phone / email) → safe to auto-save.
 *   2. Class-date proximity (most recent session ≤ class_date), optionally matching vip_class_name → suggest only.
 *   3. Most recent VIP session overall → suggest only.
 *
 * Tier 1 returns { sessionId, autoSave: true }.
 * Tiers 2/3 return { sessionId, autoSave: false } so the picker pre-selects it
 * but waits for user confirmation.
 */
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

export interface DetectVipInput {
  member_name: string;
  phone?: string | null;
  email?: string | null;
  class_date: string; // YYYY-MM-DD
  vip_class_name?: string | null;
}

export interface DetectVipResult {
  sessionId: string | null;
  autoSave: boolean;
  reason: 'registration' | 'date-proximity' | 'most-recent' | 'none';
}

const norm = (s: string | null | undefined) => (s || '').trim().toLowerCase();
const digits = (s: string | null | undefined) => (s || '').replace(/\D/g, '');

export async function detectVipSessionForBooking(input: DetectVipInput): Promise<DetectVipResult> {
  const memberNorm = norm(input.member_name);
  const phoneDigits = digits(input.phone);
  const emailNorm = norm(input.email);

  // Tier 1: registration match
  try {
    const { data: regs } = await sb
      .from('vip_registrations')
      .select('vip_session_id, first_name, last_name, phone, email')
      .not('vip_session_id', 'is', null);

    if (regs && regs.length > 0) {
      const match = regs.find((r: any) => {
        const fullName = norm(`${r.first_name || ''} ${r.last_name || ''}`);
        if (memberNorm && fullName === memberNorm) return true;
        if (phoneDigits && digits(r.phone).slice(-10) === phoneDigits.slice(-10) && phoneDigits.length >= 10) return true;
        if (emailNorm && norm(r.email) === emailNorm) return true;
        return false;
      });
      if (match?.vip_session_id) {
        return { sessionId: match.vip_session_id, autoSave: true, reason: 'registration' };
      }
    }
  } catch { /* ignore */ }

  // Tier 2: date proximity (+ optional class name match)
  try {
    let query = sb
      .from('vip_sessions')
      .select('id, reserved_by_group, vip_class_name, session_date')
      .lte('session_date', input.class_date)
      .order('session_date', { ascending: false })
      .limit(10);

    const { data: sessions } = await query;
    if (sessions && sessions.length > 0) {
      const className = norm(input.vip_class_name);
      if (className) {
        const nameMatch = sessions.find((s: any) =>
          norm(s.reserved_by_group) === className || norm(s.vip_class_name) === className,
        );
        if (nameMatch) return { sessionId: nameMatch.id, autoSave: false, reason: 'date-proximity' };
      }
      return { sessionId: sessions[0].id, autoSave: false, reason: 'date-proximity' };
    }
  } catch { /* ignore */ }

  // Tier 3: most recent overall
  try {
    const { data: recent } = await sb
      .from('vip_sessions')
      .select('id')
      .order('session_date', { ascending: false })
      .limit(1);
    if (recent && recent.length > 0) {
      return { sessionId: recent[0].id, autoSave: false, reason: 'most-recent' };
    }
  } catch { /* ignore */ }

  return { sessionId: null, autoSave: false, reason: 'none' };
}
