/**
 * MyDayIntroCard – Simple, reusable intro card for all MyDay sections.
 * Always shows 3 primary buttons: Prep | Script | Coach
 * Plus questionnaire status as a bold full-width top banner only (no right-side bar).
 *
 * 3-button muscle memory rule: Prep, Script, Coach in that order, always.
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Copy, Eye, Send, Dumbbell, ClipboardList, Link2 } from 'lucide-react';
import { formatDisplayTime } from '@/lib/time/timeUtils';
import { formatPhoneDisplay, stripCountryCode } from '@/lib/parsing/phone';
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

function getQBar(status: QuestionnaireCardStatus) {
  switch (status) {
    case 'completed':
      return { bg: 'bg-[#16a34a]', bannerLabel: '✓ Questionnaire Complete' };
    case 'sent':
      return { bg: 'bg-[#d97706]', bannerLabel: '⚠ Questionnaire Not Answered' };
    case 'not_sent':
    case 'missing':
    default:
      return { bg: 'bg-[#dc2626]', bannerLabel: '! Questionnaire Not Sent' };
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
  const qBar = getQBar(questionnaireStatus);

  const guardOnline = (fn: () => void) => () => {
    if (!isOnline) {
      toast.error('You are offline. This action requires network.');
      return;
    }
    fn();
  };

  const handleCopyPhone = () => {
    const clean = stripCountryCode(booking.phone);
    if (clean) {
      navigator.clipboard.writeText(clean);
      toast.success('Phone copied');
    } else {
      toast.error('Invalid phone on file');
    }
  };

  const timeDisplay = formatDisplayTime(booking.intro_time);

  return (
    <div className={cn('rounded-lg border bg-card overflow-hidden', className)}>
      {/* Top status banner */}
      <div
        className={cn('w-full flex items-center justify-center px-3 py-1.5', qBar.bg)}
        style={{ minHeight: '30px' }}
      >
        <span className="text-white text-[11px] font-semibold tracking-wide text-center leading-none">
          {qBar.bannerLabel}
        </span>
      </div>

      {/* Main content */}
      <div className="p-3 space-y-2">
        {/* Row 1: Name + Time + Coach + Badges */}
        <div className="min-w-0">
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

        {/* Row 2: Meta (lead source, phone) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {booking.phone ? (() => {
            const phoneDisplay = formatPhoneDisplay(booking.phone);
            const phoneDigits = stripCountryCode(booking.phone);
            return phoneDisplay && phoneDigits ? (
              <a
                href={`tel:${phoneDigits}`}
                className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0 h-4 rounded border text-muted-foreground font-normal hover:text-primary"
              >
                <Phone className="w-2.5 h-2.5" />
                {phoneDisplay}
              </a>
            ) : (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-destructive border-destructive/30">
                ⚠ Invalid phone
              </Badge>
            );
          })() : (
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
    </div>
  );
}
