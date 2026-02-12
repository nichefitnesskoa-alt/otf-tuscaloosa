import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Clock, Send } from 'lucide-react';
import { ScriptPickerSheet } from '@/components/scripts/ScriptPickerSheet';
import { useAuth } from '@/context/AuthContext';
import { differenceInDays, differenceInHours, parseISO } from 'date-fns';

interface FollowUpItem {
  id: string;
  personName: string;
  nextAction: string;
  nextTemplateCategory: string;
  nextSequenceOrder: number;
  daysOverdue: number;
  hoursOverdue: number;
  leadId?: string;
  bookingId?: string;
  sentBy: string;
  mergeContext: Record<string, string>;
}

/** Parse timing_note to estimate days between steps */
function parseDaysFromTimingNote(note: string | null): number {
  if (!note) return 3; // default 3 days
  const lower = note.toLowerCase();
  if (lower.includes('same day')) return 0;
  if (lower.includes('24-48 hour')) return 2;
  if (lower.includes('3-5 day')) return 4;
  if (lower.includes('1-2 week')) return 10;
  if (lower.includes('7 day')) return 7;
  if (lower.includes('3 day')) return 3;
  const match = lower.match(/(\d+)\s*day/);
  if (match) return parseInt(match[1], 10);
  const weekMatch = lower.match(/(\d+)\s*week/);
  if (weekMatch) return parseInt(weekMatch[1], 10) * 7;
  return 3;
}

export function FollowUpQueue() {
  const { user } = useAuth();
  const [open, setOpen] = useState(true);
  const [selectedItem, setSelectedItem] = useState<FollowUpItem | null>(null);

  const { data: followUps = [], isLoading } = useQuery({
    queryKey: ['follow_up_queue'],
    queryFn: async () => {
      // Get all send logs
      const { data: logs, error: logErr } = await supabase
        .from('script_send_log')
        .select('*')
        .order('sent_at', { ascending: true });
      if (logErr) throw logErr;

      // Get all sequence templates
      const { data: templates, error: tplErr } = await supabase
        .from('script_templates')
        .select('*')
        .not('sequence_order', 'is', null)
        .eq('is_active', true)
        .order('category')
        .order('sequence_order');
      if (tplErr) throw tplErr;

      // Get leads and bookings for names
      const { data: leads } = await supabase.from('leads').select('id, first_name, last_name, stage');
      const { data: bookings } = await supabase
        .from('intros_booked')
        .select('id, member_name, class_date, intro_time, booking_status')
        .is('deleted_at', null);

      const leadMap = new Map((leads || []).map(l => [l.id, l]));
      const bookingMap = new Map((bookings || []).map(b => [b.id, b]));

      // Group logs by lead_id or booking_id + category
      const groupedByEntity = new Map<string, typeof logs>();
      
      // For each log, determine its category from the template
      const templateMap = new Map((templates || []).map(t => [t.id, t]));

      for (const log of logs || []) {
        const tpl = templateMap.get(log.template_id);
        if (!tpl) continue;
        
        const entityKey = log.lead_id
          ? `lead:${log.lead_id}:${tpl.category}`
          : log.booking_id
          ? `booking:${log.booking_id}:${tpl.category}`
          : null;
        if (!entityKey) continue;

        if (!groupedByEntity.has(entityKey)) groupedByEntity.set(entityKey, []);
        groupedByEntity.get(entityKey)!.push(log);
      }

      const items: FollowUpItem[] = [];

      for (const [key, entityLogs] of groupedByEntity) {
        const [type, entityId, category] = key.split(':');
        
        // Get sequence templates for this category
        const categoryTemplates = (templates || [])
          .filter(t => t.category === category)
          .sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0));
        
        if (categoryTemplates.length === 0) continue;

        // Find max step sent
        const sentSteps = new Set(entityLogs.map(l => l.sequence_step_number));
        const maxSentStep = Math.max(...Array.from(sentSteps).filter(s => s !== null) as number[]);
        
        // Find next template in sequence
        const nextTemplate = categoryTemplates.find(t => (t.sequence_order || 0) > maxSentStep);
        if (!nextTemplate) continue; // sequence complete

        // Skip variants (only take first at each sequence_order)
        const sameOrderTemplates = categoryTemplates.filter(t => t.sequence_order === nextTemplate.sequence_order);
        const primaryNext = sameOrderTemplates[0];

        // Find the last sent log to calculate overdue
        const lastSentLog = entityLogs
          .filter(l => l.sequence_step_number !== null)
          .sort((a, b) => b.sent_at.localeCompare(a.sent_at))[0];
        
        if (!lastSentLog) continue;

        const daysBetween = parseDaysFromTimingNote(primaryNext.timing_note);
        const sentDate = parseISO(lastSentLog.sent_at);
        const now = new Date();
        const hoursSinceSent = differenceInHours(now, sentDate);
        const dueInHours = daysBetween * 24;
        const hoursOverdue = hoursSinceSent - dueInHours;

        // Only show items that are due within 24 hours or overdue
        if (hoursOverdue < -24) continue;

        let personName = 'Unknown';
        let leadId: string | undefined;
        let bookingId: string | undefined;
        const mergeContext: Record<string, string> = {};

        if (type === 'lead') {
          const lead = leadMap.get(entityId);
          if (!lead || lead.stage === 'lost' || lead.stage === 'won') continue;
          personName = `${lead.first_name} ${lead.last_name}`;
          leadId = entityId;
          mergeContext['first-name'] = lead.first_name;
          mergeContext['last-name'] = lead.last_name;
        } else {
          const booking = bookingMap.get(entityId);
          if (!booking) continue;
          if (booking.booking_status === 'Cancelled') continue;
          personName = booking.member_name;
          bookingId = entityId;
          const parts = booking.member_name.split(' ');
          mergeContext['first-name'] = parts[0] || '';
          mergeContext['last-name'] = parts.slice(1).join(' ') || '';
        }

        if (user?.name) mergeContext['sa-name'] = user.name;

        items.push({
          id: key,
          personName,
          nextAction: primaryNext.name,
          nextTemplateCategory: category,
          nextSequenceOrder: primaryNext.sequence_order || 0,
          daysOverdue: Math.floor(hoursOverdue / 24),
          hoursOverdue,
          leadId,
          bookingId,
          sentBy: lastSentLog.sent_by,
          mergeContext,
        });
      }

      // Sort by most overdue first
      items.sort((a, b) => b.hoursOverdue - a.hoursOverdue);
      return items;
    },
    refetchInterval: 60000,
  });

  if (isLoading || followUps.length === 0) return null;

  const overdueCount = followUps.filter(f => f.hoursOverdue > 0).length;

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between px-3 py-2 h-auto">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Follow-Up Queue</span>
              <Badge variant="secondary" className="text-xs">
                {followUps.length}
              </Badge>
              {overdueCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {overdueCount} overdue
                </Badge>
              )}
            </div>
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-1.5 mt-1">
            {followUps.map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="w-full flex items-center gap-3 rounded-lg border bg-card p-3 text-left hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.personName}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.nextAction}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <OverdueBadge hoursOverdue={item.hoursOverdue} />
                  <Send className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {selectedItem && (
        <ScriptPickerSheet
          open={!!selectedItem}
          onOpenChange={(o) => { if (!o) setSelectedItem(null); }}
          suggestedCategories={[selectedItem.nextTemplateCategory]}
          mergeContext={selectedItem.mergeContext}
          leadId={selectedItem.leadId}
          bookingId={selectedItem.bookingId}
        />
      )}
    </>
  );
}

function OverdueBadge({ hoursOverdue }: { hoursOverdue: number }) {
  if (hoursOverdue > 24) {
    const days = Math.floor(hoursOverdue / 24);
    return (
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">
        {days}d overdue
      </span>
    );
  }
  if (hoursOverdue > 0) {
    return (
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-warning/15 text-warning">
        Due today
      </span>
    );
  }
  return (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-success/15 text-success">
      Upcoming
    </span>
  );
}

/** Hook to get overdue count for nav badge */
export function useFollowUpCount() {
  return useQuery({
    queryKey: ['follow_up_count'],
    queryFn: async () => {
      const { data: logs } = await supabase
        .from('script_send_log')
        .select('lead_id, booking_id, template_id, sequence_step_number, sent_at')
        .order('sent_at', { ascending: true });

      const { data: templates } = await supabase
        .from('script_templates')
        .select('id, category, sequence_order, timing_note')
        .not('sequence_order', 'is', null)
        .eq('is_active', true);

      if (!logs || !templates) return 0;

      const templateMap = new Map(templates.map(t => [t.id, t]));
      const grouped = new Map<string, typeof logs>();

      for (const log of logs) {
        const tpl = templateMap.get(log.template_id);
        if (!tpl) continue;
        const key = log.lead_id
          ? `lead:${log.lead_id}:${tpl.category}`
          : log.booking_id
          ? `booking:${log.booking_id}:${tpl.category}`
          : null;
        if (!key) continue;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(log);
      }

      let count = 0;
      for (const [key, entityLogs] of grouped) {
        const [, , category] = key.split(':');
        const catTemplates = templates.filter(t => t.category === category).sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0));
        const sentSteps = new Set(entityLogs.map(l => l.sequence_step_number).filter(s => s !== null));
        const maxSent = Math.max(...(Array.from(sentSteps) as number[]));
        const nextTpl = catTemplates.find(t => (t.sequence_order || 0) > maxSent);
        if (!nextTpl) continue;

        const lastLog = entityLogs.filter(l => l.sequence_step_number !== null).sort((a, b) => b.sent_at.localeCompare(a.sent_at))[0];
        if (!lastLog) continue;

        const daysBetween = parseDaysFromTimingNote(nextTpl.timing_note);
        const hoursOverdue = differenceInHours(new Date(), parseISO(lastLog.sent_at)) - daysBetween * 24;
        if (hoursOverdue > 0) count++;
      }

      return count;
    },
    refetchInterval: 120000,
  });
}
