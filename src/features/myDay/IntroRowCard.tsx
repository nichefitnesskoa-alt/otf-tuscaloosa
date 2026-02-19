/**
 * Single intro row card with Prep | Script | Coach | Outcome buttons.
 * Outcome expands an inline drawer that routes through canonical applyIntroOutcomeUpdate.
 * Q status is displayed as a bold full-width top banner.
 */
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Phone, Copy, User, Eye, Dumbbell, ClipboardList, Send } from 'lucide-react';
import { formatDisplayTime } from '@/lib/time/timeUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { UpcomingIntroItem } from './myDayTypes';
import { OutcomeDrawer } from '@/components/myday/OutcomeDrawer';
import { StatusBanner } from '@/components/shared/StatusBanner';
import { supabase } from '@/integrations/supabase/client';

interface IntroRowCardProps {
  item: UpcomingIntroItem;
  isOnline: boolean;
  userName: string;
  onSendQ: (bookingId: string) => void;
  onConfirm: (bookingId: string) => void;
  onRefresh: () => void;
  /** When true, show the purple Needs Outcome banner instead of Q status */
  needsOutcome?: boolean;
}

function getQBar(status: UpcomingIntroItem['questionnaireStatus']) {
  switch (status) {
    case 'Q_COMPLETED':
      return { bg: 'bg-[#16a34a]', label: 'Q✓', title: 'Complete', bannerLabel: '✓ Questionnaire Complete' };
    case 'Q_SENT':
      return { bg: 'bg-[#d97706]', label: 'Q?', title: 'Not answered', bannerLabel: '⚠ Questionnaire Not Answered' };
    case 'NO_Q':
    default:
      return { bg: 'bg-[#dc2626]', label: 'Q!', title: 'Not sent', bannerLabel: '! Questionnaire Not Sent' };
  }
}

export default function IntroRowCard({
  item,
  isOnline,
  userName,
  onSendQ,
  onConfirm,
  onRefresh,
  needsOutcome = false,
}: IntroRowCardProps) {
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [prepped, setPrepped] = useState(item.prepped);
  const [preppedSaving, setPreppedSaving] = useState(false);
  const qBar = getQBar(item.questionnaireStatus);

  const handleTogglePrepped = async (checked: boolean) => {
    if (!isOnline) { toast.error('You are offline. This action requires network.'); return; }
    setPrepped(checked);
    setPreppedSaving(true);
    try {
      const { error } = await supabase.from('intros_booked').update({
        prepped: checked,
        prepped_at: checked ? new Date().toISOString() : null,
        prepped_by: checked ? userName : null,
        last_edited_at: new Date().toISOString(),
        last_edited_by: userName,
      }).eq('id', item.bookingId);
      if (error) throw error;
    } catch {
      setPrepped(!checked); // revert
      toast.error('Failed to save prep status');
    } finally {
      setPreppedSaving(false);
    }
  };

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

  // Determine border color from banner color
  const borderColor = needsOutcome
    ? '#7c3aed'
    : item.isSecondIntro
    ? '#6b7280'
    : item.questionnaireStatus === 'Q_COMPLETED'
    ? '#16a34a'
    : item.questionnaireStatus === 'Q_SENT'
    ? '#d97706'
    : '#dc2626';

  return (
    <div className="rounded-lg bg-card overflow-hidden" style={{ border: `2px solid ${borderColor}` }}>
      {/* Top status banner */}
      {needsOutcome ? (
        <StatusBanner bgColor="#7c3aed" text="⚠ Outcome Not Logged" />
      ) : item.isSecondIntro ? (
        <StatusBanner bgColor="#64748b" text="2nd Visit — No questionnaire needed" />
      ) : (
        <StatusBanner
          bgColor={item.questionnaireStatus === 'Q_COMPLETED' ? '#16a34a' : item.questionnaireStatus === 'Q_SENT' ? '#d97706' : '#dc2626'}
          text={qBar.bannerLabel}
        />
      )}

      {/* Intro number label */}
      <div className="w-full flex items-center justify-center py-0.5 bg-muted/30 border-b">
        <span className="text-[10px] text-muted-foreground font-medium">
          {item.isSecondIntro ? '2nd Intro Visit' : '1st Intro'}
        </span>
      </div>

      {/* Main content */}
      <div className="p-3 space-y-2">
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
            <Badge className="text-[10px] px-1.5 py-0 h-auto py-0.5 bg-destructive text-destructive-foreground">
              📵 Phone missing — add before class
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

        {/* Prepped checkbox */}
        <div className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded-md border transition-colors',
          prepped ? 'bg-success/10 border-success/30' : 'bg-muted/20 border-border'
        )}>
          <Checkbox
            id={`prepped-${item.bookingId}`}
            checked={prepped}
            onCheckedChange={(val) => handleTogglePrepped(!!val)}
            disabled={preppedSaving}
          />
          <label
            htmlFor={`prepped-${item.bookingId}`}
            className={cn(
              'text-xs font-medium cursor-pointer select-none',
              prepped ? 'text-success' : 'text-muted-foreground'
            )}
          >
            {prepped ? '✓ Prepped before class' : 'Prepped ✓ (tap to mark)'}
          </label>
          {preppedSaving && <span className="text-[10px] text-muted-foreground">saving…</span>}
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
          initialPrepped={prepped}
          onSaved={() => { setOutcomeOpen(false); onRefresh(); }}
          onCancel={() => setOutcomeOpen(false)}
        />
      )}
    </div>
  );
}
