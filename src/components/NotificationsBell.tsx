import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { ComparisonView } from '@/components/scorecard/ComparisonView';

interface Notif {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
  meta: any;
}

export function NotificationsBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [openCard, setOpenCard] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.name) return;
    const load = async () => {
      const { data } = await supabase
        .from('notifications' as any)
        .select('*')
        .or(`target_user.eq.${user.name},target_user.is.null`)
        .order('created_at', { ascending: false })
        .limit(20);
      setItems((data || []) as any);
    };
    load();
    const ch = supabase.channel('notif-' + user.name)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.name]);

  const unread = items.filter(i => !i.read_at).length;

  const markRead = async () => {
    const ids = items.filter(i => !i.read_at).map(i => i.id);
    if (!ids.length) return;
    await supabase.from('notifications' as any).update({ read_at: new Date().toISOString() }).in('id', ids);
    setItems(prev => prev.map(i => i.read_at ? i : { ...i, read_at: new Date().toISOString() }));
  };

  return (
    <>
      <Popover onOpenChange={(o) => { if (o) markRead(); }}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-9 w-9">
            <Bell className="w-4 h-4" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center px-1">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="p-3 border-b font-bold text-sm">Notifications</div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && <p className="p-4 text-sm text-muted-foreground italic">All caught up.</p>}
            {items.map(n => (
              <button
                key={n.id}
                onClick={() => { if (n.meta?.scorecard_id) setOpenCard(n.meta.scorecard_id); }}
                className={`w-full text-left p-3 border-b hover:bg-muted ${!n.read_at ? 'bg-primary/5' : ''}`}
              >
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.body}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(n.created_at), 'MMM d, h:mm a')}</p>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <ComparisonView scorecardId={openCard} open={!!openCard} onOpenChange={(o) => { if (!o) setOpenCard(null); }} />
    </>
  );
}
