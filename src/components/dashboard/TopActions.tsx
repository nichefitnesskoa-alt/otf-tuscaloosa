import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Zap, MessageSquare, Phone, ClipboardList, UserPlus } from 'lucide-react';
import { differenceInMinutes, isToday, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface ActionItem {
  id: string;
  label: string;
  sublabel: string;
  urgency: number;
  type: 'intro' | 'followup' | 'lead' | 'prep' | 'q';
  onClick?: () => void;
}

interface TopActionsProps {
  todayBookings: Array<{
    id: string;
    member_name: string;
    intro_time: string | null;
    questionnaire_status: string | null;
    intro_result?: string | null;
    class_date: string;
  }>;
  tomorrowBookings: Array<{
    id: string;
    member_name: string;
    questionnaire_status?: string | null;
  }>;
  newLeads: Array<{
    id: string;
    first_name: string;
    last_name: string;
    created_at: string;
    source: string;
  }>;
  followUpsDueCount: number;
  completedActions: Set<string>;
  onScrollTo?: (sectionId: string) => void;
}

export function TopActions({
  todayBookings,
  tomorrowBookings,
  newLeads,
  followUpsDueCount,
  completedActions,
  onScrollTo,
}: TopActionsProps) {
  const [realFollowUpsDue, setRealFollowUpsDue] = useState(followUpsDueCount);

  // Fetch real follow-up count from DB
  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    supabase
      .from('follow_up_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lte('scheduled_date', today)
      .eq('is_vip', false)
      .then(({ count }) => {
        setRealFollowUpsDue(count || followUpsDueCount);
      });
  }, [followUpsDueCount]);

  const actions = useMemo(() => {
    const items: ActionItem[] = [];

    // Today's intros without outcome logged
    todayBookings.forEach(b => {
      if (!b.intro_result) {
        const qMissing = !b.questionnaire_status || b.questionnaire_status === 'not_sent';
        items.push({
          id: `intro-${b.id}`,
          label: b.member_name,
          sublabel: qMissing ? 'Intro today — Q not sent!' : 'Intro today — log outcome',
          urgency: qMissing ? 95 : 80,
          type: 'intro',
          onClick: () => onScrollTo?.('todays-intros'),
        });
      }
    });

    // New leads not contacted within 30 min
    newLeads.forEach(l => {
      const mins = differenceInMinutes(new Date(), new Date(l.created_at));
      if (mins < 60 && isToday(new Date(l.created_at))) {
        const isReferral = l.source?.toLowerCase().includes('referral');
        items.push({
          id: `lead-${l.id}`,
          label: `${l.first_name} ${l.last_name}`,
          sublabel: `New lead ${mins}m ago`,
          urgency: mins < 5 ? 90 : mins < 15 ? 75 : 60,
          type: 'lead',
          onClick: () => onScrollTo?.('new-leads'),
        });
        if (isReferral) {
          items[items.length - 1].urgency += 10;
          items[items.length - 1].sublabel += ' (referral!)';
        }
      }
    });

    // Follow-ups due (real count)
    if (realFollowUpsDue > 0) {
      items.push({
        id: 'followups',
        label: `${realFollowUpsDue} follow-up${realFollowUpsDue > 1 ? 's' : ''} due`,
        sublabel: 'Needs attention today',
        urgency: 70,
        type: 'followup',
        onClick: () => onScrollTo?.('followups-due'),
      });
    }

    // Tomorrow intros without Q
    tomorrowBookings.forEach(b => {
      const qMissing = !b.questionnaire_status || b.questionnaire_status === 'not_sent';
      if (qMissing) {
        items.push({
          id: `tmrw-q-${b.id}`,
          label: b.member_name,
          sublabel: 'Tomorrow — send Q now',
          urgency: 55,
          type: 'q',
          onClick: () => onScrollTo?.('tomorrows-intros'),
        });
      }
    });

    return items.sort((a, b) => b.urgency - a.urgency).slice(0, 5);
  }, [todayBookings, tomorrowBookings, newLeads, realFollowUpsDue, completedActions, onScrollTo]);

  if (actions.length === 0) return null;

  const iconMap = {
    intro: <ClipboardList className="w-3.5 h-3.5" />,
    followup: <Phone className="w-3.5 h-3.5" />,
    lead: <UserPlus className="w-3.5 h-3.5" />,
    prep: <MessageSquare className="w-3.5 h-3.5" />,
    q: <ClipboardList className="w-3.5 h-3.5" />,
  };

  const colorMap = {
    intro: 'border-l-orange-400',
    followup: 'border-l-yellow-500',
    lead: 'border-l-blue-400',
    prep: 'border-l-purple-400',
    q: 'border-l-teal-400',
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-center gap-1.5 mb-1">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold">Top Actions</span>
        </div>
        {actions.map(a => (
          <button
            key={a.id}
            onClick={a.onClick}
            className={`w-full text-left flex items-center gap-2 p-2 rounded border-l-4 ${colorMap[a.type]} bg-card hover:bg-muted/50 transition-colors`}
          >
            <span className="text-muted-foreground flex-shrink-0">{iconMap[a.type]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{a.label}</p>
              <p className="text-[11px] text-muted-foreground">{a.sublabel}</p>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
