import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { GitBranch, Trophy, Users } from 'lucide-react';

interface Referral {
  id: string;
  referrer_name: string;
  referred_name: string;
  discount_applied: boolean;
  created_at: string;
}

export default function ReferralTree() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('referrals')
      .select('id, referrer_name, referred_name, discount_applied, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setReferrals((data as Referral[]) || []);
        setLoading(false);
      });
  }, []);

  // Build tree: group by referrer, then check if any referred person is also a referrer
  const { topReferrers, treeData } = useMemo(() => {
    const referrerCounts = new Map<string, { count: number; converted: number; referred: string[] }>();

    referrals.forEach(r => {
      const key = r.referrer_name.toLowerCase();
      if (!referrerCounts.has(key)) {
        referrerCounts.set(key, { count: 0, converted: 0, referred: [] });
      }
      const entry = referrerCounts.get(key)!;
      entry.count++;
      entry.referred.push(r.referred_name);
    });

    // Check if referred names also have bookings that converted
    // For now, just show the tree structure
    const sorted = Array.from(referrerCounts.entries())
      .map(([key, val]) => ({ name: referrals.find(r => r.referrer_name.toLowerCase() === key)?.referrer_name || key, ...val }))
      .sort((a, b) => b.count - a.count);

    // Build chain data
    const chains: Array<{ chain: string[]; depth: number }> = [];
    const referredSet = new Set(referrals.map(r => r.referred_name.toLowerCase()));
    const referrerSet = new Set(referrals.map(r => r.referrer_name.toLowerCase()));

    // Find roots (referrers who were never referred by anyone)
    const roots = sorted.filter(s => !referredSet.has(s.name.toLowerCase()));

    const buildChain = (name: string, chain: string[], depth: number) => {
      const refs = referrals.filter(r => r.referrer_name.toLowerCase() === name.toLowerCase());
      if (refs.length === 0) {
        chains.push({ chain: [...chain], depth });
        return;
      }
      refs.forEach(r => {
        buildChain(r.referred_name, [...chain, r.referred_name], depth + 1);
      });
    };

    roots.forEach(root => {
      buildChain(root.name, [root.name], 0);
    });

    return { topReferrers: sorted.slice(0, 10), treeData: chains };
  }, [referrals]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-4">
      {/* Top Referrers Leaderboard */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            Top Referrers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topReferrers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No referrals yet.</p>
          ) : (
            <div className="space-y-2">
              {topReferrers.map((ref, i) => (
                <div key={ref.name} className="flex items-center justify-between p-2 rounded border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-700' : 'text-muted-foreground'}`}>
                      #{i + 1}
                    </span>
                    <span className="text-sm font-medium">{ref.name}</span>
                  </div>
                  <Badge variant="secondary">{ref.count} referral{ref.count !== 1 ? 's' : ''}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Referral Chains */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-primary" />
            Referral Chains
          </CardTitle>
        </CardHeader>
        <CardContent>
          {treeData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No chains found.</p>
          ) : (
            <div className="space-y-1">
              {treeData.filter(c => c.chain.length > 1).map((chain, i) => (
                <div key={i} className="text-xs p-2 rounded border bg-muted/20 flex items-center gap-1 flex-wrap">
                  {chain.chain.map((name, j) => (
                    <span key={j} className="flex items-center gap-1">
                      {j > 0 && <span className="text-muted-foreground">→</span>}
                      <Badge variant={j === 0 ? 'default' : 'outline'} className="text-[10px]">{name}</Badge>
                    </span>
                  ))}
                  {chain.depth > 1 && (
                    <Badge variant="secondary" className="text-[10px] ml-1">
                      {chain.depth}-level chain
                    </Badge>
                  )}
                </div>
              ))}
              {treeData.filter(c => c.chain.length > 1).length === 0 && (
                <p className="text-sm text-muted-foreground">No multi-level chains yet.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
