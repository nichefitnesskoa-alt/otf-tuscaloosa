/**
 * Shared IntroCard component — unified visual language for all intro/follow-up cards.
 *
 * Header bar: full-width, inverted colors, member name + metadata
 * Card body: banners, action rows, outcome banner
 */
import { ReactNode } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatDisplayTime } from '@/lib/time/timeUtils';
import { formatPhoneDisplay } from '@/lib/parsing/phone';

export interface IntroCardProps {
  memberName: string;
  classDate: string;
  introTime: string | null;
  coachName: string | null;
  leadSource: string | null;
  phone: string | null;

  /** Rendered after member name in header */
  badges?: ReactNode;
  /** Status badge (e.g. outcome result) — rendered in card body */
  outcomeBadge?: ReactNode;
  /** Timing context (e.g. "3 days since last contact") */
  timingInfo?: string;
  /** Primary action buttons row — rendered as 3 equal columns */
  actionButtons: ReactNode;
  /** Secondary actions row — rendered as 4 equal columns */
  secondaryActions?: ReactNode;
  /** Last contact log summary text */
  lastContactSummary?: string;

  /** Left border color — REMOVED, kept for API compat but ignored */
  borderColor?: string;
  /** Banner above card body (e.g. Q status banner) */
  topBanner?: ReactNode;
  /** Outcome banner at bottom of card */
  outcomeBanner?: ReactNode;

  /** Additional content rendered inside card body */
  children?: ReactNode;
  className?: string;
  id?: string;
  style?: React.CSSProperties;

  /** @deprecated — use header phone display instead */
  onCopyPhone?: () => void;
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
  topBanner,
  outcomeBanner,
  children,
  className,
  id,
  style,
}: IntroCardProps) {
  // Build metadata segments for line 2
  const metaSegments: string[] = [];
  if (introTime) metaSegments.push(formatDisplayTime(introTime));
  if (coachName && coachName !== 'TBD') metaSegments.push(coachName);
  if (leadSource) metaSegments.push(leadSource);
  if (phone) metaSegments.push(formatPhoneDisplay(phone) || phone);

  return (
    <div className={cn('mb-6', className)} id={id} style={style}>
      {/* ── HEADER BAR — full width, inverted colors ── */}
      <div className="w-full bg-white dark:bg-black px-3 py-2.5">
        {/* Line 1: Member name */}
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-lg font-bold leading-tight text-black dark:text-white">
            {memberName}
          </h3>
          {badges}
        </div>
        {/* Line 2: metadata */}
        {metaSegments.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 flex-wrap">
            {metaSegments.map((seg, i) => (
              <span key={i} className="flex items-center gap-1.5 shrink-0">
                {i > 0 && <span className="opacity-50">·</span>}
                <span>{seg}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── CARD BODY — directly below header, no gap ── */}
      <div className="bg-card overflow-hidden">
        {/* Top banner slot (Q status, focus timer, etc.) */}
        {topBanner}

        {/* Outcome badge + timing info */}
        {(outcomeBadge || timingInfo) && (
          <div className="flex items-center gap-2 flex-wrap px-4 pt-3">
            {outcomeBadge}
            {timingInfo && (
              <span className="text-xs text-muted-foreground">{timingInfo}</span>
            )}
          </div>
        )}

        <div className="p-4 space-y-3">
          {/* ROW 1 — Primary action buttons — equal columns */}
          <div className="flex w-full">
            {actionButtons}
          </div>

          {/* ROW 2 — Secondary actions — equal columns */}
          {secondaryActions && (
            <div className="flex w-full">
              {secondaryActions}
            </div>
          )}

          {/* Additional content */}
          {children}

          {/* Last contact summary */}
          {lastContactSummary && (
            <div className="text-xs text-muted-foreground pt-1 border-t border-border/50">
              <span className="truncate">{lastContactSummary}</span>
            </div>
          )}
        </div>

        {/* OUTCOME BANNER — full width bottom */}
        {outcomeBanner}
      </div>

      {/* If no outcome banner, thin bottom border */}
      {!outcomeBanner && (
        <div className="w-full h-px bg-white dark:bg-white" />
      )}
    </div>
  );
}
