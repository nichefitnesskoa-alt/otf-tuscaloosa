import { cn } from '@/lib/utils';

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
  askAFriendSent?: boolean;
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

export function getJourneyGuidance(ctx: JourneyContext): string {
  // ── Follow-up cards ──
  if (ctx.isFollowUp) {
    return getFollowUpGuidance({
      touchNumber: ctx.touchNumber || 1,
      personType: ctx.personType || 'didnt_buy',
      isLegacy: ctx.isLegacy || false,
      leadSource: ctx.leadSource,
      inCoolingPeriod: ctx.inCoolingPeriod,
      coolingDaysAgo: ctx.coolingDaysAgo,
      nextAvailableDate: ctx.nextAvailableDate,
    });
  }

  // ── Lead cards (no booking) ──
  if (ctx.isLead && !ctx.isBooked) {
    if (ctx.leadStage === 'new' || !ctx.leadStage) {
      return `Step 1: Contact them now → tap Script for ${ctx.leadSource || 'lead'} opener`;
    }
    if (ctx.leadStage === 'contacted') {
      return 'Step 2: Book their intro → tap Book';
    }
    return '';
  }

  // ── Booked intro cards ──
  if (ctx.isBooked) {
    // Post-log stages
    if (ctx.introResult) {
      return getPostLogGuidance(ctx);
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
      return 'Step 8: Log what happened → tap Log Intro';
    }

    if (ctx.isSecondIntro) {
      return ctx.confirmationSent
        ? 'Ready for 2nd intro. No questionnaire needed.'
        : 'Send confirmation for their 2nd visit → tap Script';
    }

    // Sequential pre-class steps
    if (!ctx.askAFriendSent && !ctx.confirmationSent) {
      return "Step 3: Send 'Ask a Friend' script → tap Script";
    }
    if (ctx.askAFriendSent && !ctx.confirmationSent) {
      return 'Step 4: Send confirmation with questionnaire link → tap Script';
    }
    if (ctx.confirmationSent && !ctx.qCompleted) {
      if (ctx.qSent) {
        return 'Step 5: Waiting for questionnaire. Follow up if needed.';
      }
      return 'Step 4: Questionnaire is included in confirmation text → tap Script to send confirmation';
    }
    if (ctx.qCompleted && isClassToday) {
      return 'Step 7: Intro today! Review answers before they arrive → tap Prep';
    }
    if (ctx.qCompleted) {
      return 'Step 6: Ready for intro. Review their answers → tap Prep';
    }
    if (!ctx.qCompleted && ctx.confirmationSent) {
      return 'Step 5: Questionnaire not completed yet. Send a reminder → tap Script';
    }

    return 'Review their info before they arrive → tap Prep';
  }

  return '';
}

function getPostLogGuidance(ctx: JourneyContext): string {
  const result = (ctx.introResult || '').toLowerCase();
  const isPurchased = ['premier', 'elite', 'basic'].some(m => result.includes(m));
  const isNoShow = result === 'no-show';

  if (isPurchased) {
    if (!ctx.welcomeSent) {
      return 'Step 9: Send welcome text, then ask for a referral → tap Script';
    }
    if (!ctx.referralAskSent) {
      return 'Step 10: Ask for a referral → tap Script';
    }
    return `All steps complete for ${ctx.isBooked ? 'this member' : 'this person'}! ✓`;
  }

  if (isNoShow) {
    if (!ctx.followUpSent) {
      return 'Step 9: Send rebook text → tap Script';
    }
    return ctx.nextTouchDate
      ? `Rebook text sent. Touch 2 scheduled for ${ctx.nextTouchDate}.`
      : 'Rebook text sent. Follow-up queued.';
  }

  // Didn't Buy
  const objection = ctx.primaryObjection ? ` about their ${ctx.primaryObjection} concern` : '';
  if (!ctx.followUpSent) {
    return `Step 9: Send follow-up text${objection} → tap Script`;
  }
  return ctx.nextTouchDate
    ? `Follow-up sent. Touch 2 scheduled for ${ctx.nextTouchDate}.`
    : 'Follow-up sent. Next touch queued.';
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
