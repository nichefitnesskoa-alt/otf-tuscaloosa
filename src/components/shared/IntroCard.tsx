/**
 * Shared IntroCard component — unified visual language for all intro/follow-up cards.
 *
 * Section divider header: full-width dark bar with metadata
 * Card body: member name large, outcome badge, timing, action buttons, copy phone
 */
import { ReactNode } from 'react';
import { format } from 'date-fns';
import { Phone, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDisplayTime } from '@/lib/time/timeUtils';
import { formatPhoneDisplay, stripCountryCode } from '@/lib/parsing/phone';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface IntroCardProps {
  memberName: string;
  classDate: string;
  introTime: string | null;
  coachName: string | null;
  leadSource: string | null;
  phone: string | null;

  /** Rendered after member name */
  badges?: ReactNode;
  /** Status badge (e.g. outcome result) */
  outcomeBadge?: ReactNode;
  /** Timing context (e.g. "3 days since last contact") */
  timingInfo?: string;
  /** Primary action buttons row */
  actionButtons: ReactNode;
  /** Secondary actions row (e.g. copy Q link, log as sent) */
  secondaryActions?: ReactNode;
  /** Last contact log summary text */
  lastContactSummary?: string;

  /** Custom phone copy handler */
  onCopyPhone?: () => void;
  /** Left border color for urgency states */
  borderColor?: string;
  /** Banner above card body (e.g. status banner) */
  topBanner?: ReactNode;

  /** Additional content rendered inside card body */
  children?: ReactNode;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
}

function formatCardDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return format(d, 'EEE, MMM d');
  } catch {
    return dateStr;
  }
}

export default function IntroCard({
  memberName,
  classDate,
  introTime,
  coachName,
  leadSource,
  phone,
  badges,
  outcomeBadge,
  timingInfo,
  actionButtons,
  secondaryActions,
  lastContactSummary,
  onCopyPhone,
  borderColor,
  topBanner,
  children,
  className,
  id,
  style,
}: IntroCardProps) {
  const handleCopyPhone = () => {
    if (onCopyPhone) {
      onCopyPhone();
    } else if (phone) {
      navigator.clipboard.writeText(stripCountryCode(phone) || phone);
      toast.success('Phone copied');
    }
  };

  // Build header segments
  const headerSegments: string[] = [formatCardDate(classDate)];
  if (introTime) headerSegments.push(formatDisplayTime(introTime));
  if (coachName && coachName !== 'TBD') headerSegments.push(coachName);
  if (leadSource) headerSegments.push(leadSource);

  return (
    <div className={cn('space-y-0', className)} id={id}>
      {/* ── Section divider header ── */}
      <div className="w-full bg-[#1c1c1e] dark:bg-[#1c1c1e] rounded-t-lg px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium truncate min-w-0">
          {headerSegments.map((seg, i) => (
            <span key={i} className="flex items-center gap-1.5 shrink-0">
              {i > 0 && <span className="text-muted-foreground/50">·</span>}
              <span className="truncate">{seg}</span>
            </span>
          ))}
        </div>
        {phone && (
          <button
            onClick={handleCopyPhone}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <Phone className="w-3 h-3" />
            <span className="hidden sm:inline">{formatPhoneDisplay(phone) || phone}</span>
          </button>
        )}
      </div>

      {/* ── Card body ── */}
      <div
        className={cn(
          'bg-card rounded-b-lg overflow-hidden transition-all',
          borderColor && 'border-l-4',
        )}
        style={{
          ...(borderColor ? { borderLeftColor: borderColor } : {}),
          ...style,
        }}
      >
        {/* Top banner slot */}
        {topBanner}

        <div className="p-4 space-y-3">
          {/* Member name — large and dominant */}
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold leading-tight">{memberName}</h3>
            {badges}
          </div>

          {/* Outcome badge + timing info */}
          {(outcomeBadge || timingInfo) && (
            <div className="flex items-center gap-2 flex-wrap">
              {outcomeBadge}
              {timingInfo && (
                <span className="text-xs text-muted-foreground">{timingInfo}</span>
              )}
            </div>
          )}

          {/* Primary action buttons */}
          <div className="flex items-center gap-2">
            {actionButtons}
          </div>

          {/* Secondary actions */}
          {secondaryActions && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {secondaryActions}
            </div>
          )}

          {/* Additional content */}
          {children}

          {/* Last contact summary + copy phone */}
          {(lastContactSummary || phone) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border/50">
              {lastContactSummary && (
                <span className="flex-1 truncate">{lastContactSummary}</span>
              )}
              {phone && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] gap-1 px-2"
                  onClick={handleCopyPhone}
                >
                  <Copy className="w-3 h-3" />
                  Copy Phone
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
