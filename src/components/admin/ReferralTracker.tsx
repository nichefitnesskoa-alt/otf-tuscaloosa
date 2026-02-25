import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Trash2, Plus, X } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { isMembershipSale } from '@/lib/sales-detection';
import ClientNameAutocomplete from '@/components/ClientNameAutocomplete';

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
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newReferrerName, setNewReferrerName] = useState('');
  const [newReferredName, setNewReferredName] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: refs }, { data: runs }] = await Promise.all([
      supabase.from('referrals').select('*').order('created_at', { ascending: false }),
      supabase.from('intros_run').select('member_name, result'),
    ]);
    setReferrals((refs as Referral[]) || []);
    
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

  const statusConfig: Record<ReferralStatus, { label: string; className: string }> = {
    pending: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
    friend_purchased: { label: 'Friend Purchased', className: 'bg-warning/20 text-warning border-warning/40' },
    qualified: { label: 'Qualified', className: 'bg-success/20 text-success border-success/40' },
  };

  const toggleDiscount = async (id: string, currentValue: boolean) => {
    const { error } = await supabase.from('referrals').update({ discount_applied: !currentValue }).eq('id', id);
    if (error) { toast.error('Failed to update'); } else {
      setReferrals(prev => prev.map(r => r.id === id ? { ...r, discount_applied: !currentValue } : r));
      toast.success(!currentValue ? 'Discount marked as applied' : 'Discount unmarked');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('referrals').delete().eq('id', deleteId);
    if (error) { toast.error('Failed to delete referral'); } else {
      setReferrals(prev => prev.filter(r => r.id !== deleteId));
      toast.success('Referral deleted');
    }
    setDeleteId(null);
  };

  const handleAddReferral = async () => {
    if (!newReferrerName.trim() || !newReferredName.trim()) {
      toast.error('Both names are required');
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.from('referrals').insert({
      referrer_name: newReferrerName.trim(),
      referred_name: newReferredName.trim(),
    }).select('*').single();
    if (error) {
      toast.error('Failed to add referral');
    } else {
      setReferrals(prev => [data as Referral, ...prev]);
      setNewReferrerName('');
      setNewReferredName('');
      setShowAddForm(false);
      toast.success('Referral added');
    }
    setSaving(false);
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
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={showAddForm ? 'secondary' : 'default'}
              className="text-xs h-7 px-2 gap-1"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {showAddForm ? 'Cancel' : 'Add Referral'}
            </Button>
          </div>
        </div>
        {/* Add Referral Form */}
        {showAddForm && (
          <div className="mt-3 p-3 rounded-lg border bg-muted/30 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Referrer (existing member)</label>
                <ClientNameAutocomplete
                  value={newReferrerName}
                  onChange={setNewReferrerName}
                  onSelectExisting={(client) => setNewReferrerName(client.member_name)}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Referred (friend)</label>
                <ClientNameAutocomplete
                  value={newReferredName}
                  onChange={setNewReferredName}
                  onSelectExisting={(client) => setNewReferredName(client.member_name)}
                />
              </div>
            </div>
            <Button size="sm" className="h-7 text-xs" onClick={handleAddReferral} disabled={saving}>
              {saving ? 'Saving…' : 'Save Referral'}
            </Button>
          </div>
        )}
        {/* Filter buttons */}
        <div className="flex gap-1 flex-wrap mt-2">
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
                <div key={referral.id} className="flex items-center justify-between p-3 rounded-lg border bg-background">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={referral.discount_applied}
                      onCheckedChange={() => toggleDiscount(referral.id, referral.discount_applied)}
                      disabled={status !== 'qualified' && !referral.discount_applied}
                    />
                    <div>
                      <p className="text-sm font-medium">{referral.referrer_name} → {referral.referred_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(referral.created_at), 'MMM d, yyyy')} • $50 off next month
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {referral.discount_applied && <Badge variant="default" className="text-xs">Applied</Badge>}
                    <Badge className={`text-xs ${config.className}`}>{config.label}</Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(referral.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Referral</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this referral discount record? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
