import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ReferralAsk {
  id: string;
  sa_name: string;
  member_name: string;
  friend_name: string | null;
  asked_at: string;
  shift_date: string | null;
  shift_type: string | null;
}

// Hook: load all referral asks once, keep live via realtime.
export function useAllReferralAsks() {
  const [asks, setAsks] = useState<ReferralAsk[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('referral_asks' as any)
      .select('*')
      .order('asked_at', { ascending: false });
    setAsks((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel('referral-asks-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'referral_asks' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  return { asks, loading, reload: load };
}

export async function logReferralAsk(input: {
  sa_name: string;
  member_name: string;
  friend_name: string;
  shift_date: string;
  shift_type: string;
}): Promise<void> {
  await supabase.from('referral_asks' as any).insert({
    sa_name: input.sa_name,
    member_name: input.member_name.trim(),
    friend_name: input.friend_name.trim() || null,
    shift_date: input.shift_date,
    shift_type: input.shift_type,
  } as any);
}

// Find the most recent ask for a given member name (case-insensitive) within the lookback window.
export function findRecentAsk(
  asks: ReferralAsk[],
  memberName: string,
  windowDays = 30,
): ReferralAsk | null {
  const needle = memberName.trim().toLowerCase();
  if (!needle) return null;
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const match = asks.find(
    a => a.member_name.trim().toLowerCase() === needle && new Date(a.asked_at).getTime() >= cutoff,
  );
  return match ?? null;
}
