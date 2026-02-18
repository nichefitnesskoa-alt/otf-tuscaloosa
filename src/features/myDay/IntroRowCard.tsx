/**
 * Single intro row card with Prep | Script | Coach | Outcome buttons.
 * Outcome expands an inline drawer that routes through canonical applyIntroOutcomeUpdate.
 * Q status is displayed as a bold full-height vertical bar on the right side.
 */
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Copy, User, Eye, Dumbbell, ClipboardList, Send } from 'lucide-react';
import { formatDisplayTime } from '@/lib/time/timeUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { UpcomingIntroItem } from './myDayTypes';
import { OutcomeDrawer } from '@/components/myday/OutcomeDrawer';

interface IntroRowCardProps {
  item: UpcomingIntroItem;
  isOnline: boolean;
  userName: string;
  onSendQ: (bookingId: string) => void;
  onConfirm: (bookingId: string) => void;
  onRefresh: () => void;
}

function getQBar(status: UpcomingIntroItem['questionnaireStatus']) {
  switch (status) {
    case 'Q_COMPLETED':
      return { bg: 'bg-[#16a34a]', label: 'Q✓', title: 'Complete' };
    case 'Q_SENT':
      return { bg: 'bg-[#d97706]', label: 'Q?', title: 'Not answered' };
    case 'NO_Q':
    default:
      return { bg: 'bg-[#dc2626]', label: 'Q!', title: 'Not sent' };
  }
}

export default function IntroRowCard({
  item,
  isOnline,
  userName,
  onSendQ,
  onConfirm,
  onRefresh,
}: IntroRowCardProps) {
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const qBar = getQBar(item.questionnaireStatus);

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
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Main content row: left content + right Q bar */}
      <div className="flex min-h-0">
        {/* Left: all card content */}
        <div className="flex-1 min-w-0 p-3 space-y-2">
          {/* Row 1: Name + badges */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
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
              <span>{formatDisplayTime(item.introTime)}</span>
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

          {/* Row 2: Contact + lead source */}
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
                <Copy className="w-2.5 h-2.5" />
                Copy Q Link
              </Button>
            </div>
          )}

          {/* Row 4: PRIMARY BUTTONS – Prep | Script | Coach | Outcome */}
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              className="h-8 flex-1 text-xs gap-1"
              onClick={() => {
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
            <Button
              size="sm"
              variant={outcomeOpen ? 'default' : 'outline'}
              className="h-8 flex-1 text-xs gap-1"
              onClick={() => setOutcomeOpen(v => !v)}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Outcome
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

        {/* Right: Full-height Q status bar */}
        <div
          className={cn(
            'flex-shrink-0 w-12 flex flex-col items-center justify-center',
            qBar.bg
          )}
          title={qBar.title}
          aria-label={`Questionnaire status: ${qBar.title}`}
        >
          <span
            className="text-white font-bold text-[11px] leading-none select-none"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: '0.05em' }}
          >
            {qBar.label}
          </span>
        </div>
      </div>

      {/* Outcome drawer – expands below the card */}
      {outcomeOpen && (
        <OutcomeDrawer
          bookingId={item.bookingId}
          memberName={item.memberName}
          classDate={item.classDate}
          leadSource={item.leadSource || ''}
          existingRunId={null}
          currentResult={item.latestRunResult}
          editedBy={userName}
          onSaved={() => { setOutcomeOpen(false); onRefresh(); }}
          onCancel={() => setOutcomeOpen(false)}
        />
      )}
    </div>
  );
}
