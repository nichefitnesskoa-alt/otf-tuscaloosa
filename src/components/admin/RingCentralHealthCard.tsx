import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Radio } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SubRow {
  rc_subscription_id: string | null;
  expires_at: string | null;
  last_renewed_at: string | null;
  last_recreated_at: string | null;
  status: string | null;
  last_error: string | null;
  updated_at: string | null;
}

/**
 * RingCentral webhook health — subscription status + unmatched volume.
 * Sits in Admin > Data next to the other integrity panels.
 */
export function RingCentralHealthCard() {
  const [sub, setSub] = useState<SubRow | null>(null);
  const [unmatched7d, setUnmatched7d] = useState<number>(0);
  const [matched7d, setMatched7d] = useState<number>(0);
  const [running, setRunning] = useState(false);

  const refresh = async () => {
    const [subRes, msgRes] = await Promise.all([
      (supabase as any).from('rc_subscription').select('*').eq('id', 'primary').maybeSingle(),
      (supabase as any).from('rc_message_log')
        .select('matched')
        .gte('processed_at', new Date(Date.now() - 7 * 86_400_000).toISOString()),
    ]);
    setSub(subRes.data || null);
    const rows = (msgRes.data as { matched: boolean }[]) || [];
    setUnmatched7d(rows.filter(r => !r.matched).length);
    setMatched7d(rows.filter(r => r.matched).length);
  };

  useEffect(() => { refresh(); }, []);

  const forceRenew = async () => {
    setRunning(true);
    const { error } = await (supabase as any).functions.invoke('ringcentral-renew-subscription');
    setRunning(false);
    if (error) toast.error(error.message || 'Renew failed');
    else { toast.success('Subscription check ran'); refresh(); }
  };

  const hoursLeft = sub?.expires_at
    ? Math.round((new Date(sub.expires_at).getTime() - Date.now()) / 3_600_000)
    : null;
  const healthColor =
    !sub?.rc_subscription_id ? 'text-destructive' :
    sub.status === 'error' ? 'text-destructive' :
    hoursLeft !== null && hoursLeft < 24 ? 'text-warning' :
    'text-success';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Radio className={`w-4 h-4 ${healthColor}`} />
          RingCentral Webhook
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div className="text-muted-foreground">Subscription</div>
          <div className={healthColor}>
            {sub?.rc_subscription_id
              ? `${sub.status} · expires in ${hoursLeft}h`
              : 'not created'}
          </div>
          <div className="text-muted-foreground">Last renewed</div>
          <div>{sub?.last_renewed_at ? new Date(sub.last_renewed_at).toLocaleString() : '—'}</div>
          <div className="text-muted-foreground">Last recreated</div>
          <div>{sub?.last_recreated_at ? new Date(sub.last_recreated_at).toLocaleString() : '—'}</div>
          <div className="text-muted-foreground">Matched (7d)</div>
          <div>{matched7d}</div>
          <div className="text-muted-foreground">Unmatched (7d)</div>
          <div className={unmatched7d > 0 ? 'text-warning' : ''}>{unmatched7d}</div>
          {sub?.last_error && (
            <>
              <div className="text-muted-foreground">Last error</div>
              <div className="text-destructive text-xs break-all">{sub.last_error}</div>
            </>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={forceRenew} disabled={running}>
          {running ? 'Running…' : 'Check / renew now'}
        </Button>
      </CardContent>
    </Card>
  );
}
