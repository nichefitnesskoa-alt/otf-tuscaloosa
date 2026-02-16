import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface CardGuidanceProps {
  text: string;
  className?: string;
}

export function CardGuidance({ text, className }: CardGuidanceProps) {
  if (!text) return null;
  return (
    <p className={cn(
      'text-[13px] font-medium text-foreground/80 leading-snug bg-amber-50 dark:bg-amber-950/30 rounded-md px-2.5 py-1.5 border border-amber-200 dark:border-amber-800/50',
      className
    )}>
      👉 {text}
    </p>
  );
}

// ─── CardGuidanceWithAction: guidance + "Mark Done" button ─────────

interface CardGuidanceWithActionProps {
  text: string;
  actionType: string;
  bookingId: string;
  completedBy: string;
  /** Already completed info (if step was done) */
  completedInfo?: { by: string; at: string } | null;
  onCompleted?: () => void;
  className?: string;
}

export function CardGuidanceWithAction({
  text, actionType, bookingId, completedBy, completedInfo, onCompleted, className,
}: CardGuidanceWithActionProps) {
  const [saving, setSaving] = useState(false);

  if (!text) return null;

  if (completedInfo) {
    return (
      <div className={cn(
        'text-[13px] font-medium leading-snug rounded-md px-2.5 py-1.5 border flex items-center gap-2',
        'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300',
        className
      )}>
        <Check className="w-4 h-4 shrink-0" />
        <span className="flex-1 line-through opacity-70">{text}</span>
        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 shrink-0">
          {completedInfo.by} · {format(new Date(completedInfo.at), 'h:mm a')}
        </span>
      </div>
    );
  }

  const handleMarkDone = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    try {
      await supabase.from('script_actions').insert({
        booking_id: bookingId,
        action_type: actionType,
        completed_by: completedBy,
      });
      onCompleted?.();
    } catch {
      // silent fail
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn(
      'text-[13px] font-medium text-foreground/80 leading-snug bg-amber-50 dark:bg-amber-950/30 rounded-md px-2.5 py-1.5 border border-amber-200 dark:border-amber-800/50 flex items-center gap-2',
      className
    )}>
      <span className="flex-1">👉 {text}</span>
      <button
        onClick={handleMarkDone}
        disabled={saving}
        className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-800 hover:bg-amber-300 dark:hover:bg-amber-700 text-amber-900 dark:text-amber-100 transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
        Done
      </button>
    </div>
  );
}

// ─── Journey stage detection ───────────────────────────────────────

export interface JourneyContext {
  // Lead-only fields
  isLead?: boolean;
  leadStage?: string;
  minutesAgo?: number;
  leadSource?: string;

  // Booking fields
  isBooked?: boolean;
  classDate?: string;
  classTime?: string | null;
  introResult?: string | null;
  primaryObjection?: string | null;
  isSecondIntro?: boolean;
  
  // Status checks
  confirmationSent?: boolean;
  qSent?: boolean;
  qCompleted?: boolean;
  welcomeSent?: boolean;
  referralAskSent?: boolean;
  followUpSent?: boolean;
  
  // Follow-up fields
  isFollowUp?: boolean;
  touchNumber?: number;
  personType?: string;
  isLegacy?: boolean;
  inCoolingPeriod?: boolean;
  coolingDaysAgo?: number;
  nextAvailableDate?: string;
  nextTouchDate?: string;
}

/** Returns { text, actionType } for the current step */
export function getJourneyGuidanceWithAction(ctx: JourneyContext): { text: string; actionType: string | null } {
  // ── Follow-up cards ──
  if (ctx.isFollowUp) {
    return {
      text: getFollowUpGuidance({
        touchNumber: ctx.touchNumber || 1,
        personType: ctx.personType || 'didnt_buy',
        isLegacy: ctx.isLegacy || false,
        leadSource: ctx.leadSource,
        inCoolingPeriod: ctx.inCoolingPeriod,
        coolingDaysAgo: ctx.coolingDaysAgo,
        nextAvailableDate: ctx.nextAvailableDate,
      }),
      actionType: null,
    };
  }

  // ── Lead cards (no booking) ──
  if (ctx.isLead && !ctx.isBooked) {
    if (ctx.leadStage === 'new' || !ctx.leadStage) {
      return { text: `Step 1: Contact them now → tap Script for ${ctx.leadSource || 'lead'} opener`, actionType: 'first_contact' };
    }
    if (ctx.leadStage === 'contacted') {
      return { text: 'Step 2: Book their intro → tap Book', actionType: null };
    }
    return { text: '', actionType: null };
  }

  // ── Booked intro cards ──
  if (ctx.isBooked) {
    // Post-log stages
    if (ctx.introResult) {
      return getPostLogGuidanceWithAction(ctx);
    }

    // Pre-log stages
    const isClassToday = ctx.classDate === new Date().toISOString().split('T')[0];
    let classTimePassed = false;
    if (ctx.classTime && isClassToday) {
      const parts = ctx.classTime.split(':').map(Number);
      const ct = new Date();
      ct.setHours(parts[0], parts[1], 0, 0);
      classTimePassed = new Date() > ct;
    }

    if (classTimePassed) {
      return { text: 'Step 7: Log what happened → tap Log Intro', actionType: null };
    }

    if (ctx.isSecondIntro) {
      return ctx.confirmationSent
        ? { text: 'Ready for 2nd intro. No questionnaire needed.', actionType: null }
        : { text: 'Send confirmation for their 2nd visit → tap Script', actionType: 'confirmation_sent' };
    }

    // Sequential pre-class steps (Ask a Friend removed, renumbered)
    if (!ctx.confirmationSent) {
      return { text: 'Step 3: Send confirmation with questionnaire link → tap Script', actionType: 'confirmation_sent' };
    }
    if (ctx.confirmationSent && !ctx.qCompleted) {
      if (ctx.qSent) {
        return { text: 'Step 4: Waiting for questionnaire. Follow up if needed.', actionType: 'q_reminder_sent' };
      }
      return { text: 'Step 3: Questionnaire is included in confirmation text → tap Script to send confirmation', actionType: 'confirmation_sent' };
    }
    if (ctx.qCompleted && isClassToday) {
      return { text: 'Step 6: Intro today! Review answers before they arrive → tap Prep', actionType: 'prep_reviewed' };
    }
    if (ctx.qCompleted) {
      return { text: 'Step 5: Ready for intro. Review their answers → tap Prep', actionType: 'prep_reviewed' };
    }
    if (!ctx.qCompleted && ctx.confirmationSent) {
      return { text: 'Step 4: Questionnaire not completed yet. Send a reminder → tap Script', actionType: 'q_reminder_sent' };
    }

    return { text: 'Review their info before they arrive → tap Prep', actionType: 'prep_reviewed' };
  }

  return { text: '', actionType: null };
}

function getPostLogGuidanceWithAction(ctx: JourneyContext): { text: string; actionType: string | null } {
  const result = (ctx.introResult || '').toLowerCase();
  const isPurchased = ['premier', 'elite', 'basic'].some(m => result.includes(m));
  const isNoShow = result === 'no-show';

  if (isPurchased) {
    if (!ctx.welcomeSent) {
      return { text: 'Step 8: Send welcome text, then ask for a referral → tap Script', actionType: 'welcome_sent' };
    }
    if (!ctx.referralAskSent) {
      return { text: 'Step 9: Ask for a referral → tap Script', actionType: 'referral_ask_sent' };
    }
    return { text: `All steps complete for ${ctx.isBooked ? 'this member' : 'this person'}! ✓`, actionType: null };
  }

  if (isNoShow) {
    if (!ctx.followUpSent) {
      return { text: 'Step 8: Send rebook text → tap Script', actionType: 'follow_up_sent' };
    }
    return {
      text: ctx.nextTouchDate
        ? `Rebook text sent. Touch 2 scheduled for ${ctx.nextTouchDate}.`
        : 'Rebook text sent. Follow-up queued.',
      actionType: null,
    };
  }

  // Didn't Buy
  const objection = ctx.primaryObjection ? ` about their ${ctx.primaryObjection} concern` : '';
  if (!ctx.followUpSent) {
    return { text: `Step 8: Send follow-up text${objection} → tap Script`, actionType: 'follow_up_sent' };
  }
  return {
    text: ctx.nextTouchDate
      ? `Follow-up sent. Touch 2 scheduled for ${ctx.nextTouchDate}.`
      : 'Follow-up sent. Next touch queued.',
    actionType: null,
  };
}

// Keep backward-compat wrapper
export function getJourneyGuidance(ctx: JourneyContext): string {
  return getJourneyGuidanceWithAction(ctx).text;
}

// ─── Existing guidance generators (preserved for backward compat) ───

export function getIntroGuidance(opts: {
  classTimePassed: boolean;
  introResult: string | null;
  qCompleted: boolean;
  confirmationSent: boolean;
  isSecondIntro: boolean;
}): string {
  if (opts.introResult) return '';
  if (opts.classTimePassed) return 'Class is over. Log what happened → tap Log Intro';
  if (opts.isSecondIntro) {
    return opts.confirmationSent
      ? 'Ready for 2nd intro. No questionnaire needed.'
      : 'Send confirmation for their 2nd visit → tap Script';
  }
  if (!opts.qCompleted && !opts.confirmationSent) return 'Send confirmation with questionnaire link → tap Script';
  if (opts.qCompleted && opts.confirmationSent) return 'Ready for intro. Review their answers → tap Prep';
  if (!opts.qCompleted) return 'Questionnaire not completed yet. Send a reminder → tap Script';
  if (!opts.confirmationSent) return 'Send a confirmation text → tap Script';
  return 'Review their info before they arrive → tap Prep';
}

export function getFollowUpGuidance(opts: {
  touchNumber: number;
  personType: string;
  isLegacy: boolean;
  leadSource?: string | null;
  inCoolingPeriod?: boolean;
  coolingDaysAgo?: number;
  nextAvailableDate?: string;
}): string {
  const channelHint = getChannelHint(opts.leadSource);
  if (opts.inCoolingPeriod) {
    return `Contacted ${opts.coolingDaysAgo}d ago. Next follow-up available ${opts.nextAvailableDate}. No action needed right now.`;
  }
  if (opts.isLegacy) {
    return `We don't have contact records for this person. Log when you last reached out → tap Log Past Contact. Or start fresh → tap Send.${channelHint}`;
  }
  if (opts.personType === 'no_show') {
    if (opts.touchNumber === 1) return `Follow-up Touch 1 of 3. They missed their class. Send a quick rebook text → tap Send.${channelHint}`;
    if (opts.touchNumber === 2) return `Follow-up Touch 2 of 3. It's been a few days. Value-add check-in → tap Send.${channelHint}`;
    return `Follow-up Touch 3 of 3. Last follow-up. Keep it light, no pressure → tap Send.${channelHint}`;
  }
  // didnt_buy
  if (opts.touchNumber === 1) return `Follow-up Touch 1 of 3. Post-class follow-up. Address their objection → tap Send.${channelHint}`;
  if (opts.touchNumber === 2) return `Follow-up Touch 2 of 3. It's been a week. Check in about their goal → tap Send.${channelHint}`;
  return `Follow-up Touch 3 of 3. Last follow-up. Invite them for a 2nd class → tap Send.${channelHint}`;
}

function getChannelHint(leadSource?: string | null): string {
  if (!leadSource) return '';
  const src = leadSource.toLowerCase();
  if (src.includes('instagram') || src.includes('ig') || src.includes('social')) {
    return ' Use Instagram DM to stay in the same channel.';
  }
  if (src.includes('facebook') || src.includes('fb')) {
    return ' Use Facebook Messenger to stay in the same channel.';
  }
  if (src.includes('email')) {
    return ' Use email to stay in the same channel.';
  }
  if (src.includes('referral') || src.includes('friend')) {
    return ' Referral lead — personal tone works best.';
  }
  return '';
}

export function getLeadGuidance(minutesAgo: number): string {
  if (minutesAgo < 5) return 'Step 1: Brand new lead! Contact them ASAP → tap Script';
  if (minutesAgo < 30) return `Step 1: Lead came in ${minutesAgo}m ago. Reach out soon → tap Script`;
  return `Step 1: This lead has been waiting ${minutesAgo > 60 ? Math.round(minutesAgo / 60) + 'h' : minutesAgo + 'm'}. Reach out now → tap Script`;
}

export function getTomorrowGuidance(confirmationSent: boolean): string {
  if (confirmationSent) return 'Confirmed ✓ No action needed until tomorrow.';
  return 'Send a confirmation text for tomorrow → tap Script';
}
