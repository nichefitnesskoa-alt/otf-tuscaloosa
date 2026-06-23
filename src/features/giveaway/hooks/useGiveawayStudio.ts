import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { WinnerStructure } from '../lib/winnerStructure';
import type { CountdownMode } from '../lib/endAt';

export interface GiveawayStudio {
  id: string;
  studio_slug: string;
  studio_name: string;
  countdown_duration_days: number;
  countdown_mode: CountdownMode;
  goes_live_at: string | null;
  winner_structure: WinnerStructure;
  title_format: 'auto_combined' | 'auto_studio_only' | 'custom';
  custom_title: string | null;
  deck_contact_name: string | null;
  deck_contact_title: string | null;
  deck_contact_phone: string | null;
  deck_contact_email: string | null;
  deck_prize_anchor_value: number | null;
  deck_headline_value: string | null;
  deck_intro_copy: string | null;
  deck_what_we_need_prize: string | null;
  deck_what_we_need_promotion: string | null;
  deck_what_we_need_class: string | null;
  deck_what_we_need_time: string | null;
  // Per-slide editable fields
  deck_s2_headline: string | null;
  deck_s2_body: string | null;
  deck_s3_headline: string | null;
  deck_s3_value_note: string | null;
  deck_s4_headline: string | null;
  deck_s4_subtext: string | null;
  deck_s4_phase1_title: string | null;
  deck_s4_phase1_body: string | null;
  deck_s4_phase2_title: string | null;
  deck_s4_phase2_body: string | null;
  deck_s4_phase3_title: string | null;
  deck_s4_phase3_body: string | null;
  deck_s5_headline: string | null;
  deck_s5_c1_title: string | null;
  deck_s5_c1_body: string | null;
  deck_s5_c2_title: string | null;
  deck_s5_c2_body: string | null;
  deck_s5_c3_title: string | null;
  deck_s5_c3_body: string | null;
  deck_s5_c4_title: string | null;
  deck_s5_c4_body: string | null;
  deck_s6_headline: string | null;
  deck_s6_body: string | null;
  deck_s6_note: string | null;
  deck_s7_headline: string | null;
  deck_s8_headline: string | null;
  deck_s8_prize: string | null;
  deck_s8_promo: string | null;
  deck_s8_class: string | null;
  deck_s8_time: string | null;
  deck_s9_headline: string | null;
  deck_s9_subline: string | null;
  deck_s9_body: string | null;
  // Per-element size overrides (null = auto-size)
  deck_s1_title1_size: number | null;
  deck_s1_title2_size: number | null;
  deck_s1_subtitle_size: number | null;
  deck_s2_headline_size: number | null;
  deck_s3_headline_size: number | null;
  deck_s4_headline_size: number | null;
  deck_s4_phase_title_size: number | null;
  deck_s5_headline_size: number | null;
  deck_s5_card_title_size: number | null;
  deck_s6_headline_size: number | null;
  deck_s7_headline_size: number | null;
  deck_s8_headline_size: number | null;
  deck_s9_headline_size: number | null;
  deck_s9_subline_size: number | null;
  action_verification_modes: Record<string, 'checkbox' | 'screenshot'> | null;
  action_labels: Record<string, { title?: string; description?: string }> | null;
}

export function useGiveawayStudio(slug: string | undefined) {
  const [studio, setStudio] = useState<GiveawayStudio | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!slug) return;
    const { data } = await supabase
      .from('giveaway_studios' as any)
      .select('*')
      .eq('studio_slug', slug)
      .maybeSingle();
    setStudio(((data as unknown) as GiveawayStudio | null) ?? null);
    setLoading(false);
  }, [slug]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!slug) return;
    const ch = supabase
      .channel(`giveaway-studio-${slug}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'giveaway_studios', filter: `studio_slug=eq.${slug}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [slug, refresh]);

  return { studio, loading, refresh };
}
