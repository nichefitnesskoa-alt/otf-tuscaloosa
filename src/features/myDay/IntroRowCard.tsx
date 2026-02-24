/**
 * Single intro row card with Prep | Script | Coach | Outcome buttons.
 * Outcome expands an inline drawer that routes through canonical applyIntroOutcomeUpdate.
 * Q status is displayed as a bold full-width top banner.
 */
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Phone, Copy, User, Eye, Dumbbell, ClipboardList, Send, CheckCircle } from 'lucide-react';
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
  const [logSentLoading, setLogSentLoading] = useState(false);
  const [localQStatus, setLocalQStatus] = useState(item.questionnaireStatus);
  const qBar = getQBar(localQStatus);

  // Auto-detect questionnaire completion every 30s
  useEffect(() => {
    if (localQStatus === 'Q_COMPLETED' || item.isSecondIntro) return;
    const check = async () => {
      const { data } = await supabase
        .from('intro_questionnaires')
        .select('status')
        .eq('booking_id', item.bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        const s = (data as any).status;
        if (s === 'completed' || s === 'submitted') setLocalQStatus('Q_COMPLETED');
        else if (s === 'sent') setLocalQStatus('Q_SENT');
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [item.bookingId, item.isSecondIntro, localQStatus]);

  // Sync from parent when item changes
  useEffect(() => {
    setLocalQStatus(item.questionnaireStatus);
  }, [item.questionnaireStatus]);

  const handleLogAsSent = async () => {
    if (!isOnline) { toast.error('Offline'); return; }
    setLogSentLoading(true);
    try {
      // Check if Q exists for this booking
      const { data: existing } = await supabase
        .from('intro_questionnaires')
        .select('id, status')
        .eq('booking_id', item.bookingId)
        .maybeSingle();

      if (existing) {
        const s = (existing as any).status;
        if (s === 'completed' || s === 'submitted') {
          setLocalQStatus('Q_COMPLETED');
          toast.success('Questionnaire already completed!');
          return;
        }
        if (s !== 'sent') {
          await supabase.from('intro_questionnaires').update({ status: 'sent' }).eq('id', existing.id);
        }
      } else {
        // Create a minimal Q record marked as sent
        const nameParts = item.memberName.trim().split(/\s+/);
        const firstName = nameParts[0] || item.memberName;
        const lastName = nameParts.slice(1).join(' ') || '';
        await supabase.from('intro_questionnaires').insert({
          booking_id: item.bookingId,
          client_first_name: firstName,
          client_last_name: lastName,
          scheduled_class_date: item.classDate,
          status: 'sent',
        } as any);
      }
      setLocalQStatus('Q_SENT');
      toast.success('Logged as sent');
      onRefresh();
    } catch {
      toast.error('Failed to log');
    } finally {
      setLogSentLoading(false);
    }
  };

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
    : localQStatus === 'Q_COMPLETED'
    ? '#16a34a'
    : localQStatus === 'Q_SENT'
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
          bgColor={localQStatus === 'Q_COMPLETED' ? '#16a34a' : localQStatus === 'Q_SENT' ? '#d97706' : '#dc2626'}
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

        {/* Prepped & Role Played checkbox */}
        <div className={cn(
          'flex items-start gap-2 px-2 py-1.5 rounded-md border transition-colors',
          prepped ? 'bg-success/10 border-success/30' : 'bg-muted/20 border-border'
        )}>
          <Checkbox
            id={`prepped-${item.bookingId}`}
            checked={prepped}
            onCheckedChange={(val) => handleTogglePrepped(!!val)}
            disabled={preppedSaving}
            className="mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <label
              htmlFor={`prepped-${item.bookingId}`}
              className={cn(
                'text-xs font-medium cursor-pointer select-none block',
                prepped ? 'text-success' : 'text-muted-foreground'
              )}
              title="This means you reviewed their prep card AND role played digging deeper on their why and handling their likely objection before they walked in."
            >
              {prepped ? '✓ Prepped & Role Played' : 'Prepped & Role Played (tap to mark)'}
            </label>
            <p className="text-[10px] text-muted-foreground leading-tight">
              Reviewed card + practiced dig deeper + objection handling
            </p>
          </div>
          {preppedSaving && <span className="text-[10px] text-muted-foreground">saving…</span>}
        </div>

        {/* Row 5: Log as Sent + Secondary actions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {!item.isSecondIntro && (localQStatus === 'NO_Q') && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1 border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
              onClick={handleLogAsSent}
              disabled={logSentLoading}
            >
              <CheckCircle className="w-3 h-3" />
              {logSentLoading ? 'Saving…' : 'Log Q as Sent'}
            </Button>
          )}
          {!item.isSecondIntro && localQStatus === 'Q_SENT' && (
            <Badge className="text-[10px] px-1.5 py-0 h-5 bg-amber-100 text-amber-700 border-amber-300 border">
              ⏳ Waiting for response
            </Badge>
          )}
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
          existingRunId={item.latestRunId}
          currentResult={item.latestRunResult}
          editedBy={userName}
          initialPrepped={prepped}
          initialCoach={item.latestRunCoach || ''}
          initialObjection={item.latestRunObjection || ''}
          initialNotes={item.latestRunNotes || ''}
          onSaved={() => { setOutcomeOpen(false); onRefresh(); }}
          onCancel={() => setOutcomeOpen(false)}
        />
      )}
    </div>
  );
}
