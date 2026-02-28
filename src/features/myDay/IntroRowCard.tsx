/**
 * Single intro row card using shared IntroCard for visual layout.
 * MyDay-specific logic: prep checkbox, Q status, focus mode, outcome drawer.
 */
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Copy, Eye, ClipboardList, Send, CheckCircle, Phone, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { UpcomingIntroItem } from './myDayTypes';
import { OutcomeDrawer } from '@/components/myday/OutcomeDrawer';
import { StatusBanner } from '@/components/shared/StatusBanner';
import IntroCard from '@/components/shared/IntroCard';
import { supabase } from '@/integrations/supabase/client';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatDateShort, formatTime12h } from '@/lib/datetime/formatTime';
import { COACHES } from '@/types';
import { formatPhoneDisplay, stripCountryCode } from '@/lib/parsing/phone';

/** Inline coach picker — always tappable */
function InlineCoachPicker({ bookingId, currentCoach, userName, onSaved }: { bookingId: string; currentCoach: string | null; userName: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const isTbd = !currentCoach || currentCoach === 'TBD';

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={cn(
          'cursor-pointer hover:underline',
          isTbd ? 'text-destructive font-semibold' : 'text-foreground hover:bg-muted/50 rounded px-0.5 -mx-0.5',
        )}
      >
        {isTbd ? '🏋️ Coach TBD' : currentCoach}
      </button>
    );
  }

  return (
    <select
      className="h-5 text-xs border rounded px-1 bg-background text-foreground"
      defaultValue=""
      autoFocus
      disabled={saving}
      onChange={async (e) => {
        const val = e.target.value;
        if (!val) return;
        setSaving(true);
        try {
          await supabase.from('intros_booked').update({
            coach_name: val,
            last_edited_at: new Date().toISOString(),
            last_edited_by: userName,
          }).eq('id', bookingId);
          toast.success(`Coach set to ${val}`);
          onSaved();
        } catch {
          toast.error('Failed to update coach');
        } finally {
          setSaving(false);
          setEditing(false);
        }
      }}
      onBlur={() => setEditing(false)}
    >
      <option value="">Select coach…</option>
      {COACHES.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  );
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
}: IntroRowCardProps) {
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [prepped, setPrepped] = useState(item.prepped);
  const [preppedSaving, setPreppedSaving] = useState(false);
  const [logSentLoading, setLogSentLoading] = useState(false);
  const [localQStatus, setLocalQStatus] = useState(item.questionnaireStatus);
  const [prevIntroOpen, setPrevIntroOpen] = useState(false);
  const [prevIntro, setPrevIntro] = useState<any>(null);
  const [prevIntroLoading, setPrevIntroLoading] = useState(false);
  const qBar = getQBar(localQStatus);

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

  // Fetch previous intro data for 2nd visits
  useEffect(() => {
    if (!item.isSecondIntro || !item.originatingBookingId) return;
    setPrevIntroLoading(true);
    (async () => {
      const [{ data: booking }, { data: run }] = await Promise.all([
        supabase.from('intros_booked').select('class_date, intro_time, coach_name, lead_source, fitness_goal').eq('id', item.originatingBookingId!).maybeSingle(),
        supabase.from('intros_run').select('result, primary_objection, notes, coach_name, run_date').eq('linked_intro_booked_id', item.originatingBookingId!).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      const { data: q } = await supabase.from('intro_questionnaires').select('q1_fitness_goal, q3_obstacle, q5_emotional_driver').eq('booking_id', item.originatingBookingId!).limit(1).maybeSingle();
      setPrevIntro({ booking, run, questionnaire: q });
      setPrevIntroLoading(false);
    })();
  }, [item.isSecondIntro, item.originatingBookingId]);

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
        item.confirmedAt
          ? <StatusBanner bgColor="#16a34a" text="✓ 2nd Intro Confirmed" />
          : <StatusBanner bgColor="#2563eb" text="📱 Send 2nd Intro Confirmation Text" />
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

  // Outcome badge
  const outcomeBadge = item.latestRunResult ? (
    <button type="button" onClick={() => setOutcomeOpen(true)} className="cursor-pointer hover:opacity-90 transition-opacity">
      <Badge
        variant="outline"
        className={cn(
          'text-[10px] px-1.5 py-0 h-4',
          item.latestRunResult.includes('Premier') || item.latestRunResult.includes('Elite') || item.latestRunResult.includes('Basic')
            ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
            : item.latestRunResult === 'Booked 2nd intro'
            ? 'bg-blue-500/15 text-blue-700 border-blue-500/30'
            : item.latestRunResult === 'No-show'
            ? 'bg-muted text-muted-foreground border-border'
            : 'bg-amber-500/15 text-amber-700 border-amber-500/30',
        )}
      >
        {item.latestRunResult.includes('Premier') || item.latestRunResult.includes('Elite') || item.latestRunResult.includes('Basic')
          ? `✓ ${item.latestRunResult}`
          : item.latestRunResult === 'Booked 2nd intro'
          ? '📅 2nd Intro Booked'
          : item.latestRunResult === 'No-show'
          ? '👻 No-show'
          : `⏳ ${item.latestRunResult}`}
      </Badge>
    </button>
  ) : null;

  // Outcome banner at bottom
  const outcomeBanner = item.latestRunResult ? (() => {
    const result = item.latestRunResult!;
    const isPurchased = result.includes('Premier') || result.includes('Elite') || result.includes('Basic');
    const isNoShow = result === 'No-show';
    const isBooked2nd = result === 'Booked 2nd intro';
    const bgColor = isPurchased ? '#16a34a' : isNoShow ? '#6b7280' : isBooked2nd ? '#2563eb' : '#d97706';
    const label = isPurchased ? `✓ Purchased — ${result}` : isNoShow ? '👻 No-show' : isBooked2nd ? '📅 Booked 2nd Intro' : `⏳ ${result}`;
    return <StatusBanner bgColor={bgColor} text={label} />;
  })() : null;

  // ROW 1 — Primary action buttons (each is a grid child, 1/3 width)
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
    </>
  );

  // ROW 2 — Secondary actions (each is a grid child, 1/4 width)
  const secondaryActions = (
    <>
      {/* Prepped & Role Played checkbox */}
      <button
        type="button"
        onClick={() => handleTogglePrepped(!prepped)}
        disabled={preppedSaving}
        className={cn(
          'flex-1 flex items-center justify-center gap-1 h-9 text-[10px] border-r border-border/30 transition-colors',
          prepped
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
            : 'bg-muted/20 text-muted-foreground hover:bg-muted/40',
        )}
      >
        <Checkbox
          checked={prepped}
          onCheckedChange={(val) => handleTogglePrepped(!!val)}
          disabled={preppedSaving}
          className="h-3 w-3 pointer-events-none"
        />
        <span className="leading-none">{prepped ? 'Prepped ✓' : 'Prep & RP'}</span>
      </button>

      {/* Copy Q Link */}
      {!item.isSecondIntro ? (
        <button
          type="button"
          className="flex-1 flex items-center justify-center gap-1 h-9 text-[10px] text-muted-foreground hover:bg-muted/40 border-r border-border/30 transition-colors"
          onClick={async () => {
            try {
              const { data: qRecord } = await supabase
                .from('intro_questionnaires')
                .select('slug, id')
                .eq('booking_id', item.bookingId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              if (qRecord?.slug) {
                const link = `https://otf-tuscaloosa.lovable.app/q/${(qRecord as any).slug}`;
                await navigator.clipboard.writeText(link);
                toast.success(`Q link copied for ${item.memberName}`);
              } else {
                const nameParts = item.memberName.trim().split(/\s+/);
                const firstName = nameParts[0] || item.memberName;
                const lastName = nameParts.slice(1).join(' ') || '';
                const d = new Date(item.classDate + 'T12:00:00');
                const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
                const slug = `${firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${lastName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${monthNames[d.getMonth()]}${String(d.getDate()).padStart(2, '0')}`;
                const { data: created } = await supabase.from('intro_questionnaires').insert({
                  booking_id: item.bookingId,
                  client_first_name: firstName,
                  client_last_name: lastName,
                  scheduled_class_date: item.classDate,
                  slug,
                  status: 'not_sent',
                } as any).select('slug').single();
                if (created?.slug) {
                  const link = `https://otf-tuscaloosa.lovable.app/q/${(created as any).slug}`;
                  await navigator.clipboard.writeText(link);
                  toast.success(`Q link generated & copied for ${item.memberName}`);
                } else {
                  toast.error('Failed to generate Q link');
                }
              }
            } catch {
              toast.error('Failed to copy Q link');
            }
          }}
        >
          <Copy className="w-3 h-3" />
          <span>Copy Q</span>
        </button>
      ) : (
        <div className="flex-1 flex items-center justify-center h-9 text-[10px] text-muted-foreground/50 border-r border-border/30">—</div>
      )}

      {/* Log as Sent */}
      <button
        type="button"
        className="flex-1 flex items-center justify-center gap-1 h-9 text-[10px] text-muted-foreground hover:bg-muted/40 border-r border-border/30 transition-colors"
        onClick={item.isSecondIntro ? handleLogScriptSent : handleLogAsSent}
        disabled={logSentLoading}
      >
        <CheckCircle className="w-3 h-3" />
        <span>{logSentLoading ? '…' : 'Log Sent'}</span>
      </button>

      {/* Copy Phone */}
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
    <>
      <IntroCard
        id={`intro-card-${item.bookingId}`}
        memberName={item.memberName}
        classDate={item.classDate}
        introTime={item.introTime}
        coachName={item.coachName}
        leadSource={item.leadSource}
        phone={item.phone}
        badges={badges}
        outcomeBadge={outcomeBadge}
        actionButtons={actionButtons}
        secondaryActions={secondaryActions}
        topBanner={topBanner}
        outcomeBanner={outcomeBanner}
        className={cn(
          isInFocusWindow && 'ring-2 ring-orange-500 animate-pulse',
          !isFocused && anyFocused && 'opacity-80',
        )}
        style={isInFocusWindow ? { animationDuration: '3s' } : undefined}
      >
        {/* 2nd Visit: Previous Intro Info */}
        {item.isSecondIntro && prevIntro && (
          <Collapsible open={prevIntroOpen} onOpenChange={setPrevIntroOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-full text-[11px] gap-1 justify-between">
                <span>Previous Intro Info</span>
                {prevIntroOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="rounded-md border bg-muted/20 p-2 space-y-1 text-xs text-muted-foreground">
                {prevIntro.booking && (
                  <>
                    <p><span className="font-medium text-foreground">Date:</span> {formatDateShort(prevIntro.booking.class_date)}</p>
                    {prevIntro.booking.intro_time && <p><span className="font-medium text-foreground">Time:</span> {formatTime12h(prevIntro.booking.intro_time)}</p>}
                    <p><span className="font-medium text-foreground">Coach:</span> {prevIntro.booking.coach_name}</p>
                    <p><span className="font-medium text-foreground">Source:</span> {prevIntro.booking.lead_source}</p>
                  </>
                )}
                {prevIntro.run && (
                  <>
                    <p><span className="font-medium text-foreground">Result:</span> {prevIntro.run.result}</p>
                    {prevIntro.run.primary_objection && <p><span className="font-medium text-foreground">Objection:</span> {prevIntro.run.primary_objection}</p>}
                    {prevIntro.run.notes && <p><span className="font-medium text-foreground">Notes:</span> {prevIntro.run.notes}</p>}
                  </>
                )}
                {prevIntro.questionnaire && (
                  <>
                    {prevIntro.questionnaire.q1_fitness_goal && <p><span className="font-medium text-foreground">Goal:</span> {prevIntro.questionnaire.q1_fitness_goal}</p>}
                    {prevIntro.questionnaire.q3_obstacle && <p><span className="font-medium text-foreground">Obstacle:</span> {prevIntro.questionnaire.q3_obstacle}</p>}
                    {prevIntro.questionnaire.q5_emotional_driver && <p><span className="font-medium text-foreground">Why:</span> {prevIntro.questionnaire.q5_emotional_driver}</p>}
                  </>
                )}
                {!prevIntro.booking && !prevIntro.run && <p>No previous data found</p>}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
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
    </>
  );
}
