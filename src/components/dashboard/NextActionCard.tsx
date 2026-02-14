import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, UserPlus, MessageSquare, CalendarCheck, Clock, CheckCircle2 } from 'lucide-react';
import { differenceInMinutes, format } from 'date-fns';
import { cn } from '@/lib/utils';

interface NextActionItem {
  priority: number;
  icon: React.ReactNode;
  label: string;
  subLabel?: string;
  actionLabel: string;
  onAction: () => void;
  colorClass: string;
}

interface NextActionCardProps {
  unresolvedIntros: Array<{ id: string; member_name: string }>;
  newLeads: Array<{ id: string; first_name: string; last_name: string; created_at: string }>;
  followUpsDueCount: number;
  tomorrowUnconfirmedCount: number;
  allHandled: boolean;
  onLogIntro: (id: string) => void;
  onContactLead: (id: string) => void;
  onOpenFollowUps: () => void;
  onOpenTomorrow: () => void;
}

export function NextActionCard({
  unresolvedIntros,
  newLeads,
  followUpsDueCount,
  tomorrowUnconfirmedCount,
  allHandled,
  onLogIntro,
  onContactLead,
  onOpenFollowUps,
  onOpenTomorrow,
}: NextActionCardProps) {
  const nextAction = useMemo((): NextActionItem | null => {
    // P1: Unresolved intros
    if (unresolvedIntros.length > 0) {
      const intro = unresolvedIntros[0];
      return {
        priority: 1,
        icon: <AlertTriangle className="w-5 h-5" />,
        label: `Log what happened with ${intro.member_name}'s intro`,
        subLabel: `${unresolvedIntros.length} unresolved`,
        actionLabel: 'Log Outcome',
        onAction: () => onLogIntro(intro.id),
        colorClass: 'border-l-destructive bg-destructive/5',
      };
    }

    // P2: Speed-to-lead (new lead < 30 min)
    const urgentLeads = newLeads.filter(l => differenceInMinutes(new Date(), new Date(l.created_at)) < 30);
    if (urgentLeads.length > 0) {
      const lead = urgentLeads[0];
      const mins = differenceInMinutes(new Date(), new Date(lead.created_at));
      return {
        priority: 2,
        icon: <UserPlus className="w-5 h-5" />,
        label: `New lead! Contact ${lead.first_name} now`,
        subLabel: `Received ${mins}m ago`,
        actionLabel: 'Contact Now',
        onAction: () => onContactLead(lead.id),
        colorClass: 'border-l-warning bg-warning/5',
      };
    }

    // P3: Follow-ups due
    if (followUpsDueCount > 0) {
      return {
        priority: 3,
        icon: <MessageSquare className="w-5 h-5" />,
        label: `Send follow-up messages (${followUpsDueCount} due)`,
        actionLabel: 'Open Follow-Ups',
        onAction: onOpenFollowUps,
        colorClass: 'border-l-primary bg-primary/5',
      };
    }

    // P4: Tomorrow unconfirmed
    if (tomorrowUnconfirmedCount > 0) {
      return {
        priority: 4,
        icon: <CalendarCheck className="w-5 h-5" />,
        label: `Send confirmations for tomorrow (${tomorrowUnconfirmedCount} pending)`,
        actionLabel: 'View Tomorrow',
        onAction: onOpenTomorrow,
        colorClass: 'border-l-info bg-info/5',
      };
    }

    // P5: All handled
    if (allHandled) {
      return null;
    }

    return null;
  }, [unresolvedIntros, newLeads, followUpsDueCount, tomorrowUnconfirmedCount, allHandled, onLogIntro, onContactLead, onOpenFollowUps, onOpenTomorrow]);

  if (!nextAction) {
    return (
      <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/50">
        <CardContent className="p-3 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-800">All urgent items handled</p>
            <p className="text-xs text-emerald-600">Review upcoming items below</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('border-l-4', nextAction.colorClass)}>
      <CardContent className="p-3 flex items-center gap-3">
        <div className="flex-shrink-0 text-foreground">
          {nextAction.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{nextAction.label}</p>
          {nextAction.subLabel && (
            <p className="text-xs text-muted-foreground">{nextAction.subLabel}</p>
          )}
        </div>
        <Button size="sm" className="flex-shrink-0 h-8 text-xs" onClick={nextAction.onAction}>
          {nextAction.actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
