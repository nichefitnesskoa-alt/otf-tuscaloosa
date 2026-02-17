/**
 * Single intro row card with risk indicators, contact info, and "Next Action" button.
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, FileText, Send, Copy, User, Eye } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { UpcomingIntroItem } from './myDayTypes';

interface IntroRowCardProps {
  item: UpcomingIntroItem;
  isOnline: boolean;
  onSendQ: (bookingId: string) => void;
  onConfirm: (bookingId: string) => void;
  onOpenPrep: (bookingId: string) => void;
  onOpenScript: (bookingId: string) => void;
}

function getQBadge(status: UpcomingIntroItem['questionnaireStatus']) {
  switch (status) {
    case 'Q_COMPLETED':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 border text-[10px] px-1.5 py-0 h-4">Q Done</Badge>;
    case 'Q_SENT':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 border text-[10px] px-1.5 py-0 h-4">Q Sent</Badge>;
    case 'NO_Q':
      return <Badge variant="outline" className="text-muted-foreground text-[10px] px-1.5 py-0 h-4">No Q</Badge>;
  }
}

function getNextAction(item: UpcomingIntroItem): { label: string; action: 'sendQ' | 'nudgeQ' | 'confirm' | 'prep' } {
  if (item.questionnaireStatus === 'NO_Q') return { label: 'Send Q', action: 'sendQ' };
  if (item.questionnaireStatus === 'Q_SENT') return { label: 'Nudge Q', action: 'nudgeQ' };
  if (!item.confirmedAt) return { label: 'Confirm', action: 'confirm' };
  return { label: 'Prep', action: 'prep' };
}

export default function IntroRowCard({
  item,
  isOnline,
  onSendQ,
  onConfirm,
  onOpenPrep,
  onOpenScript,
}: IntroRowCardProps) {
  const nextAction = getNextAction(item);
  const hasAnyRisk = item.riskScore > 0;

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

  const handleNextAction = guardOnline(() => {
    switch (nextAction.action) {
      case 'sendQ': onSendQ(item.bookingId); break;
      case 'nudgeQ': onOpenScript(item.bookingId); break;
      case 'confirm': onConfirm(item.bookingId); break;
      case 'prep': onOpenPrep(item.bookingId); break;
    }
  });

  return (
    <div className={cn(
      'rounded-lg border bg-card p-3 transition-all',
      hasAnyRisk && 'border-l-4 border-l-destructive/50',
    )}>
      {/* Row 1: Name + badges */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm leading-tight">{item.memberName}</span>
            {item.isVip && (
              <Badge className="text-[10px] px-1.5 py-0 h-4 bg-purple-600 text-white border-transparent">VIP</Badge>
            )}
            {item.isSecondIntro && (
              <Badge className="text-[10px] px-1.5 py-0 h-4 bg-blue-600 text-white border-transparent">2nd</Badge>
            )}
          </div>
          {/* Row 2: Time + Coach + Owner */}
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5 text-xs text-muted-foreground">
            <span>
              {item.introTime
                ? format(parseISO(`2000-01-01T${item.introTime}`), 'h:mm a')
                : 'Time TBD'}
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
            {!item.introOwner && (
              <>
                <span>·</span>
                <span className="text-destructive flex items-center gap-0.5">
                  <User className="w-3 h-3" />
                  No owner
                </span>
              </>
            )}
          </div>
        </div>
        {/* Q badge */}
        <div className="shrink-0">
          {getQBadge(item.questionnaireStatus)}
        </div>
      </div>

      {/* Row 3: Contact + Risk flags */}
      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
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
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-destructive border-destructive/30">
            No Phone
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
      </div>

      {/* Row 4: Action buttons */}
      <div className="flex items-center gap-1.5 mt-2">
        {/* Next Action (primary) */}
        <Button
          size="sm"
          className="h-7 text-[11px] flex-1"
          onClick={handleNextAction}
        >
          {nextAction.label}
        </Button>

        {/* Secondary actions */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          title="Send Script"
          onClick={guardOnline(() => onOpenScript(item.bookingId))}
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          title="Prep"
          onClick={() => onOpenPrep(item.bookingId)}
        >
          <Eye className="w-3.5 h-3.5" />
        </Button>
        {item.phone && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            title="Copy Phone"
            onClick={handleCopyPhone}
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
        )}
        {item.phone && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            title="Call"
            asChild
          >
            <a href={`tel:${item.phone}`}>
              <Phone className="w-3.5 h-3.5" />
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
