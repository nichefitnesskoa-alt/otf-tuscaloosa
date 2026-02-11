import { Tables } from '@/integrations/supabase/types';
import { startOfWeek, endOfWeek, subDays, isAfter, isBefore, parseISO } from 'date-fns';

interface LeadMetricsBarProps {
  leads: Tables<'leads'>[];
  activities: Tables<'lead_activities'>[];
}

export function LeadMetricsBar({ leads, activities }: LeadMetricsBarProps) {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const thirtyDaysAgo = subDays(now, 30);

  const newCount = leads.filter(l => l.stage === 'new' && !l.booked_intro_id).length;
  const contactedCount = leads.filter(l => l.stage === 'contacted' && !l.booked_intro_id).length;

  // Booked this week: leads with booked_intro_id set, updated this week
  const bookedThisWeek = leads.filter(l => {
    if (!l.booked_intro_id) return false;
    if (l.source?.startsWith('Orangebook')) return false;
    const updated = parseISO(l.updated_at);
    return isAfter(updated, weekStart) && isBefore(updated, weekEnd);
  }).length;

  // Lost this week
  const lostThisWeek = leads.filter(l => {
    if (l.stage !== 'lost') return false;
    const updated = parseISO(l.updated_at);
    return isAfter(updated, weekStart) && isBefore(updated, weekEnd);
  }).length;

  // Overdue follow-ups
  const overdueCount = leads.filter(l => {
    if (!l.follow_up_at || l.booked_intro_id || l.stage === 'lost') return false;
    return isBefore(parseISO(l.follow_up_at), now);
  }).length;

  // 30-day conversion rate
  const recent = leads.filter(l => isAfter(parseISO(l.updated_at), thirtyDaysAgo) && !l.source?.startsWith('Orangebook'));
  const bookedRecent = recent.filter(l => l.booked_intro_id).length;
  const lostRecent = recent.filter(l => l.stage === 'lost').length;
  const total = bookedRecent + lostRecent;
  const conversionRate = total > 0 ? Math.round((bookedRecent / total) * 100) : 0;

  const metrics = [
    { label: 'New', value: newCount, color: 'text-info' },
    { label: 'In Progress', value: contactedCount, color: 'text-warning' },
    { label: 'Booked', value: bookedThisWeek, color: 'text-success' },
    { label: 'Lost', value: lostThisWeek, color: 'text-muted-foreground' },
    { label: 'Overdue', value: overdueCount, color: overdueCount > 0 ? 'text-destructive' : 'text-muted-foreground', highlight: overdueCount > 0 },
    { label: 'Conv. Rate', value: `${conversionRate}%`, color: 'text-primary' },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
      {metrics.map(m => (
        <div
          key={m.label}
          className={`flex-shrink-0 rounded-lg border p-3 min-w-[100px] bg-card ${
            m.highlight ? 'border-destructive bg-destructive/5' : 'border-border'
          }`}
        >
          <p className="text-xs text-muted-foreground font-medium">{m.label}</p>
          <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
        </div>
      ))}
    </div>
  );
}
