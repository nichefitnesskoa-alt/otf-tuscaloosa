/**
 * PhoneLink — renders a phone number as an `sms:` link that opens the
 * device's default messaging app on iOS and Android.
 * Falls back to plain text when the number can't be normalized.
 */
import { stripCountryCode, formatPhoneDisplay } from '@/lib/parsing/phone';
import { cn } from '@/lib/utils';

interface PhoneLinkProps {
  phone: string | null | undefined;
  className?: string;
  /** Override the visible text (defaults to formatted phone). */
  children?: React.ReactNode;
  /** Stop click bubbling so taps inside expandable cards don't toggle them. */
  stopPropagation?: boolean;
}

export function PhoneLink({ phone, className, children, stopPropagation = true }: PhoneLinkProps) {
  const clean = stripCountryCode(phone);
  const display = formatPhoneDisplay(phone);

  if (!clean || !display) {
    // Fall back to whatever raw text we have, no link
    return <span className={className}>{children ?? phone ?? ''}</span>;
  }

  return (
    <a
      href={`sms:+1${clean}`}
      onClick={(e) => { if (stopPropagation) e.stopPropagation(); }}
      className={cn('underline decoration-dotted underline-offset-2 hover:text-primary', className)}
    >
      {children ?? display}
    </a>
  );
}
