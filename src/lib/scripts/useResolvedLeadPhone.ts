/**
 * Shared phone resolver for script-sending surfaces (ScriptSendDrawer,
 * MessageGenerator / ScriptPickerSheet). The RingCentral deep-link and any
 * other phone-dependent UI must resolve the lead's phone in the same order
 * everywhere so surfaces cannot silently diverge:
 *
 *   1. `leadPhoneProp` — the phone the calling surface already renders. Wins
 *      when present. This is the source of truth: if the card displays a
 *      number and its Copy # button works, that same value drives the deep
 *      link. No refetch race, no id mismatch.
 *   2. `bookingId` → intros_booked.phone_e164 || phone (DB fallback).
 *   3. `leadId`    → leads.phone_e164 || phone (DB fallback).
 *
 * Any surface that opens a script dialog and already has the phone in hand
 * MUST pass it via `leadPhoneProp`. The DB fallbacks exist only for legacy
 * surfaces that pass only an id.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useResolvedLeadPhone(
  open: boolean,
  leadPhoneProp: string | null | undefined,
  bookingId: string | null | undefined,
  leadId: string | null | undefined,
): string | null {
  const [resolved, setResolved] = useState<string | null>(leadPhoneProp || null);

  useEffect(() => {
    let cancelled = false;
    if (!open) { setResolved(null); return; }
    // Surface wins — no fetch needed when the caller already has the phone.
    if (leadPhoneProp) { setResolved(leadPhoneProp); return; }
    setResolved(null);
    (async () => {
      if (bookingId) {
        const { data } = await supabase
          .from('intros_booked')
          .select('phone, phone_e164')
          .eq('id', bookingId)
          .maybeSingle();
        const p = (data as any)?.phone_e164 || (data as any)?.phone || null;
        if (!cancelled && p) { setResolved(p); return; }
      }
      if (leadId) {
        const { data } = await supabase
          .from('leads')
          .select('phone, phone_e164')
          .eq('id', leadId)
          .maybeSingle();
        const p = (data as any)?.phone_e164 || (data as any)?.phone || null;
        if (!cancelled) setResolved(p || null);
      }
    })();
    return () => { cancelled = true; };
  }, [open, leadPhoneProp, bookingId, leadId]);

  return resolved;
}
