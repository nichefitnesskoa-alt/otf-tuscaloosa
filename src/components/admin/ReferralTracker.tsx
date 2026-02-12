import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { isMembershipSale } from '@/lib/sales-detection';

interface Referral {
  id: string;
  referrer_booking_id: string | null;
  referred_booking_id: string | null;
  referrer_name: string;
  referred_name: string;
  discount_applied: boolean;
  created_at: string;
}

type ReferralStatus = 'pending' | 'friend_purchased' | 'qualified';

export default function ReferralTracker() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'friend_purchased' | 'qualified' | 'applied'>('all');
  const [purchasedMembers, setPurchasedMembers] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    setLoading(true);
    const [{ data: refs }, { data: runs }] = await Promise.all([
      supabase.from('referrals').select('*').order('created_at', { ascending: false }),
      supabase.from('intros_run').select('member_name, result'),
    ]);
    setReferrals((refs as Referral[]) || []);
    
    // Build set of members who purchased
    const purchased = new Set<string>();
    (runs || []).forEach(r => {
      if (isMembershipSale(r.result)) {
        purchased.add(r.member_name.toLowerCase());
      }
    });
    setPurchasedMembers(purchased);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getReferralStatus = (r: Referral): ReferralStatus => {
    const referrerPurchased = purchasedMembers.has(r.referrer_name.toLowerCase());
    const friendPurchased = purchasedMembers.has(r.referred_name.toLowerCase());
    
    if (referrerPurchased && friendPurchased) return 'qualified';
    if (friendPurchased) return 'friend_purchased';
    return 'pending';
  };

  const statusConfig: Record<ReferralStatus, { label: string; variant: 'default' | 'secondary' | 'outline'; className: string }> = {
    pending: { label: 'Pending', variant: 'secondary', className: 'bg-muted text-muted-foreground' },
    friend_purchased: { label: 'Friend Purchased', variant: 'outline', className: 'bg-warning/20 text-warning border-warning/40' },
    qualified: { label: 'Qualified', variant: 'default', className: 'bg-success/20 text-success border-success/40' },
  };

  const toggleDiscount = async (id: string, currentValue: boolean) => {
    const { error } = await supabase
      .from('referrals')
      .update({ discount_applied: !currentValue })
      .eq('id', id);
    if (error) {
      toast.error('Failed to update');
    } else {
      setReferrals(prev =>
        prev.map(r => r.id === id ? { ...r, discount_applied: !currentValue } : r)
      );
      toast.success(!currentValue ? 'Discount marked as applied' : 'Discount unmarked');
    }
  };

  const filtered = useMemo(() => {
    return referrals.filter(r => {
      if (filter === 'applied') return r.discount_applied;
      if (filter === 'all') return true;
      const status = getReferralStatus(r);
      return status === filter;
    });
  }, [referrals, filter, purchasedMembers]);

  const qualifiedCount = referrals.filter(r => getReferralStatus(r) === 'qualified' && !r.discount_applied).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Referral Discounts
            {qualifiedCount > 0 && (
              <Badge className="text-xs bg-success/20 text-success border-success/40">
                {qualifiedCount} qualified
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-1 flex-wrap">
            {(['all', 'pending', 'friend_purchased', 'qualified', 'applied'] as const).map(f => (
              <Button
                key={f}
                variant={filter === f ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'pending' ? 'Pending' : f === 'friend_purchased' ? 'Friend Bought' : f === 'qualified' ? 'Qualified' : 'Applied'}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No referrals found.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(referral => {
              const status = getReferralStatus(referral);
              const config = statusConfig[status];
              return (
                <div
                  key={referral.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-background"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={referral.discount_applied}
                      onCheckedChange={() => toggleDiscount(referral.id, referral.discount_applied)}
                      disabled={status !== 'qualified' && !referral.discount_applied}
                    />
                    <div>
                      <p className="text-sm font-medium">
                        {referral.referrer_name} → {referral.referred_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(referral.created_at), 'MMM d, yyyy')} • $50 off next month
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {referral.discount_applied && (
                      <Badge variant="default" className="text-xs">Applied</Badge>
                    )}
                    <Badge className={`text-xs ${config.className}`}>
                      {config.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
