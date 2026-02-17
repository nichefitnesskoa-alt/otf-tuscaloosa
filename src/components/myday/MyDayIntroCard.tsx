/**
 * MyDayIntroCard – Simple, reusable intro card for all MyDay sections.
 * Always shows 3 primary buttons: Prep | Script | Coach
 * Plus questionnaire status and secondary actions.
 *
 * 3-button muscle memory rule: Prep, Script, Coach in that order, always.
 */
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Copy, Eye, Send, Dumbbell, ClipboardList, Link2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export interface MyDayIntroCardBooking {
  id: string;
  member_name: string;
  class_date: string;
  intro_time: string | null;
  coach_name: string;
  phone: string | null;
  email: string | null;
  lead_source: string;
  is_vip: boolean;
  booking_status_canon: string;
  booking_status: string | null;
  originating_booking_id?: string | null;
}

export interface MyDayIntroCardRun {
  id: string;
  result_canon: string;
  result: string;
  buy_date: string | null;
  primary_objection: string | null;
  commission_amount: number | null;
}

export type QuestionnaireCardStatus = 'not_sent' | 'sent' | 'completed' | 'missing';

interface MyDayIntroCardProps {
  booking: MyDayIntroCardBooking;
  latestRun?: MyDayIntroCardRun | null;
  questionnaireStatus: QuestionnaireCardStatus;
  questionnaireId?: string | null;
  onPrep: (bookingId: string) => void;
  onScript: (bookingId: string) => void;
  onCoach: (bookingId: string) => void;
  onLogOutcome?: (bookingId: string, runId?: string) => void;
  onSendQ?: (bookingId: string) => void;
  onCopyQLink?: (bookingId: string) => void;
  className?: string;
}

function getQBadge(status: QuestionnaireCardStatus) {
  switch (status) {
    case 'completed':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 border text-[10px] px-1.5 py-0 h-4">Q Done</Badge>;
    case 'sent':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 border text-[10px] px-1.5 py-0 h-4">Q Sent</Badge>;
    case 'not_sent':
      return <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px] px-1.5 py-0 h-4">Q Missing</Badge>;
    case 'missing':
      return <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px] px-1.5 py-0 h-4">Q Missing</Badge>;
  }
}

export function MyDayIntroCard({
  booking,
  latestRun,
  questionnaireStatus,
  questionnaireId,
  onPrep,
  onScript,
  onCoach,
  onLogOutcome,
  onSendQ,
  onCopyQLink,
  className,
}: MyDayIntroCardProps) {
  const isOnline = useOnlineStatus();
  const isSecondIntro = !!booking.originating_booking_id;

  const guardOnline = (fn: () => void) => () => {
    if (!isOnline) {
      toast.error('You are offline. This action requires network.');
      return;
    }
    fn();
  };

  const handleCopyPhone = () => {
    if (booking.phone) {
      navigator.clipboard.writeText(booking.phone);
      toast.success('Phone copied');
    }
  };

  const timeDisplay = booking.intro_time
    ? format(parseISO(`2000-01-01T${booking.intro_time}`), 'h:mm a')
    : 'Time TBD';

  return (
    <div className={cn('rounded-lg border bg-card p-3 space-y-2', className)}>
      {/* Row 1: Name + Time + Coach + Badges */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm leading-tight">{booking.member_name}</span>
            {booking.is_vip && (
              <Badge className="text-[10px] px-1.5 py-0 h-4 bg-purple-600 text-white border-transparent">VIP</Badge>
            )}
            {isSecondIntro && (
              <Badge className="text-[10px] px-1.5 py-0 h-4 bg-blue-600 text-white border-transparent">2nd</Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5 text-xs text-muted-foreground">
            <span>{timeDisplay}</span>
            <span>·</span>
            <span className={cn(!booking.coach_name || booking.coach_name === 'TBD' ? 'text-destructive' : '')}>
              {booking.coach_name || 'Coach TBD'}
            </span>
          </div>
        </div>
        {/* Q badge */}
        <div className="shrink-0">
          {getQBadge(questionnaireStatus)}
        </div>
      </div>

      {/* Row 2: Meta (lead source, phone) */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {booking.phone && (
          <a
            href={`tel:${booking.phone}`}
            className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0 h-4 rounded border text-muted-foreground font-normal hover:text-primary"
          >
            <Phone className="w-2.5 h-2.5" />
            {booking.phone}
          </a>
        )}
        {!booking.phone && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-destructive border-destructive/30">
            No Phone
          </Badge>
        )}
        {booking.lead_source && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            {booking.lead_source}
          </Badge>
        )}
      </div>

      {/* Row 3: Questionnaire action (small, contextual) */}
      <div className="flex items-center gap-1.5">
        {(questionnaireStatus === 'not_sent' || questionnaireStatus === 'missing') && onSendQ && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] gap-1"
            onClick={guardOnline(() => onSendQ(booking.id))}
          >
            <Send className="w-2.5 h-2.5" />
            Send Q
          </Button>
        )}
        {questionnaireStatus === 'sent' && onSendQ && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] gap-1"
            onClick={guardOnline(() => onSendQ(booking.id))}
          >
            <Send className="w-2.5 h-2.5" />
            Resend Q
          </Button>
        )}
        {onCopyQLink && questionnaireId && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] gap-1"
            onClick={() => onCopyQLink(booking.id)}
          >
            <Link2 className="w-2.5 h-2.5" />
            Copy Q Link
          </Button>
        )}
        {questionnaireStatus === 'completed' && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] gap-1"
            onClick={() => onPrep(booking.id)}
          >
            <Eye className="w-2.5 h-2.5" />
            View Answers
          </Button>
        )}
      </div>

      {/* Row 4: PRIMARY BUTTONS – Prep | Script | Coach (always visible, same order) */}
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          className="h-8 flex-1 text-xs gap-1"
          onClick={() => onPrep(booking.id)}
        >
          <Eye className="w-3.5 h-3.5" />
          Prep
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="h-8 flex-1 text-xs gap-1"
          onClick={guardOnline(() => onScript(booking.id))}
        >
          <Send className="w-3.5 h-3.5" />
          Script
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 flex-1 text-xs gap-1 border-blue-300 text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
          onClick={() => onCoach(booking.id)}
        >
          <Dumbbell className="w-3.5 h-3.5" />
          Coach
        </Button>
      </div>

      {/* Row 5: Secondary actions */}
      <div className="flex items-center gap-1.5">
        {onLogOutcome && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] gap-1"
            onClick={() => onLogOutcome(booking.id, latestRun?.id)}
          >
            <ClipboardList className="w-2.5 h-2.5" />
            Log Outcome
          </Button>
        )}
        {booking.phone && (
          <>
            <Button variant="outline" size="sm" className="h-6 w-6 p-0" title="Copy Phone" onClick={handleCopyPhone}>
              <Copy className="w-2.5 h-2.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-6 w-6 p-0" title="Call" asChild>
              <a href={`tel:${booking.phone}`}>
                <Phone className="w-2.5 h-2.5" />
              </a>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
