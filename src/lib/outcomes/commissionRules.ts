/**
 * Commission rate lookup for membership types.
 * Source of truth for all commission calculations.
 * Rates: Premier=$15/$7.50, Elite=$12/$6, Basic=$3/$0 (with/without OTbeat)
 */

/** Standard intro sale commission by membership type */
export function computeCommission({ membershipType }: { membershipType: string | null }): number {
  if (!membershipType) return 0;
  const rules: Record<string, number> = {
    'Premier + OTbeat': 15,
    'Premier': 7.50,
    'Elite + OTbeat': 12,
    'Elite': 6,
    'Basic + OTbeat': 3,
    'Basic': 0,
    'HRM Add-on (OTBeat)': 7.50,
  };
  return rules[membershipType] ?? 0;
}

/**
 * HRM Add-on delta commission.
 * Returns the incremental commission for adding OTbeat to an existing membership.
 * Premier → +$7.50, Elite → +$6, Basic → +$3
 */
export function computeHRMDeltaCommission({ currentTier }: { currentTier: string }): number {
  const tier = currentTier.toLowerCase();
  if (tier.includes('premier')) return 7.50;
  if (tier.includes('elite')) return 6.00;
  if (tier.includes('basic')) return 3.00;
  return 7.50; // default fallback
}

/**
 * Upgrade commission = full commission for the new tier selected.
 * Same as computeCommission for the new tier.
 */
export function computeUpgradeCommission({ newTier }: { newTier: string }): number {
  return computeCommission({ membershipType: newTier });
}

/** Map a base tier to its OTbeat version */
export function getOTbeatTier(currentTier: string): string {
  const tier = currentTier.toLowerCase();
  if (tier.includes('premier')) return 'Premier + OTbeat';
  if (tier.includes('elite')) return 'Elite + OTbeat';
  if (tier.includes('basic')) return 'Basic + OTbeat';
  return 'Premier + OTbeat';
}

export function isSaleOutcome(outcome: string): boolean {
  return (
    outcome === 'Premier + OTbeat' ||
    outcome === 'Premier' ||
    outcome === 'Elite + OTbeat' ||
    outcome === 'Elite' ||
    outcome === 'Basic + OTbeat' ||
    outcome === 'Basic'
  );
}

/** The 6 standard intro membership tiers */
export const STANDARD_MEMBERSHIP_TIERS = [
  { label: 'Premier + OTbeat', commission: 15.00 },
  { label: 'Premier', commission: 7.50 },
  { label: 'Elite + OTbeat', commission: 12.00 },
  { label: 'Elite', commission: 6.00 },
  { label: 'Basic + OTbeat', commission: 3.00 },
  { label: 'Basic', commission: 0.00 },
] as const;

/** Base tiers (without OTbeat) for upgrade/HRM flows */
export const BASE_MEMBERSHIP_TIERS = [
  'Premier',
  'Elite',
  'Basic',
] as const;
