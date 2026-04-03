/**
 * Single intro row card using shared IntroCard for visual layout.
 * MyDay-specific logic: prep checkbox, Q status, focus mode, outcome drawer.
 * Collapsible: collapsed shows summary row, expanded shows full card.
 */
import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, ClipboardList, Send, CheckCircle, Phone, X, ChevronRight, Pencil } from 'lucide-react';
import { EditBookingDialog } from '@/components/myday/EditBookingDialog';
import { toast } from 'sonner';
import { cn, generateSlug } from '@/lib/utils';
import type { UpcomingIntroItem } from './myDayTypes';
import { OutcomeDrawer } from '@/components/myday/OutcomeDrawer';
import { StatusBanner } from '@/components/shared/StatusBanner';
import IntroCard from '@/components/shared/IntroCard';
import { TheirStory } from '@/components/shared/TheirStory';
import { SABriefFields } from '@/components/shared/SABriefFields';
import { supabase } from '@/integrations/supabase/client';
import { formatPhoneDisplay, stripCountryCode } from '@/lib/parsing/phone';
import { formatDisplayTime } from '@/lib/time/timeUtils';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';


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

function getQBadge(status: UpcomingIntroItem['questionnaireStatus']) {
  switch (status) {
    case 'Q_COMPLETED':
      return <Badge className="text-[9px] px-1.5 py-0 h-4 bg-[#16a34a] text-white border-transparent">Q Complete</Badge>;
    case 'Q_SENT':
      return <Badge className="text-[9px] px-1.5 py-0 h-4 bg-[#d97706] text-white border-transparent">Q Sent</Badge>;
    case 'NO_Q':
    default:
      return <Badge className="text-[9px] px-1.5 py-0 h-4 bg-[#dc2626] text-white border-transparent">No Q</Badge>;
  }
}

function ShoutoutLabel({ consent }: { consent: boolean | null | undefined }) {
  if (consent === true) return (
    <span className="inline-flex items-center gap-1 text-[9px] text-success font-medium shrink-0">
      <span className="w-2.5 h-2.5 rounded-full bg-success inline-block shrink-0" />
      Shoutout ✓
    </span>
  );
  if (consent === false) return (
    <span className="inline-flex items-center gap-1 text-[9px] text-destructive font-medium shrink-0">
      <span className="w-2.5 h-2.5 rounded-full bg-destructive inline-block shrink-0" />
      Shoutout ✗
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground font-medium shrink-0">
      <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40 inline-block shrink-0" />
      Shoutout?
    </span>
  );
}

interface IntroRowCardProps {
  item: UpcomingIntroItem;
  isOnline: boolean;
  userName: string;
  onSendQ: (bookingId: string) => void;
  onConfirm: (bookingId: string) => void;
  onRefresh: () => void;
  needsOutcome?: boolean;
  confirmationResult?: string | null;
  isFocused?: boolean;
  anyFocused?: boolean;
  isExpanded?: boolean;
  onExpand?: () => void;
  shoutoutConsent?: boolean | null;
}

export default function IntroRowCard({
  item,
  isOnline,
  userName,
  onSendQ,
  onConfirm,
  onRefresh,
  needsOutcome = false,
  confirmationResult,
  isFocused = false,
  anyFocused = false,
  isExpanded = true,
  onExpand,
  shoutoutConsent,
}: IntroRowCardProps) {
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [prepped, setPrepped] = useState(item.prepped);
  const [preppedSaving, setPreppedSaving] = useState(false);
  const [logSentLoading, setLogSentLoading] = useState(false);
  const [localQStatus, setLocalQStatus] = useState(item.questionnaireStatus);
  const [clearOutcomeOpen, setClearOutcomeOpen] = useState(false);
  const [clearingOutcome, setClearingOutcome] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const qBar = getQBar(localQStatus);
  const hasActiveField = useRef(false);

  // ── Focus mode: compute minutesUntilClass ──
  const [minutesUntilClass, setMinutesUntilClass] = useState<number | null>(null);

  useEffect(() => {
    if (!item.introTime || !item.classDate) { setMinutesUntilClass(null); return; }
    const compute = () => {
      try {
        const classStart = new Date(`${item.classDate}T${item.introTime}:00`);
        const now = new Date();
        const diff = Math.round((classStart.getTime() - now.getTime()) / 60000);
        setMinutesUntilClass(diff);
      } catch { setMinutesUntilClass(null); }
    };
    compute();
    const interval = setInterval(compute, 60000);
    return () => clearInterval(interval);
  }, [item.classDate, item.introTime]);

  const isInFocusWindow = isFocused && minutesUntilClass !== null && minutesUntilClass <= 120 && minutesUntilClass > 0;
  const focusHours = minutesUntilClass !== null ? Math.floor(minutesUntilClass / 60) : 0;
  const focusMins = minutesUntilClass !== null ? minutesUntilClass % 60 : 0;

  const isQOverdue = !item.isSecondIntro && localQStatus === 'Q_SENT' && minutesUntilClass !== null && minutesUntilClass <= 180 && minutesUntilClass > 0;
  const isOutcomeOverdue = !item.latestRunResult && minutesUntilClass !== null && minutesUntilClass <= -60;

  // Auto-prep 2nd visits
  useEffect(() => {
    if (item.isSecondIntro && !item.prepped && !prepped) {
      setPrepped(true);
      supabase.from('intros_booked').update({
        prepped: true,
        prepped_at: new Date().toISOString(),
        prepped_by: 'Auto (2nd visit)',
      }).eq('id', item.bookingId).then(() => {});
    }
  }, [item.isSecondIntro, item.prepped, item.bookingId]);


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

  useEffect(() => {
    setLocalQStatus(item.questionnaireStatus);
  }, [item.questionnaireStatus]);

  const handleLogAsSent = async () => {
    if (!isOnline) { toast.error('Offline'); return; }
    setLogSentLoading(true);
    try {
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
        const nameParts = item.memberName.trim().split(/\s+/);
        const firstName = nameParts[0] || item.memberName;
        const lastName = nameParts.slice(1).join(' ') || '';
        const newSlug = generateSlug(firstName, lastName, item.classDate);
        await supabase.from('intro_questionnaires').insert({
          booking_id: item.bookingId,
          client_first_name: firstName,
          client_last_name: lastName,
          scheduled_class_date: item.classDate,
          status: 'sent',
          slug: newSlug,
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
      setPrepped(!checked);
      toast.error('Failed to save prep status');
    } finally {
      setPreppedSaving(false);
    }
  };

  const handleCopyPhone = () => {
    if (item.phone) {
      navigator.clipboard.writeText(stripCountryCode(item.phone) || item.phone);
      toast.success('Phone copied');
    }
  };

  const handleLogScriptSent = async () => {
    if (!isOnline) { toast.error('Offline'); return; }
    try {
      await supabase.from('script_actions').insert({
        action_type: 'script_sent',
        booking_id: item.bookingId,
        completed_by: userName,
      });
      toast.success('Logged as sent');
    } catch {
      toast.error('Failed to log');
    }
  };

  const guardOnline = (fn: () => void) => () => {
    if (!isOnline) {
      toast.error('You are offline. This action requires network.');
      return;
    }
    fn();
  };

  // ── Clear outcome handler ──
  const handleClearOutcome = async () => {
    if (!isOnline) { toast.error('Offline'); return; }
    setClearingOutcome(true);
    try {
      const firstName = item.memberName.split(' ')[0];

      if (item.latestRunId) {
        const { data: touches } = await supabase
          .from('followup_touches')
          .select('id')
          .eq('booking_id', item.bookingId)
          .limit(1);
        if (touches && touches.length > 0) {
          await supabase.from('followup_touches').insert({
            booking_id: item.bookingId,
            touch_type: 'internal_note',
            created_by: userName,
            notes: `Outcome "${item.latestRunResult}" cleared by ${userName}. Previous follow-up history preserved.`,
          });
        }
        await supabase.from('intros_run').delete().eq('id', item.latestRunId);
      }

      await supabase.from('intros_booked').update({
        booking_status_canon: 'ACTIVE',
        booking_status: 'Active',
        closed_at: null,
        closed_by: null,
        last_edited_at: new Date().toISOString(),
        last_edited_by: userName,
        edit_reason: `Outcome cleared by ${userName}`,
      }).eq('id', item.bookingId);

      await supabase.from('follow_up_queue').delete().eq('booking_id', item.bookingId);

      await supabase.from('outcome_events').insert({
        booking_id: item.bookingId,
        run_id: item.latestRunId,
        old_result: item.latestRunResult,
        new_result: 'Cleared',
        edited_by: userName,
        source_component: 'IntroRowCard:clearOutcome',
        edit_reason: `Outcome cleared by ${userName}`,
      });

      toast.success(`Outcome cleared for ${firstName}`);
      setClearOutcomeOpen(false);
      onRefresh();
    } catch (err) {
      console.error('Clear outcome error:', err);
      toast.error('Failed to clear outcome');
    } finally {
      setClearingOutcome(false);
    }
  };

  // ══ SUMMARY HEADER BAR (used in both collapsed and expanded states) ══
  const summaryHeaderBar = (
    <button
      type="button"
      onClick={() => onExpand?.()}
      className={cn(
        "w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 rounded-lg border bg-card transition-colors hover:bg-muted/50",
        isExpanded && 'rounded-b-none border-b-0',
        isInFocusWindow && 'ring-2 ring-orange-500',
        item.latestRunResult && !isExpanded && 'opacity-70',
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
        <span className="font-semibold text-sm truncate pointer-events-none">{item.memberName}</span>
        <span onClick={(e) => e.stopPropagation()} className="pointer-events-none">
          <Badge variant={item.isSecondIntro ? 'secondary' : 'default'} className="text-[9px] px-1.5 py-0 h-4">
            {item.isSecondIntro ? '2nd Intro' : '1st Intro'}
          </Badge>
        </span>
        <span onClick={(e) => e.stopPropagation()} className="pointer-events-none">
          {getQBadge(localQStatus)}
        </span>
        <ShoutoutLabel consent={shoutoutConsent} />
        <span className="text-xs text-muted-foreground truncate">
          {item.introTime ? formatDisplayTime(item.introTime) : 'TBD'} · {item.coachName || 'TBD'}
        </span>
      </div>
      <ChevronRight className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform", isExpanded && "rotate-90")} />
    </button>
  );

  // If not expanded, show collapsed row only
  if (!isExpanded) {
    return summaryHeaderBar;
  }

  // Build top banner
  const topBanner = (
    <>
      {isInFocusWindow && (
        <div className="flex items-center justify-center py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200">
          <Badge className="text-[10px] px-2 py-0 h-4 bg-amber-500 text-white border-transparent">
            🕐 Class in {focusHours}h {focusMins}m
          </Badge>
        </div>
      )}
      {needsOutcome ? (
        <StatusBanner bgColor="#7c3aed" text="⚠ Outcome Not Logged" />
      ) : isOutcomeOverdue ? (
        <StatusBanner bgColor="#f97316" text="🟠 Outcome needed" />
      ) : isQOverdue ? (
        <StatusBanner bgColor="#dc2626" text={`🔴 Questionnaire Overdue — Class in ${focusHours}h ${focusMins}m`} />
      ) : item.isSecondIntro ? (
        <StatusBanner bgColor="#2563eb" text={item.confirmedAt ? "🔵 2nd Intro — Confirmed ✓" : "🔵 2nd Intro"} />
      ) : item.leadSource?.toLowerCase().includes('vip') ? (
        <StatusBanner
          bgColor="#7e22ce"
          text={`🟣 VIP Class — ${localQStatus === 'Q_COMPLETED' ? 'Questionnaire Complete ✓' : localQStatus === 'Q_SENT' ? 'Questionnaire Sent' : 'Questionnaire Not Sent'}`}
        />
      ) : (
        <StatusBanner
          bgColor={localQStatus === 'Q_COMPLETED' ? '#16a34a' : localQStatus === 'Q_SENT' ? '#d97706' : '#dc2626'}
          text={qBar.bannerLabel}
        />
      )}
    </>
  );

  // Build badges for header
  const badges = (
    <>
      {item.isSecondIntro && (
        <Badge className="text-[10px] px-1.5 py-0 h-4 bg-blue-600 text-white border-transparent">2nd</Badge>
      )}
      {item.isVip && (
        <Badge className="text-[10px] px-1.5 py-0 h-4 bg-purple-600 text-white border-transparent">VIP</Badge>
      )}
    </>
  );

  // Outcome banner at bottom — with clear option
  const outcomeBanner = item.latestRunResult ? (() => {
    const result = item.latestRunResult!;
    const isPurchased = result.includes('Premier') || result.includes('Elite') || result.includes('Basic');
    const isNoShow = result === 'No-show';
    const isBooked2nd = result === 'Booked 2nd intro';
    const isPlanning2nd = result === 'Planning to Book 2nd Intro';
    const bgColor = isPurchased ? '#16a34a' : isNoShow ? '#6b7280' : isBooked2nd ? '#2563eb' : isPlanning2nd ? '#7c3aed' : '#d97706';
    const label = isPurchased ? `✓ Purchased — ${result}` : isNoShow ? '👻 No-show' : isBooked2nd ? '📅 Booked 2nd Intro' : isPlanning2nd ? '🟣 2nd Intro Planned' : `⏳ ${result}`;
    return (
      <div className="relative">
        <StatusBanner bgColor={bgColor} text={label} />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setClearOutcomeOpen(true); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-white/70 hover:text-white text-[10px] py-1 px-1.5 rounded transition-colors min-w-[44px] min-h-[44px] justify-center"
          title="Clear outcome"
        >
          <X className="w-3 h-3" />
          <span className="hidden sm:inline">Clear</span>
        </button>
      </div>
    );
  })() : null;

  // ROW 1 — Primary action buttons
  const actionButtons = (
    <>
      <Button
        size="sm"
        className={cn(
          'h-9 flex-1 text-xs gap-1',
          isInFocusWindow && !prepped && 'animate-pulse bg-orange-500 text-white hover:bg-orange-600',
        )}
        style={isInFocusWindow && !prepped ? { animationDuration: '2s' } : undefined}
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
        className="h-9 flex-1 text-xs gap-1"
        onClick={guardOnline(() => {
          window.dispatchEvent(new CustomEvent('myday:open-script', {
            detail: { bookingId: item.bookingId, isSecondIntro: item.isSecondIntro },
          }));
        })}
      >
        <Send className="w-3.5 h-3.5" />
        Script
      </Button>
      <Button
        size="sm"
        variant={outcomeOpen ? 'default' : 'outline'}
        className="h-9 flex-1 text-xs gap-1"
        onClick={() => setOutcomeOpen(v => !v)}
      >
        <ClipboardList className="w-3.5 h-3.5" />
        Outcome
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-9 text-xs gap-1"
        onClick={() => setEditOpen(true)}
      >
        <Pencil className="w-3.5 h-3.5" />
        Edit
      </Button>
    </>
  );

  // ROW 2 — Secondary actions
  const secondaryActions = (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => handleTogglePrepped(!prepped)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTogglePrepped(!prepped); } }}
        aria-disabled={preppedSaving}
        className={cn(
          'flex-1 flex items-center justify-center gap-1 h-9 text-[10px] border-r border-border/30 transition-colors cursor-pointer select-none',
          prepped
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
            : 'bg-muted/20 text-muted-foreground hover:bg-muted/40',
          preppedSaving && 'opacity-50 pointer-events-none',
        )}
      >
        <Checkbox
          checked={prepped}
          onCheckedChange={(val) => handleTogglePrepped(!!val)}
          disabled={preppedSaving}
          className="h-3 w-3 pointer-events-none"
        />
        <span className="leading-none">{prepped ? 'Prepped ✓' : 'Prep & RP'}</span>
      </div>

      <button
        type="button"
        className="flex-1 flex items-center justify-center gap-1 h-9 text-[10px] text-muted-foreground hover:bg-muted/40 border-r border-border/30 rounded transition-colors"
        onClick={item.isSecondIntro ? handleLogScriptSent : handleLogAsSent}
        disabled={logSentLoading}
      >
        <CheckCircle className="w-3 h-3" />
        <span>{logSentLoading ? '…' : 'Log Sent'}</span>
      </button>

      <button
        type="button"
        className="flex-1 flex items-center justify-center gap-1 h-9 text-[10px] text-muted-foreground hover:bg-muted/40 transition-colors"
        onClick={handleCopyPhone}
        disabled={!item.phone}
      >
        <Phone className="w-3 h-3" />
        <span>Phone</span>
      </button>
    </>
  );

  return (
    <div className={cn("rounded-lg border bg-card overflow-hidden", isInFocusWindow && 'ring-2 ring-orange-500')}>
      {/* Collapsible header — always visible at top of expanded card */}
      {summaryHeaderBar}

      <IntroCard
        id={`intro-card-${item.bookingId}`}
        memberName={item.memberName}
        classDate={item.classDate}
        introTime={item.introTime}
        coachName={item.coachName}
        leadSource={item.leadSource}
        phone={item.phone}
        referredBy={item.referredBy}
        bookingId={item.bookingId}
        editable={true}
        editedBy={userName}
        onFieldSaved={onRefresh}
        badges={badges}
        outcomeBadge={undefined}
        actionButtons={actionButtons}
        secondaryActions={secondaryActions}
        topBanner={topBanner}
        outcomeBanner={outcomeBanner}
        className={cn(
          'border-0 rounded-none mb-0',
          !isFocused && anyFocused && 'opacity-80',
        )}
      >
        {/* THEIR STORY — 3-zone layout */}
        <TheirStory
          bookingId={item.bookingId}
          memberName={item.memberName}
          classDate={item.classDate}
          onFieldSaved={onRefresh}
          briefSlot={
            <SABriefFields
              bookingId={item.bookingId}
              editedBy={userName}
              onSaved={onRefresh}
            />
          }
        />
      </IntroCard>


      {/* Outcome drawer – expands below the card */}
      {outcomeOpen && (
        <OutcomeDrawer
          bookingId={item.bookingId}
          memberName={item.memberName}
          classDate={item.classDate}
          introTime={item.introTime}
          leadSource={item.leadSource || ''}
          existingRunId={item.latestRunId}
          currentResult={item.latestRunResult}
          editedBy={userName}
          initialPrepped={prepped}
          initialCoach={item.latestRunCoach || item.coachName || ''}
          initialObjection={item.latestRunObjection || ''}
          initialNotes={item.latestRunNotes || ''}
          onSaved={() => { setOutcomeOpen(false); onRefresh(); }}
          onCancel={() => setOutcomeOpen(false)}
        />
      )}

      {/* Clear outcome confirmation */}
      <AlertDialog open={clearOutcomeOpen} onOpenChange={setClearOutcomeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear outcome for {item.memberName.split(' ')[0]}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the logged outcome and return the card to its original state.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearingOutcome}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearOutcome} disabled={clearingOutcome}>
              {clearingOutcome ? 'Clearing…' : 'Clear'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
