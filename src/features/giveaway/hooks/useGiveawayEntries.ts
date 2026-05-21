import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GiveawayEntry {
  id: string;
  studio_slug: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  base_entries: number;
  bonus_entries: number;
  total_entries: number;
  action_instagram_follow: boolean;
  action_post_engagement: boolean;
  action_post_engagement_screenshot_url: string | null;
  action_story_share: boolean;
  action_story_share_screenshot_url: string | null;
  action_free_class: boolean;
  action_free_class_screenshot_url: string | null;
  action_partner_visit: boolean;
  action_partner_visit_photo_url: string | null;
  submitted_at: string;
}

export function useGiveawayEntries(slug: string | undefined) {
  const [entries, setEntries] = useState<GiveawayEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!slug) return;
    const { data } = await supabase
      .from('giveaway_entries' as any)
      .select('*')
      .eq('studio_slug', slug)
      .order('submitted_at', { ascending: false });
    setEntries((data as unknown as GiveawayEntry[]) || []);
    setLoading(false);
  }, [slug]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!slug) return;
    const ch = supabase
      .channel(`giveaway-entries-${slug}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'giveaway_entries', filter: `studio_slug=eq.${slug}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [slug, refresh]);

  return { entries, loading, refresh };
}
