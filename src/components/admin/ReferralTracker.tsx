import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Referral {
  id: string;
  referrer_booking_id: string | null;
  referred_booking_id: string | null;
  referrer_name: string;
  referred_name: string;
  discount_applied: boolean;
  created_at: string;
}

export default function ReferralTracker() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'applied'>('all');

  const fetchReferrals = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching referrals:', error);
    } else {
      setReferrals((data as Referral[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReferrals();
  }, []);

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

  const filtered = referrals.filter(r => {
    if (filter === 'pending') return !r.discount_applied;
    if (filter === 'applied') return r.discount_applied;
    return true;
  });

  const pendingCount = referrals.filter(r => !r.discount_applied).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Referral Discounts
            {pendingCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {pendingCount} pending
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-1">
            {(['all', 'pending', 'applied'] as const).map(f => (
              <Button
                key={f}
                variant={filter === f ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'pending' ? 'Pending' : 'Applied'}
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
            {filtered.map(referral => (
              <div
                key={referral.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-background"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={referral.discount_applied}
                    onCheckedChange={() => toggleDiscount(referral.id, referral.discount_applied)}
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
                <Badge
                  variant={referral.discount_applied ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {referral.discount_applied ? 'Applied' : 'Pending'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
