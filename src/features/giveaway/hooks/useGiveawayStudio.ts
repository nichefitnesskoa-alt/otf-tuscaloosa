import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { WinnerStructure } from '../lib/winnerStructure';

export interface GiveawayStudio {
  id: string;
  studio_slug: string;
  studio_name: string;
  countdown_duration_days: number;
  goes_live_at: string | null;
  winner_structure: WinnerStructure;
  title_format: 'auto_combined' | 'auto_studio_only' | 'custom';
  custom_title: string | null;
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
