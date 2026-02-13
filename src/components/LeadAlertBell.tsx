import { useState, useEffect } from 'react';
import { Bell, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import {
  Popover, PopoverContent, PopoverTrigger
} from '@/components/ui/popover';
import { format } from 'date-fns';

interface LeadAlert {
  id: string;
  first_name: string;
  last_name: string;
  source: string;
  created_at: string;
}

export function LeadAlertBell() {
  const [alerts, setAlerts] = useState<LeadAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [followUpsDue, setFollowUpsDue] = useState(0);
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('leadAlertLastSeen');
    setLastSeen(saved);
    fetchRecentLeads(saved);
    fetchFollowUpsDue();

    const channel = supabase
      .channel('lead-alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        (payload) => {
          const newLead = payload.new as LeadAlert;
          setAlerts(prev => [newLead, ...prev].slice(0, 10));
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchRecentLeads = async (seen: string | null) => {
    const { data } = await supabase
      .from('leads')
      .select('id, first_name, last_name, source, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      setAlerts(data);
      if (seen) {
        setUnreadCount(data.filter(l => new Date(l.created_at) > new Date(seen)).length);
      } else {
        setUnreadCount(data.length);
      }
    }
  };

  const fetchFollowUpsDue = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { count } = await supabase
      .from('follow_up_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lte('scheduled_date', today);
    setFollowUpsDue(count || 0);
  };

  const totalBadge = unreadCount + followUpsDue;

  const handleOpen = (open: boolean) => {
    if (open) {
      const now = new Date().toISOString();
      setLastSeen(now);
      localStorage.setItem('leadAlertLastSeen', now);
      setUnreadCount(0);
    }
  };

  return (
    <Popover onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-background hover:bg-background/10">
          <Bell className="w-4 h-4" />
          {totalBadge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {totalBadge > 9 ? '9+' : totalBadge}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="end">
        {followUpsDue > 0 && (
          <div className="flex items-center gap-2 px-2 py-1.5 mb-2 rounded bg-warning/10 text-warning text-xs font-medium">
            <Clock className="w-3.5 h-3.5 flex-shrink-0" />
            {followUpsDue} follow-up{followUpsDue !== 1 ? 's' : ''} due today
          </div>
        )}
        <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">Recent Leads</p>
        {alerts.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1 py-2">No leads yet</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {alerts.map(a => (
              <div key={a.id} className="p-2 rounded hover:bg-muted/50 text-xs">
                <p className="font-medium">{a.first_name} {a.last_name}</p>
                <p className="text-muted-foreground">
                  {a.source} · {format(new Date(a.created_at), 'MMM d, h:mm a')}
                </p>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
