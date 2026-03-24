/**
 * Green "✓ Contacted X ago" banner for follow-up cards.
 * Persists for a 7-day cooling window after last contact.
 * Shows "next contact in Y days" countdown.
 */
import { differenceInMinutes, differenceInHours, differenceInDays, format } from 'date-fns';

interface ContactedBannerProps {
  lastContactAt: string | null;
  contactNextDate: string | null;
}

const COOLING_DAYS = 7;

function formatContactedAgo(contactDate: Date): string {
  const now = new Date();
  const mins = differenceInMinutes(now, contactDate);
  if (mins < 60) return `${Math.max(1, mins)} minute${mins !== 1 ? 's' : ''} ago`;
  const hrs = differenceInHours(now, contactDate);
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
  const days = differenceInDays(now, contactDate);
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
  return format(contactDate, 'MMM d');
}

export function ContactedBanner({ lastContactAt, contactNextDate }: ContactedBannerProps) {
  if (!lastContactAt) return null;

  const contactDate = new Date(lastContactAt);
  const now = new Date();
  const daysSince = differenceInDays(now, contactDate);

  // Hide banner if older than 7 days
  if (daysSince >= COOLING_DAYS) return null;

  const agoText = formatContactedAgo(contactDate);
  const daysRemaining = COOLING_DAYS - daysSince;

  return (
    <div className="w-full flex items-center justify-between gap-1.5 px-3 py-1.5" style={{ backgroundColor: '#16a34a' }}>
      <span className="text-white text-xs font-medium">✓ Contacted {agoText}</span>
      {daysRemaining > 0 && (
        <span className="text-white/80 text-[10px]">
          next in {daysRemaining}d
        </span>
      )}
    </div>
  );
}
