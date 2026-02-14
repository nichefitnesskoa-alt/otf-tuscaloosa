import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Calendar, MessageSquare, Users, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { getLocalDateString } from '@/lib/utils';

interface AutoCapturedItem {
  type: 'intro_logged' | 'script_sent' | 'follow_up_sent' | 'booking_made' | 'phone_copied';
  label: string;
  detail: string;
  timestamp: string;
}

interface ShiftRecapAutoBuildProps {
  onItemCount: (count: number) => void;
}

export function ShiftRecapAutoBuild({ onItemCount }: ShiftRecapAutoBuildProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<AutoCapturedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAutoItems();
  }, [user?.name]);

  const fetchAutoItems = async () => {
    if (!user?.name) return;
    const today = getLocalDateString();
    const todayStart = today + 'T00:00:00';

    try {
      const [actionsRes, followUpsRes, introsRunRes] = await Promise.all([
        // Script actions (scripts sent, phones copied, intros logged, q sent)
        supabase
          .from('script_actions')
          .select('action_type, script_category, booking_id, completed_at, completed_by')
          .eq('completed_by', user.name)
          .gte('completed_at', todayStart)
          .order('completed_at', { ascending: true }),

        // Follow-ups sent today
        supabase
          .from('follow_up_queue')
          .select('person_name, sent_at, touch_number')
          .eq('status', 'sent')
          .eq('sent_by', user.name)
          .gte('sent_at', todayStart)
          .order('sent_at', { ascending: true }),

        // Intros run (logged via inline logger)
        supabase
          .from('intros_run')
          .select('member_name, result, created_at, sa_name')
          .eq('sa_name', user.name)
          .gte('created_at', todayStart)
          .order('created_at', { ascending: true }),
      ]);

      const captured: AutoCapturedItem[] = [];

      // Script actions
      for (const a of actionsRes.data || []) {
        const time = format(new Date(a.completed_at), 'h:mm a');
        if (a.action_type === 'script_sent') {
          captured.push({
            type: 'script_sent',
            label: `Script sent`,
            detail: `${a.script_category || 'message'} · ${time}`,
            timestamp: a.completed_at,
          });
        } else if (a.action_type === 'phone_copied') {
          captured.push({
            type: 'phone_copied',
            label: 'Phone copied',
            detail: time,
            timestamp: a.completed_at,
          });
        }
      }

      // Follow-ups
      for (const f of followUpsRes.data || []) {
        captured.push({
          type: 'follow_up_sent',
          label: `Follow-up: ${f.person_name}`,
          detail: `Touch ${f.touch_number} · ${format(new Date(f.sent_at!), 'h:mm a')}`,
          timestamp: f.sent_at!,
        });
      }

      // Intros run
      for (const r of introsRunRes.data || []) {
        captured.push({
          type: 'intro_logged',
          label: `Intro: ${r.member_name}`,
          detail: `${r.result} · ${format(new Date(r.created_at), 'h:mm a')}`,
          timestamp: r.created_at,
        });
      }

      // Sort by time
      captured.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      setItems(captured);
      onItemCount(captured.length);
    } catch (err) {
      console.error('AutoBuild fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || items.length === 0) return null;

  const typeIcons: Record<string, typeof CheckCircle2> = {
    intro_logged: Calendar,
    script_sent: MessageSquare,
    follow_up_sent: Users,
    booking_made: Calendar,
    phone_copied: CheckCircle2,
  };

  const typeColors: Record<string, string> = {
    intro_logged: 'text-primary',
    script_sent: 'text-info',
    follow_up_sent: 'text-warning',
    booking_made: 'text-emerald-600',
    phone_copied: 'text-muted-foreground',
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Auto-Captured from My Day
          <Badge variant="secondary" className="text-[10px] ml-auto">{items.length} items</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {items.map((item, i) => {
          const Icon = typeIcons[item.type] || CheckCircle2;
          const color = typeColors[item.type] || 'text-muted-foreground';
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${color}`} />
              <span className="font-medium">{item.label}</span>
              <span className="text-muted-foreground ml-auto">{item.detail}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
