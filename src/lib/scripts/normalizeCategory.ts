/**
 * Normalize script template category strings for tab filtering.
 * DB categories may not exactly match tab values.
 */
export function normalizeCategory(
  cat: string | null | undefined,
): 'confirmation' | 'questionnaire' | 'follow_up' | 'other' {
  if (!cat) return 'other';
  const lower = cat.toLowerCase();
  if (lower.includes('confirm')) return 'confirmation';
  if (lower.includes('questionnaire')) return 'questionnaire';
  if (lower.includes('follow')) return 'follow_up';
  return 'other';
}
