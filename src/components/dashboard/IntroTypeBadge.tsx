import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Lead source color mapping
const SOURCE_COLORS: Record<string, string> = {
  'Instagram DMs': 'bg-pink-500/15 text-pink-700 border-pink-500/30',
  'Instagram DMs (Friend)': 'bg-pink-500/15 text-pink-700 border-pink-500/30',
  'Member Referral': 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
  'Online Intro Offer (self-booked)': 'bg-blue-500/15 text-blue-700 border-blue-500/30',
  'VIP Class': 'bg-purple-500/15 text-purple-700 border-purple-500/30',
  'Lead Management': 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  'Lead Management (Friend)': 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  'My Personal Friend I Invited': 'bg-cyan-500/15 text-cyan-700 border-cyan-500/30',
  'Business Partnership Referral': 'bg-indigo-500/15 text-indigo-700 border-indigo-500/30',
  'Event': 'bg-orange-500/15 text-orange-700 border-orange-500/30',
};

const SHORT_SOURCE: Record<string, string> = {
  'Instagram DMs': 'IG DM',
  'Instagram DMs (Friend)': 'IG Friend',
  'Member Referral': 'Referral',
  'Online Intro Offer (self-booked)': 'Web Lead',
  'VIP Class': 'VIP',
  'Lead Management': 'Lead Mgmt',
  'Lead Management (Friend)': 'Lead Friend',
  'My Personal Friend I Invited': 'Personal',
  'Business Partnership Referral': 'Biz Partner',
  'Event': 'Event',
  'Source Not Found': 'Unknown',
};

interface IntroTypeBadgeProps {
  isSecondIntro: boolean;
  className?: string;
}

export function IntroTypeBadge({ isSecondIntro, className }: IntroTypeBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] px-1.5 py-0 h-4 font-semibold',
        isSecondIntro
          ? 'bg-violet-500/15 text-violet-700 border-violet-500/30'
          : 'bg-sky-500/15 text-sky-700 border-sky-500/30',
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