/**
 * Admin Follow-Up Ownership Overview — shows SA/Coach queue splits and transfer stats.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, subDays } from 'date-fns';

interface OwnershipStats {
  saQueue: number;
  coachQueue: number;
  transferredThisWeek: number;
  closedNotInterested: number;
  avgDaysToFirstTouch: number | null;
}

export function FollowUpOwnershipPanel() {
  const [stats, setStats] = useState<OwnershipStats>({
    saQueue: 0, coachQueue: 0, transferredThisWeek: 0, closedNotInterested: 0, avgDaysToFirstTouch: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { count: saCount } = await (supabase
          .from('follow_up_queue')
          .select('id', { count: 'exact', head: true }) as any)
          .eq('owner_role', 'SA')
          .is('not_interested_at', null);

        const { count: coachCount } = await (supabase
          .from('follow_up_queue')
          .select('id', { count: 'exact', head: true }) as any)
          .eq('owner_role', 'Coach')
          .is('not_interested_at', null)
          .is('transferred_to_sa_at', null);

        const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');
        const { count: transferredCount } = await (supabase
          .from('follow_up_queue')
          .select('id', { count: 'exact', head: true }) as any)
          .not('transferred_to_sa_at', 'is', null)
          .gte('transferred_to_sa_at', weekAgo);

        const { count: notInterestedCount } = await (supabase
          .from('follow_up_queue')
          .select('id', { count: 'exact', head: true }) as any)
          .not('not_interested_at', 'is', null);

        setStats({
          saQueue: saCount || 0,
          coachQueue: coachCount || 0,
          transferredThisWeek: transferredCount || 0,
          closedNotInterested: notInterestedCount || 0,
          avgDaysToFirstTouch: null, // would need complex query
        });
      } catch (err) {
        console.error('Ownership stats error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Follow-Up Ownership</CardTitle>
        <p className="text-xs text-muted-foreground">SA vs Coach queue accountability</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">SA Queue</p>
            <p className="text-2xl font-semibold">{stats.saQueue}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Coach Queue</p>
            <p className="text-2xl font-semibold">{stats.coachQueue}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Transferred This Week</p>
            <p className="text-2xl font-semibold">{stats.transferredThisWeek}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Closed — Not Interested</p>
            <p className="text-2xl font-semibold">{stats.closedNotInterested}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
