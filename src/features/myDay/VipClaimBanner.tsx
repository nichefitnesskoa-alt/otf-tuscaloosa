/**
 * Banner shown at the top of MyDay when there are unread VIP slot claims
 * or new VIP-class registrations. For registrations we surface the
 * registrant's name plus Copy Phone + Send Script actions so SAs can text
 * a booking confirmation immediately — same workflow as New Leads alerts.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { X, Sparkles, Copy, Check, Send, Phone } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { ScriptSendDrawer } from '@/components/scripts/ScriptSendDrawer';
import { toast } from 'sonner';

const sb = supabase as any;

interface VipNotification {
  id: string;
  title: string;
  body: string;
  created_at: string;
  notification_type: string;
  meta: any;
}

export function VipClaimBanner() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<VipNotification[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [scriptDrawer, setScriptDrawer] = useState<{ open: boolean; name: string; phone: string }>({
    open: false,
    name: '',
    phone: '',
  });

  const fetchNotifications = useCallback(async () => {
    const { data } = await sb
      .from('notifications')
      .select('id, title, body, created_at, notification_type, meta')
      .in('notification_type', ['vip_slot_claimed', 'vip_member_registered'])
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(5);
    setNotifications(data || []);
  }, []);

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel('vip-claim-banner')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        () => fetchNotifications()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchNotifications]);

  const dismiss = async (id: string) => {
    await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const dismissAll = async () => {
    const ids = notifications.map(n => n.id);
    if (ids.length === 0) return;
    await sb.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
    setNotifications([]);
  };

  const copyPhone = async (id: string, phone: string) => {
    await navigator.clipboard.writeText(phone);
    setCopiedId(id);
    toast.success('Phone copied!');
    setTimeout(() => setCopiedId(curr => (curr === id ? null : curr)), 2000);
  };

  const openScript = (n: VipNotification) => {
    const name = `${n.meta?.first_name || ''} ${n.meta?.last_name || ''}`.trim();
    setScriptDrawer({ open: true, name, phone: n.meta?.phone || '' });
  };

  if (notifications.length === 0) return null;

  return (
    <div className="mx-4 mt-2 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <Sparkles className="w-3.5 h-3.5" />
          VIP Updates
        </div>
        {notifications.length > 1 && (
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={dismissAll}>
            Clear all
          </Button>
        )}
      </div>
      {notifications.map(n => {
        const isRegistration = n.notification_type === 'vip_member_registered' && !!n.meta?.phone;
        return (
          <div
            key={n.id}
            className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold">{n.title}</p>
              <p className="text-[11px] text-muted-foreground leading-snug">{n.body}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                {formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true })}
              </p>
              {isRegistration && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 min-h-[36px] text-[11px] gap-1 cursor-pointer"
                    onClick={() => copyPhone(n.id, n.meta.phone)}
                  >
                    {copiedId === n.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedId === n.id ? 'Copied!' : 'Copy Phone'}
                  </Button>
                  <Button
                    size="sm"
                    className="h-9 min-h-[36px] text-[11px] gap-1 cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={() => openScript(n)}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send Script
                  </Button>
                  <a
                    href={`tel:${n.meta.phone}`}
                    className="inline-flex items-center gap-1 text-[11px] text-primary underline px-1"
                  >
                    <Phone className="w-3 h-3" />
                    {n.meta.phone}
                  </a>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 flex-shrink-0"
              onClick={() => dismiss(n.id)}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        );
      })}

      <ScriptSendDrawer
        open={scriptDrawer.open}
        onOpenChange={(open) => setScriptDrawer(s => ({ ...s, open }))}
        leadName={scriptDrawer.name}
        leadPhone={scriptDrawer.phone}
        categoryFilter="booking_confirmation"
        saName={user?.name || ''}
      />
    </div>
  );
}
