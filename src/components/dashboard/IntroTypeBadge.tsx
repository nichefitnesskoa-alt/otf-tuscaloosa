import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Lead source color mapping — Wave 4: source is neutral identity, not status.
// All sources use neutral-dim; distinguish by label text only.
const NEUTRAL_SOURCE = 'bg-neutral-dim text-neutral border-surface-border';
const SOURCE_COLORS: Record<string, string> = {
  'Instagram DMs': NEUTRAL_SOURCE,
  'Instagram DMs (Friend)': NEUTRAL_SOURCE,
  'Member Referral': NEUTRAL_SOURCE,
  'Online Intro Offer (self-booked)': NEUTRAL_SOURCE,
  'Online Intro Offer (Friend)': NEUTRAL_SOURCE,
  'VIP Class': NEUTRAL_SOURCE,
  'Lead Management': NEUTRAL_SOURCE,
  'Lead Management (Friend)': NEUTRAL_SOURCE,
  'My Personal Friend I Invited': NEUTRAL_SOURCE,
  'Business Partnership Referral': NEUTRAL_SOURCE,
  'Event': NEUTRAL_SOURCE,
  'Walk-in': NEUTRAL_SOURCE,
  'Walk-in (Friend)': NEUTRAL_SOURCE,
};

const SHORT_SOURCE: Record<string, string> = {
  'Instagram DMs': 'IG DM',
  'Instagram DMs (Friend)': 'IG Friend',
  'Member Referral': 'Referral',
  'Online Intro Offer (self-booked)': 'Web Lead',
  'Online Intro Offer (Friend)': 'Web Friend',
  'VIP Class': 'VIP',
  'Lead Management': 'Lead Mgmt',
  'Lead Management (Friend)': 'Lead Friend',
  'My Personal Friend I Invited': 'Personal',
  'Business Partnership Referral': 'Biz Partner',
  'Event': 'Event',
  'Walk-in': 'Walk-in',
  'Walk-in (Friend)': 'Walk-in Friend',
};

interface IntroTypeBadgeProps {
  isSecondIntro: boolean;
  isVipClassIntro?: boolean;
  className?: string;
}

export function IntroTypeBadge({ isSecondIntro, isVipClassIntro, className }: IntroTypeBadgeProps) {
  if (isVipClassIntro) {
    return (
      <Badge
        variant="outline"
        className={cn(
          'text-[10px] px-1.5 py-0 h-4 font-semibold bg-brand-dim text-brand border-surface-border',
          className
        )}
      >
        VIP Class Intro
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] px-1.5 py-0 h-4 font-semibold',
        isSecondIntro
          ? 'bg-brand-dim text-brand border-surface-border'
          : 'bg-neutral-dim text-neutral border-surface-border',
        className
      )}
    >
      {isSecondIntro ? '2nd Intro' : '1st Intro'}
    </Badge>
  );
}

interface LeadSourceTagProps {
  source: string;
  className?: string;
}

export function LeadSourceTag({ source, className }: LeadSourceTagProps) {
  const colorClass = SOURCE_COLORS[source] || 'bg-muted text-muted-foreground border-border';
  const shortName = SHORT_SOURCE[source] || source;

  return (
    <Badge
      variant="outline"
      className={cn('text-[10px] px-1.5 py-0 h-4', colorClass, className)}
    >
      {shortName}
    </Badge>
  );
}