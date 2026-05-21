import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GiveawayStudio {
  id: string;
  studio_slug: string;
  studio_name: string;
  partner_name: string | null;
  partner_instructions: string | null;
  countdown_duration_days: number;
  goes_live_at: string | null;
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
    setStudio((data as GiveawayStudio | null) ?? null);
    setLoading(false);
  }, [slug]);

  useEffect(() => { refresh(); }, [refresh]);

  return { studio, loading, refresh };
}
