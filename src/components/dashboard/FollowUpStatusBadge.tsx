import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { MessageSquare } from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';

interface FollowUpStatus {
  touch_number: number;
  status: string;
  scheduled_date: string;
  sent_at: string | null;
}

interface FollowUpStatusBadgeProps {
  personName: string;
  bookingId?: string | null;
}

export function FollowUpStatusBadge({ personName, bookingId }: FollowUpStatusBadgeProps) {
  const [statuses, setStatuses] = useState<FollowUpStatus[]>([]);

  useEffect(() => {
    if (!personName) return;
    supabase
      .from('follow_up_queue')
      .select('touch_number, status, scheduled_date, sent_at')
      .eq('person_name', personName)
      .order('touch_number', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) setStatuses(data as FollowUpStatus[]);
      });
  }, [personName]);

  if (statuses.length === 0) return null;

  const allDone = statuses.every(s => s.status === 'sent' || s.status === 'converted' || s.status === 'dormant' || s.status === 'skipped');
  const converted = statuses.some(s => s.status === 'converted');
  const currentTouch = statuses.find(s => s.status === 'pending');
  const lastSent = [...statuses].reverse().find(s => s.status === 'sent');

  // Check if in cooling period
  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');
  const isAvailable = currentTouch && currentTouch.scheduled_date <= today;

  if (converted) {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-success/10 text-success border-success/30 gap-1">
        <MessageSquare className="w-2.5 h-2.5" />
        Converted
      </Badge>
    );
  }

  if (allDone) {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground gap-1">
        <MessageSquare className="w-2.5 h-2.5" />
        Follow-up complete · Dormant
      </Badge>
    );
  }

  if (currentTouch) {
    return (
      <Badge
        variant="outline"
        className={`text-[10px] px-1.5 py-0 h-4 gap-1 ${
          isAvailable
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'text-muted-foreground'
        }`}
      >
        <MessageSquare className="w-2.5 h-2.5" />
        Touch {currentTouch.touch_number}/3
        {lastSent?.sent_at && ` · Last: ${format(parseISO(lastSent.sent_at), 'MMM d')}`}
        {isAvailable ? ' · Available now' : ` · Next: ${format(parseISO(currentTouch.scheduled_date + 'T00:00:00'), 'MMM d')}`}
      </Badge>
    );
  }

  return null;
}
