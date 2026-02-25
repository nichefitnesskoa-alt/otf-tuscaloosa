/**
 * Single intro row card with Prep | Script | Coach | Outcome buttons.
 * Outcome expands an inline drawer that routes through canonical applyIntroOutcomeUpdate.
 * Q status is displayed as a bold full-width top banner.
 */
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Copy, User, Eye, Dumbbell, ClipboardList, Send, CheckCircle, Phone, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDisplayTime } from '@/lib/time/timeUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { UpcomingIntroItem } from './myDayTypes';
import { OutcomeDrawer } from '@/components/myday/OutcomeDrawer';
import { StatusBanner } from '@/components/shared/StatusBanner';
import { supabase } from '@/integrations/supabase/client';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatDateShort, formatTime12h } from '@/lib/datetime/formatTime';

interface IntroRowCardProps {
  item: UpcomingIntroItem;
  isOnline: boolean;
  userName: string;
  onSendQ: (bookingId: string) => void;
  onConfirm: (bookingId: string) => void;
  onRefresh: () => void;
  /** When true, show the purple Needs Outcome banner instead of Q status */
  needsOutcome?: boolean;
  /** Confirmation result from Win the Day reflection */
  confirmationResult?: string | null;
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
  confirmationResult,
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

        {/* Row 2: Contact + lead source + outcome result */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.phone && (
            <span className="text-[10px] px-1.5 py-0 h-4 rounded border text-muted-foreground font-normal inline-flex items-center">
              {item.phone}
            </span>
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
          {confirmationResult === 'unreachable' && !item.confirmedAt && (
            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 border-amber-200 border">
              ⚠ Unconfirmed
            </Badge>
          )}
          {item.latestRunResult && (
            <button type="button" onClick={() => setOutcomeOpen(true)} className="cursor-pointer">
              <Badge className={cn(
                'text-[10px] px-1.5 py-0 h-4 border font-semibold',
                item.latestRunResult.includes('Premier') || item.latestRunResult.includes('Elite') || item.latestRunResult.includes('Basic')
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-700'
                  : item.latestRunResult === "Didn't Buy"
                  ? 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/30 dark:text-red-400 dark:border-red-700'
                  : item.latestRunResult === 'No-show'
                  ? 'bg-gray-200 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600'
                  : item.latestRunResult === 'Booked 2nd intro'
                  ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-700'
                  : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700'
              )}>
                {item.latestRunResult}
              </Badge>
            </button>
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
          {!item.isSecondIntro && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1"
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
              Copy Q Link
            </Button>
          )}
          {/* Copy Phone button */}
          {item.phone && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1"
              onClick={handleCopyPhone}
            >
              <Phone className="w-3 h-3" />
              Copy Phone
            </Button>
          )}
          {!item.isSecondIntro && localQStatus === 'Q_SENT' && (
            <Badge className="text-[10px] px-1.5 py-0 h-5 bg-amber-100 text-amber-700 border-amber-300 border">
              ⏳ Waiting for response
            </Badge>
          )}
        </div>

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
      </div>

      {/* Outcome result bottom banner */}
      {item.latestRunResult && (
        <button type="button" onClick={() => setOutcomeOpen(true)} className="w-full cursor-pointer hover:opacity-90 transition-opacity">
          <StatusBanner
            bgColor={
              item.latestRunResult.includes('Premier') || item.latestRunResult.includes('Elite') || item.latestRunResult.includes('Basic')
                ? '#16a34a'
                : item.latestRunResult === 'Booked 2nd intro'
                ? '#2563eb'
                : item.latestRunResult === "Didn't Buy"
                ? '#dc2626'
                : item.latestRunResult === 'No-show'
                ? '#64748b'
                : '#d97706'
            }
            text={
              item.latestRunResult.includes('Premier') || item.latestRunResult.includes('Elite') || item.latestRunResult.includes('Basic')
                ? `✓ Purchased — ${item.latestRunResult}`
                : item.latestRunResult === 'Booked 2nd intro'
                ? '📅 Booked 2nd Intro'
                : item.latestRunResult === "Didn't Buy"
                ? "✗ Didn't Buy"
                : item.latestRunResult === 'No-show'
                ? '👻 No-show'
                : `⏳ ${item.latestRunResult}`
            }
          />
        </button>
      )}

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
