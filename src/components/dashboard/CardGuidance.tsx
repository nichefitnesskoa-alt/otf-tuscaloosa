import { cn } from '@/lib/utils';

interface CardGuidanceProps {
  text: string;
  className?: string;
}

export function CardGuidance({ text, className }: CardGuidanceProps) {
  if (!text) return null;
  return (
    <p className={cn(
      'text-xs font-medium text-foreground/70 leading-snug bg-muted/50 rounded-md px-2.5 py-1.5 border border-border/50',
      className
    )}>
      💡 {text}
    </p>
  );
}

// Context-aware guidance generators

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
    if (opts.touchNumber === 1) return `They missed their class. Send a quick rebook text → tap Send.${channelHint}`;
    if (opts.touchNumber === 2) return `It's been a few days. Value-add check-in → tap Send.${channelHint}`;
    return `Last follow-up. Keep it light, no pressure → tap Send.${channelHint}`;
  }
  // didnt_buy
  if (opts.touchNumber === 1) return `Post-class follow-up. Address their objection → tap Send.${channelHint}`;
  if (opts.touchNumber === 2) return `It's been a week. Check in about their goal → tap Send.${channelHint}`;
  return `Last follow-up. Invite them for a 2nd class → tap Send.${channelHint}`;
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
  if (minutesAgo < 5) return 'Brand new lead! Contact them ASAP → tap Script';
  if (minutesAgo < 30) return `Lead came in ${minutesAgo}m ago. Reach out soon → tap Script`;
  return `This lead has been waiting ${minutesAgo > 60 ? Math.round(minutesAgo / 60) + 'h' : minutesAgo + 'm'}. Reach out now → tap Script`;
}

export function getTomorrowGuidance(confirmationSent: boolean): string {
  if (confirmationSent) return 'Confirmed ✓ No action needed until tomorrow.';
  return 'Send a confirmation text for tomorrow → tap Script';
}
