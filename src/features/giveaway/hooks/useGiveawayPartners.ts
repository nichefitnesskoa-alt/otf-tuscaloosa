import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GiveawayPartner {
  id: string;
  studio_slug: string;
  partner_name: string;
  partner_ig_handle: string | null;
  receipt_instructions: string | null;
  prize_description: string | null;
  prize_count: number;
  /** Optional per-winner prize labels. When set, length must equal prize_count
   *  and each slot's label is used in PrizeShowcase + DrawWinner. When null,
   *  every slot falls back to prize_description (legacy / single-prize). */
  prize_labels: string[] | null;
  display_order: number;
  created_at: string;
}

export interface PartnerInput {
  partner_name: string;
  partner_ig_handle: string | null;
  receipt_instructions: string | null;
  prize_description: string | null;
  prize_count: number;
  prize_labels: string[] | null;
}

function clampPrizeCount(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 1;
  return Math.max(1, Math.min(10, Math.round(v)));
}

/** Normalize the prize_labels/prize_description pair for write.
 *  - prize_count === 1 → no labels array; description = single value (trimmed).
 *  - prize_count >  1 → labels array of length prize_count (trimmed, blanks
 *    fall back to provided description); description mirrors labels[0] so
 *    legacy readers / admin badges stay coherent. */
function normalizeLabels(
  count: number,
  description: string | null | undefined,
  labels: string[] | null | undefined,
): { prize_description: string | null; prize_labels: string[] | null } {
  const c = clampPrizeCount(count);
  const desc = (description ?? '').trim() || null;
  if (c === 1) return { prize_description: desc, prize_labels: null };
  const src = Array.isArray(labels) ? labels : [];
  const out: string[] = [];
  for (let i = 0; i < c; i++) {
    const v = (src[i] ?? '').trim();
    out.push(v || desc || '');
  }
  return {
    prize_description: out[0] || desc,
    prize_labels: out,
  };
}

export function useGiveawayPartners(slug: string | undefined) {
  const [partners, setPartners] = useState<GiveawayPartner[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!slug) return;
    const { data } = await supabase
      .from('giveaway_partners' as any)
      .select('*')
      .eq('studio_slug', slug)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });
    setPartners(((data as unknown) as GiveawayPartner[]) || []);
    setLoading(false);
  }, [slug]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!slug) return;
    const ch = supabase
      .channel(`giveaway-partners-${slug}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'giveaway_partners', filter: `studio_slug=eq.${slug}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [slug, refresh]);

  const add = useCallback(async (input: PartnerInput) => {
    if (!slug) return { error: 'No studio' };
    const nextOrder = partners.length;
    const norm = normalizeLabels(input.prize_count, input.prize_description, input.prize_labels);
    const { error } = await supabase.from('giveaway_partners' as any).insert({
      studio_slug: slug,
      partner_name: input.partner_name.trim(),
      partner_ig_handle: input.partner_ig_handle?.trim() || null,
      receipt_instructions: input.receipt_instructions?.trim() || null,
      prize_description: norm.prize_description,
      prize_labels: norm.prize_labels,
      prize_count: clampPrizeCount(input.prize_count),
      display_order: nextOrder,
    });
    if (!error) await refresh();
    return { error: error?.message };
  }, [slug, partners.length, refresh]);

  const update = useCallback(async (id: string, input: PartnerInput) => {
    const norm = normalizeLabels(input.prize_count, input.prize_description, input.prize_labels);
    const { error } = await supabase.from('giveaway_partners' as any).update({
      partner_name: input.partner_name.trim(),
      partner_ig_handle: input.partner_ig_handle?.trim() || null,
      receipt_instructions: input.receipt_instructions?.trim() || null,
      prize_description: norm.prize_description,
      prize_labels: norm.prize_labels,
      prize_count: clampPrizeCount(input.prize_count),
    }).eq('id', id);
    if (!error) await refresh();
    return { error: error?.message };
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('giveaway_partners' as any).delete().eq('id', id);
    if (!error) await refresh();
    return { error: error?.message };
  }, [refresh]);

  return { partners, loading, refresh, add, update, remove };
}

/** Returns the label for a specific winner slot (0-indexed). Falls back to
 *  prize_description if per-slot labels aren't set. */
export function getPartnerPrizeLabel(
  partner: Pick<GiveawayPartner, 'prize_labels' | 'prize_description'>,
  slotIndex: number,
): string {
  const arr = Array.isArray(partner.prize_labels) ? partner.prize_labels : null;
  const v = arr && arr[slotIndex];
  if (v && v.trim()) return v.trim();
  return (partner.prize_description || '').trim();
}
