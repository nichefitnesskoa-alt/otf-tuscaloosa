import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export function ReferralLeaderboard() {
  const [referrals, setReferrals] = useState<{ referrer_name: string; referred_name: string }[]>([]);

  useEffect(() => {
    supabase.from('referrals').select('referrer_name, referred_name').then(({ data }) => {
      setReferrals(data || []);
    });
  }, []);

  // Group by referrer who created actual bookings - use booking data to see which SA sourced the referral
  const leaderboard = useMemo(() => {
    const counts = new Map<string, number>();
    referrals.forEach(r => {
      const key = r.referrer_name;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [referrals]);

  const medals = ['🥇', '🥈', '🥉'];

  if (leaderboard.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Referral Leaderboard
        </CardTitle>
        <p className="text-xs text-muted-foreground">Members generating the most referrals</p>
      </CardHeader>
      <CardContent className="space-y-1">
        {leaderboard.map((entry, i) => (
          <div key={entry.name} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5">
              <span>{i < 3 ? medals[i] : `#${i + 1}`}</span>
              <span className="font-medium truncate max-w-[120px]">{entry.name}</span>
            </span>
            <Badge variant="secondary" className="text-xs">{entry.count} referral{entry.count !== 1 ? 's' : ''}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
