/**
 * Canonical control for editing lead_source + referred_by_member_name together.
 *
 * Rules (mirrors src/lib/sa/leadsBooked.ts isReferralLikeSource and the DB
 * trigger enforce_member_referral_has_referrer):
 *  - When the selected lead source is referral-like (any "(Friend)" variant
 *    or one of the explicit referral sources), the referring member's name
 *    is required.
 *  - When the source is not referral-like, the referrer is cleared (null).
 *  - The full canonical LEAD_SOURCES list is always shown, so every "(Friend)"
 *    variant is available on every edit surface.
 *
 * Used by every surface that edits lead_source on an existing booking:
 *  - Pipeline spreadsheet inline editor
 *  - Client Journey Panel (edit booking, edit run)
 *  - Reschedule dialog
 *  - Edit Sale dialog
 *  - MyDay Edit Booking dialog
 *  - Person Journey Card
 *  - Book Intro Dialog / Self-Sourced Lead form
 */
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NameAutocomplete } from '@/components/shared/NameAutocomplete';
import { BusinessPartnerCombobox } from '@/components/leads/BusinessPartnerCombobox';
import { LEAD_SOURCES } from '@/types';
import { isBusinessPartnershipReferralSource, isReferralLikeSource } from '@/lib/sa/leadsBooked';
import { cn } from '@/lib/utils';

export interface LeadSourceWithReferrerValue {
  lead_source: string;
  referred_by_member_name: string | null;
}

interface Props {
  value: string;
  referredByMemberName: string | null | undefined;
  onChange: (next: LeadSourceWithReferrerValue) => void;
  /** Compact = smaller Select/Input (for spreadsheet inline / drilldowns). */
  size?: 'default' | 'compact';
  disabled?: boolean;
  /** Custom label text; pass null to hide the label. */
  label?: string | null;
  /** Custom placeholder for the source Select. */
  placeholder?: string;
  className?: string;
}

/**
 * Pure validator — call from every save handler before writing to the DB.
 * Returns an error message if invalid, or null when the pair is valid.
 */
export function validateLeadSourceReferrer(
  leadSource: string | null | undefined,
  referrer: string | null | undefined,
): string | null {
  if (!leadSource) return null;
  if (!isReferralLikeSource(leadSource)) return null;
  if (!referrer || !referrer.trim()) {
    return 'Referring member name is required for referral / friend lead sources';
  }
  return null;
}

/**
 * Normalizes a referrer value for DB write: null when source is not
 * referral-like OR when the input is blank; trimmed string otherwise.
 */
export function resolveReferrerForWrite(
  leadSource: string | null | undefined,
  referrer: string | null | undefined,
): string | null {
  if (!leadSource || !isReferralLikeSource(leadSource)) return null;
  const trimmed = (referrer ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

export function LeadSourceWithReferrerField({
  value,
  referredByMemberName,
  onChange,
  size = 'default',
  disabled = false,
  label = 'Lead Source',
  placeholder = 'Select source…',
  className,
}: Props) {
  const compact = size === 'compact';
  const referral = isReferralLikeSource(value);
  const referrer = referredByMemberName ?? '';
  const missing = referral && !referrer.trim();
  const businessPartner = isBusinessPartnershipReferralSource(value);

  return (
    <div className={cn('space-y-1.5', className)}>
      {label !== null && (
        <Label className={compact ? 'text-[10px] uppercase tracking-wide text-muted-foreground' : 'text-sm'}>
          {label}
        </Label>
      )}
      <Select
        value={value || ''}
        onValueChange={(v) => {
          // If switching away from referral-like, clear stale referrer.
          const nextReferrer = isReferralLikeSource(v) ? (referredByMemberName ?? null) : null;
          onChange({ lead_source: v, referred_by_member_name: nextReferrer });
        }}
        disabled={disabled}
      >
        <SelectTrigger className={compact ? 'h-7 text-xs' : 'h-11'}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {LEAD_SOURCES.map((s) => (
            <SelectItem key={s} value={s} className={compact ? 'text-xs' : undefined}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {referral && (
        <div className="space-y-1">
          <Label className={compact ? 'text-[10px] uppercase tracking-wide text-muted-foreground' : 'text-sm'}>
            {businessPartner
              ? 'Business partner *'
              : "Referring member's full name *"}
          </Label>
          {businessPartner ? (
            <BusinessPartnerCombobox
              value={referrer}
              disabled={disabled}
              className={compact ? 'h-7 text-xs' : 'h-11'}
              onChange={(v) =>
                onChange({ lead_source: value, referred_by_member_name: v || null })
              }
            />
          ) : (
            <NameAutocomplete
              value={referrer}
              onChange={(v) =>
                onChange({ lead_source: value, referred_by_member_name: v || null })
              }
              placeholder="Who referred them? (required)"
              className={cn(
                compact ? 'h-7 text-xs' : 'h-11',
                missing && 'ring-1 ring-destructive/40',
              )}
            />
          )}
          {missing && (
            <p className="text-[11px] text-destructive">
              Required for referral / friend lead sources.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
