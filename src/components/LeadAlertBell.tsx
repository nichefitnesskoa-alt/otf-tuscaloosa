import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
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
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  useEffect(() => {
    // Load last seen timestamp
    const saved = localStorage.getItem('leadAlertLastSeen');
    setLastSeen(saved);

    // Fetch recent leads
    fetchRecentLeads(saved);

    // Subscribe to realtime
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRecentLeads = async (seen: string | null) => {
    let query = supabase
      .from('leads')
      .select('id, first_name, last_name, source, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    const { data } = await query;
    if (data) {
      setAlerts(data);
      if (seen) {
        const unseenCount = data.filter(l => new Date(l.created_at) > new Date(seen)).length;
        setUnreadCount(unseenCount);
      } else {
        setUnreadCount(data.length > 0 ? data.length : 0);
      }
    }
  };

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
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="end">
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
