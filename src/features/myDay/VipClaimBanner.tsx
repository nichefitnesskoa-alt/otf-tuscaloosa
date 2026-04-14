/**
 * Banner shown at the top of MyDay when there are unread VIP slot claims.
 * Displays recent VIP notifications and allows dismissal.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { X, Sparkles } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';

const sb = supabase as any;

interface VipNotification {
  id: string;
  title: string;
  body: string;
  created_at: string;
  meta: any;
}

export function VipClaimBanner() {
  const [notifications, setNotifications] = useState<VipNotification[]>([]);

  const fetchNotifications = useCallback(async () => {
    const { data } = await sb
      .from('notifications')
      .select('id, title, body, created_at, meta')
      .in('notification_type', ['vip_slot_claimed', 'vip_member_registered'])
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(5);
    setNotifications(data || []);
  }, []);

  useEffect(() => {
    fetchNotifications();

    // Listen for new notifications in realtime
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
      {notifications.map(n => (
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
      ))}
    </div>
  );
}
