import { cn } from '@/lib/utils';

interface CardGuidanceProps {
  text: string;
  className?: string;
}

export function CardGuidance({ text, className }: CardGuidanceProps) {
  if (!text) return null;
  return (
    <p className={cn('text-[10px] italic text-muted-foreground/70 leading-tight', className)}>
      {text}
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
  inCoolingPeriod?: boolean;
  coolingDaysAgo?: number;
  nextAvailableDate?: string;
}): string {
  if (opts.inCoolingPeriod) {
    return `Contacted ${opts.coolingDaysAgo}d ago. Next follow-up available ${opts.nextAvailableDate}. No action needed right now.`;
  }
  if (opts.isLegacy) {
    return "We don't have contact records for this person. Log when you last reached out → tap Log Past Contact. Or start fresh → tap Send";
  }
  if (opts.personType === 'no_show') {
    if (opts.touchNumber === 1) return 'They missed their class. Send a quick rebook text → tap Send';
    if (opts.touchNumber === 2) return "It's been a few days. Value-add check-in → tap Send";
    return 'Last follow-up. Keep it light, no pressure → tap Send';
  }
  // didnt_buy
  if (opts.touchNumber === 1) return 'Post-class follow-up. Address their objection → tap Send';
  if (opts.touchNumber === 2) return "It's been a week. Check in about their goal → tap Send";
  return 'Last follow-up. Invite them for a 2nd class → tap Send';
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
