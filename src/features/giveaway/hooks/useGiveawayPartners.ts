import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GiveawayPartner {
  id: string;
  studio_slug: string;
  partner_name: string;
  partner_ig_handle: string | null;
  receipt_instructions: string | null;
  prize_description: string | null;
  display_order: number;
  created_at: string;
}

export interface PartnerInput {
  partner_name: string;
  partner_ig_handle: string | null;
  receipt_instructions: string | null;
  prize_description: string | null;
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
    const { error } = await supabase.from('giveaway_partners' as any).insert({
      studio_slug: slug,
      partner_name: input.partner_name.trim(),
      partner_ig_handle: input.partner_ig_handle?.trim() || null,
      receipt_instructions: input.receipt_instructions?.trim() || null,
      prize_description: input.prize_description?.trim() || null,
      display_order: nextOrder,
    });
    if (!error) await refresh();
    return { error: error?.message };
  }, [slug, partners.length, refresh]);

  const update = useCallback(async (id: string, input: PartnerInput) => {
    const { error } = await supabase.from('giveaway_partners' as any).update({
      partner_name: input.partner_name.trim(),
      partner_ig_handle: input.partner_ig_handle?.trim() || null,
      receipt_instructions: input.receipt_instructions?.trim() || null,
      prize_description: input.prize_description?.trim() || null,
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
