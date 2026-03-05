/**
 * Green "✓ Contacted X ago" banner for follow-up cards.
 * Auto-hides when contactNextDate has passed (follow-up is due again).
 * Shows nothing if never contacted.
 */
import { format, differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns';

interface ContactedBannerProps {
  lastContactAt: string | null;
  contactNextDate: string | null;
}

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

  // If contactNextDate exists and has passed → hide banner (follow-up is due)
  if (contactNextDate) {
    const dueDate = new Date(contactNextDate + 'T23:59:59');
    if (new Date() > dueDate) return null;
  }

  const contactDate = new Date(lastContactAt);
  const agoText = formatContactedAgo(contactDate);

  return (
    <div className="w-full flex items-center gap-1.5 px-3 py-1.5" style={{ backgroundColor: '#16a34a' }}>
      <span className="text-white text-xs font-medium">✓ Contacted {agoText}</span>
    </div>
  );
}
