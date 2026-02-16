import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Referral {
  referrer_name: string;
  referred_name: string;
  referred_booking_id: string | null;
}

export function ReferralLeaderboard() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [bookingStatuses, setBookingStatuses] = useState<Map<string, string>>(new Map());
  const [expandedReferrer, setExpandedReferrer] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('referrals')
        .select('referrer_name, referred_name, referred_booking_id');
      const refs = data || [];
      setReferrals(refs);

      // Fetch booking statuses for referred people
      const bookingIds = refs.map(r => r.referred_booking_id).filter(Boolean) as string[];
      if (bookingIds.length > 0) {
        const { data: bookings } = await supabase
          .from('intros_booked')
          .select('id, booking_status')
          .in('id', bookingIds.slice(0, 500));
        
        // Also check intros_run for outcome
        const { data: runs } = await supabase
          .from('intros_run')
          .select('linked_intro_booked_id, result')
          .in('linked_intro_booked_id', bookingIds.slice(0, 500));
        
        const statusMap = new Map<string, string>();
        (bookings || []).forEach(b => statusMap.set(b.id, b.booking_status || 'Booked'));
        (runs || []).forEach(r => {
          if (r.linked_intro_booked_id) {
            statusMap.set(r.linked_intro_booked_id, r.result);
          }
        });
        setBookingStatuses(statusMap);
      }
    })();
  }, []);

  const leaderboard = useMemo(() => {
    const grouped = new Map<string, Referral[]>();
    referrals.forEach(r => {
      const key = r.referrer_name;
      const existing = grouped.get(key) || [];
      existing.push(r);
      grouped.set(key, existing);
    });
    return Array.from(grouped.entries())
      .map(([name, refs]) => ({ name, count: refs.length, refs }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [referrals]);

  const medals = ['🥇', '🥈', '🥉'];

  if (leaderboard.length === 0) return null;

  const getStatusBadge = (status: string) => {
    const lower = (status || '').toLowerCase();
    if (lower.includes('purchased') || lower.includes('premier') || lower.includes('elite') || lower.includes('basic'))
      return <Badge className="text-[10px] bg-green-500/20 text-green-600 border-green-500/30">Purchased</Badge>;
    if (lower === 'no-show' || lower === 'no show')
      return <Badge variant="destructive" className="text-[10px]">No Show</Badge>;
    if (lower.includes('didn') || lower.includes('didnt') || lower.includes("didn't"))
      return <Badge variant="secondary" className="text-[10px]">Didn't Buy</Badge>;
    return <Badge variant="outline" className="text-[10px]">{status || 'Booked'}</Badge>;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Referral Leaderboard
        </CardTitle>
        <p className="text-xs text-muted-foreground">Members generating the most referrals · tap to expand</p>
      </CardHeader>
      <CardContent className="space-y-1">
        {leaderboard.map((entry, i) => (
          <div key={entry.name}>
            <button
              onClick={() => setExpandedReferrer(expandedReferrer === entry.name ? null : entry.name)}
              className="flex items-center justify-between text-sm w-full py-1 hover:bg-muted/50 rounded px-1 -mx-1"
            >
              <span className="flex items-center gap-1.5">
                <span>{i < 3 ? medals[i] : `#${i + 1}`}</span>
                <span className="font-medium truncate max-w-[120px]">{entry.name}</span>
                {expandedReferrer === entry.name
                  ? <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  : <ChevronRight className="w-3 h-3 text-muted-foreground" />
                }
              </span>
              <Badge variant="secondary" className="text-xs">{entry.count} referral{entry.count !== 1 ? 's' : ''}</Badge>
            </button>

            {expandedReferrer === entry.name && (
              <div className="ml-8 mb-2 space-y-1">
                {entry.refs.map((ref, ri) => {
                  const status = ref.referred_booking_id
                    ? bookingStatuses.get(ref.referred_booking_id)
                    : undefined;
                  return (
                    <div key={ri} className="flex items-center justify-between text-xs py-0.5">
                      <span className="text-muted-foreground">{ref.referred_name}</span>
                      {status ? getStatusBadge(status) : <Badge variant="outline" className="text-[10px]">Pending</Badge>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
