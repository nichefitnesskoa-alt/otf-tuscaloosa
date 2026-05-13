import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface OwnItMention {
  id: string;
  meeting_id: string | null;
  source_type: 'entry' | 'response' | 'win';
  source_id: string;
  source_owner_id: string | null;
  tagged_user_name: string;
  tagger_user_name: string;
  raw_token: string;
  matched_lane: string | null;
  excerpt: string | null;
  acknowledged_at: string | null;
  responded_at: string | null;
  created_at: string;
}

/**
 * Single source of truth for the "you've been tagged" UI on My Day, Coach
 * View, and Own It. Filters to the current user, unacknowledged only.
 */
export function useMyOwnItMentions() {
  const { user } = useAuth();
  const [items, setItems] = useState<OwnItMention[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.name) return;
    const { data } = await supabase
      .from('table_mentions' as any)
      .select('*')
      .eq('tagged_user_name', user.name)
      .is('acknowledged_at', null)
      .order('created_at', { ascending: false });
    setItems((data || []) as any);
    setLoading(false);
  }, [user?.name]);

  useEffect(() => {
    load();
    if (!user?.name) return;
    const ch = supabase.channel('own-it-mentions-' + user.name)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_mentions' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.name, load]);

  const acknowledge = useCallback(async (id: string) => {
    setItems(prev => prev.filter(m => m.id !== id));
    await supabase
      .from('table_mentions' as any)
      .update({ acknowledged_at: new Date().toISOString() })
      .eq('id', id);
  }, []);

  return { items, loading, acknowledge };
}
