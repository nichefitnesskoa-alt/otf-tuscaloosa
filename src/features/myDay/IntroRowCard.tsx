/**
 * Single intro row card with Prep | Script | Coach buttons (3-button muscle memory).
 * Plus questionnaire status, contact info, and secondary actions.
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Send, Copy, User, Eye, Dumbbell } from 'lucide-react';
import { formatDisplayTime } from '@/lib/time/timeUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { UpcomingIntroItem } from './myDayTypes';

interface IntroRowCardProps {
  item: UpcomingIntroItem;
  isOnline: boolean;
  onSendQ: (bookingId: string) => void;
  onConfirm: (bookingId: string) => void;
}

function getQBadge(status: UpcomingIntroItem['questionnaireStatus']) {
  switch (status) {
    case 'Q_COMPLETED':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 border text-[10px] px-1.5 py-0 h-4">Complete</Badge>;
    case 'Q_SENT':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 border text-[10px] px-1.5 py-0 h-4">Not answered</Badge>;
    case 'NO_Q':
      return <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px] px-1.5 py-0 h-4">Not sent</Badge>;
  }
}

export default function IntroRowCard({
  item,
  isOnline,
  onSendQ,
  onConfirm,
}: IntroRowCardProps) {
  // "Needs attention" only if today, within 2h or past, AND missing critical prep
  const needsAttention = (() => {
    const now = new Date();
    const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (item.classDate !== todayYmd) return false;
    // Check if within 2 hours or already passed
    const introStart = new Date(item.timeStartISO);
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    if (introStart > twoHoursFromNow) return false;
    // Must have at least one critical gap
    return (item.questionnaireStatus === 'NO_Q' || !item.confirmedAt || !item.introOwner);
  })();

  const handleCopyPhone = () => {
    if (item.phone) {
      navigator.clipboard.writeText(item.phone);
      toast.success('Phone copied');
    }
  };

  const guardOnline = (fn: () => void) => () => {
    if (!isOnline) {
      toast.error('You are offline. This action requires network.');
      return;
    }
    fn();
  };

  return (
    <div className={cn(
      'rounded-lg border bg-card p-3 space-y-2',
    )}>
      {/* Row 1: Name + Q badge + other badges */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {getQBadge(item.questionnaireStatus)}
            <span className="font-semibold text-sm leading-tight">{item.memberName}</span>
            {item.isVip && (
              <Badge className="text-[10px] px-1.5 py-0 h-4 bg-purple-600 text-white border-transparent">VIP</Badge>
            )}
            {item.isSecondIntro && (
              <Badge className="text-[10px] px-1.5 py-0 h-4 bg-blue-600 text-white border-transparent">2nd</Badge>
            )}
          </div>
          {/* Time + Coach + Owner */}
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5 text-xs text-muted-foreground">
            <span>
              {formatDisplayTime(item.introTime)}
            </span>
            <span>·</span>
            <span className={cn(!item.coachName || item.coachName === 'TBD' ? 'text-destructive' : '')}>
              {item.coachName || 'Coach TBD'}
            </span>
            {item.introOwner && (
              <>
                <span>·</span>
                <span className="flex items-center gap-0.5">
                  <User className="w-3 h-3" />
                  {item.introOwner}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Contact + lead source + needs attention */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {item.phone && (
          <a
            href={`tel:${item.phone}`}
            className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0 h-4 rounded border text-muted-foreground font-normal hover:text-primary"
          >
            <Phone className="w-2.5 h-2.5" />
            {item.phone}
          </a>
        )}
        {!item.phone && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground border-muted-foreground/30">
            Phone missing
          </Badge>
        )}
        {item.leadSource && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            {item.leadSource}
          </Badge>
        )}
        {item.confirmedAt && (
          <Badge className="text-[10px] px-1.5 py-0 h-4 bg-emerald-100 text-emerald-700 border-emerald-200 border">
            Confirmed
          </Badge>
        )}
        {needsAttention && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-amber-600 border-amber-300">
            Needs attention
          </Badge>
        )}
      </div>

      {/* Row 3: Q action (small, contextual) */}
      {item.questionnaireStatus === 'NO_Q' && (
        <div>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] gap-1"
            onClick={guardOnline(() => onSendQ(item.bookingId))}
          >
            <Send className="w-2.5 h-2.5" />
            Send Questionnaire
          </Button>
        </div>
      )}
      {item.questionnaireStatus === 'Q_SENT' && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
          Questionnaire: not answered
        </Badge>
      )}

      {/* Row 4: PRIMARY BUTTONS – Prep | Script | Coach (always visible, same order) */}
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          className="h-8 flex-1 text-xs gap-1"
          onClick={() => {
            // Dispatch custom event that MyDayPage listens to
            window.dispatchEvent(new CustomEvent('myday:open-prep', { detail: { bookingId: item.bookingId } }));
          }}
        >
          <Eye className="w-3.5 h-3.5" />
          Prep
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="h-8 flex-1 text-xs gap-1"
          onClick={guardOnline(() => {
            window.dispatchEvent(new CustomEvent('myday:open-script', { detail: { bookingId: item.bookingId } }));
          })}
        >
          <Send className="w-3.5 h-3.5" />
          Script
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 flex-1 text-xs gap-1 border-blue-300 text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('myday:open-coach', { detail: { bookingId: item.bookingId } }));
          }}
        >
          <Dumbbell className="w-3.5 h-3.5" />
          Coach
        </Button>
      </div>

      {/* Row 5: Secondary actions */}
      <div className="flex items-center gap-1.5">
        {item.phone && (
          <>
            <Button variant="outline" size="sm" className="h-6 w-6 p-0" title="Copy Phone" onClick={handleCopyPhone}>
              <Copy className="w-2.5 h-2.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-6 w-6 p-0" title="Call" asChild>
              <a href={`tel:${item.phone}`}>
                <Phone className="w-2.5 h-2.5" />
              </a>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
