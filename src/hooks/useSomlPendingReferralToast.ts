/**
 * Global realtime subscription: when a soml_pending_referrals row is
 * inserted whose credited_sa matches the current user, fire a toast to
 * the booker celebrating the pending referral. Reuses the sonner toast
 * pattern used by other MyDay alerts (e.g. IntroLinkBookingBanner).
 */
import { useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { notifySomlChanged } from '@/hooks/useSomlData';

export function useSomlPendingReferralToast() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.name) return;
    const name = user.name;
    const channel = supabase
      .channel(`soml-pending-referrals-${name}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'soml_pending_referrals' },
        (payload: any) => {
          const row = payload?.new;
          if (!row || row.credited_sa !== name) return;
          toast.success('Referral logged — pending', {
            description: `Counts when ${row.referring_member || 'they'} buys.`,
            duration: 6000,
          });
          notifySomlChanged();
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'soml_pending_referrals' },
        () => notifySomlChanged(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.name]);
}
