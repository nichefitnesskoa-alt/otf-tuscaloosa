/**
 * Reusable StatusBanner — full-width, colored, impossible-to-miss.
 * Used on intro cards (Q status), follow-up cards, needs-outcome cards, and lead cards.
 */
import { cn } from '@/lib/utils';

interface StatusBannerProps {
  /** Hex color or Tailwind bg class string */
  bgColor: string;
  text: string;
  subtext?: string;
  className?: string;
}

export function StatusBanner({ bgColor, text, subtext, className }: StatusBannerProps) {
  return (
    <div
      className={cn('w-full flex flex-col items-center justify-center px-3 py-1.5', className)}
      style={{ backgroundColor: bgColor, minHeight: subtext ? '42px' : '30px' }}
    >
      <span className="text-white text-[11px] font-semibold tracking-wide text-center leading-tight">
        {text}
      </span>
      {subtext && (
        <span className="text-white/80 text-[10px] text-center leading-none mt-0.5">
          {subtext}
        </span>
      )}
    </div>
  );
}
