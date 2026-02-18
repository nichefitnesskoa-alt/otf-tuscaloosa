/**
 * Commission rate lookup for membership types.
 * Source of truth for all commission calculations.
 * Rates: Premier=$15/$7.50, Elite=$12/$6, Basic=$3/$0 (with/without OTbeat)
 */
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
