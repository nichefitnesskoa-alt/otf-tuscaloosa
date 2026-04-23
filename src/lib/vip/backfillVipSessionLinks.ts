/**
 * Backfill helper: auto-link unlinked VIP-source intro bookings to their VIP session.
 *
 * Safety: only Tier 1 (registration name/phone/email match) results are persisted.
 * Tiers 2/3 (date proximity, most-recent) are intentionally NOT auto-saved here —
 * those remain user-confirmed via the existing picker UI.
 *
 * All writes stamped with last_edited_by = 'auto-vip-detect' for audit/reversal.
 */
import { supabase } from '@/integrations/supabase/client';
import { detectVipSessionForBooking } from './detectVipSessionForBooking';
import { format, subDays } from 'date-fns';

const sb = supabase as any;

interface BackfillOptions {
  /** Look-back window in days (default 60). */
  sinceDays?: number;
  /** Optional max rows to scan in this run (safety cap). */
  maxRows?: number;
}

export interface BackfillResult {
  scanned: number;
  linked: number;
  suggestionsOnly: number;
}

const isVipSource = (s: string | null | undefined) =>
  !!s && (s === 'VIP Class' || s === 'VIP Class (Friend)' || s.toLowerCase().startsWith('vip class'));

export async function backfillVipSessionLinks(opts: BackfillOptions = {}): Promise<BackfillResult> {
  const sinceDays = opts.sinceDays ?? 60;
  const maxRows = opts.maxRows ?? 500;
  const sinceYmd = format(subDays(new Date(), sinceDays), 'yyyy-MM-dd');

  const { data: rows, error } = await sb
    .from('intros_booked')
    .select('id, member_name, phone, email, class_date, vip_class_name, lead_source')
    .is('deleted_at', null)
    .is('vip_session_id', null)
    .gte('class_date', sinceYmd)
    .order('class_date', { ascending: false })
    .limit(maxRows);

  if (error || !rows) {
    return { scanned: 0, linked: 0, suggestionsOnly: 0 };
  }

  // Filter to VIP-source rows in JS (lead_source can vary in case/spacing)
  const vipRows = rows.filter((r: any) => isVipSource(r.lead_source));

  let linked = 0;
  let suggestionsOnly = 0;

  // Process in batches of 25 with awaits to avoid hammering DB
  const BATCH = 25;
  for (let i = 0; i < vipRows.length; i += BATCH) {
    const batch = vipRows.slice(i, i + BATCH);
    await Promise.all(batch.map(async (r: any) => {
      try {
        const det = await detectVipSessionForBooking({
          member_name: r.member_name,
          phone: r.phone,
          email: r.email,
          class_date: r.class_date,
          vip_class_name: r.vip_class_name,
        });
        if (det.sessionId && det.autoSave) {
          // Look up class name to keep vip_class_name in sync
          const { data: sess } = await sb
            .from('vip_sessions')
            .select('reserved_by_group, vip_class_name')
            .eq('id', det.sessionId)
            .maybeSingle();
          const className = sess?.reserved_by_group || sess?.vip_class_name || null;

          const { error: updErr } = await sb
            .from('intros_booked')
            .update({
              vip_session_id: det.sessionId,
              vip_class_name: className,
              last_edited_at: new Date().toISOString(),
              last_edited_by: 'auto-vip-detect',
            })
            .eq('id', r.id)
            .is('vip_session_id', null); // guard: never overwrite manual links
          if (!updErr) linked++;
        } else if (det.sessionId) {
          suggestionsOnly++;
        }
      } catch {
        /* swallow per-row errors so one bad row doesn't kill the batch */
      }
    }));
  }

  return { scanned: vipRows.length, linked, suggestionsOnly };
}
