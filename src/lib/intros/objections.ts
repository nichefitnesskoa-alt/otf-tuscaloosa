/**
 * Canonical objection list — single source of truth for every drawer,
 * editor, and drilldown that reads/writes an objection.
 *
 * Historical rows may contain legacy labels (e.g. "Pricing", "Spousal/Parental").
 * Use `normalizeObjectionLabel(raw)` to display them as their closest new label
 * without rewriting DB values.
 */
export const OBJECTION_OPTIONS = [
  'Price',
  'Time / Schedule',
  'Have to ask parents to pay',
  'Have to ask spouse',
  'Thinking About It',
  'Travel / Moving',
  'Trying other classes first',
  'Other',
] as const;

export type ObjectionOption = typeof OBJECTION_OPTIONS[number];

/** Map legacy stored values to the closest current label for display. */
const LEGACY_MAP: Record<string, string> = {
  'Pricing': 'Price',
  'Price / Cost': 'Price',
  'Time': 'Time / Schedule',
  'Spousal/Parental': 'Have to ask spouse',
  'Spouse / Family': 'Have to ask spouse',
  'Needs to talk to parents/spouse': 'Have to ask spouse',
  'Think About It': 'Thinking About It',
  'Needs to think about it': 'Thinking About It',
  'Out of Town': 'Travel / Moving',
  'Travel': 'Travel / Moving',
  "Timing isn't right": 'Time / Schedule',
  'Wants to try it first': 'Trying other classes first',
  'Already a Member': 'Other',
  'Health / Injury': 'Other',
  'Shopping Around': 'Trying other classes first',
};

export function normalizeObjectionLabel(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if ((OBJECTION_OPTIONS as readonly string[]).includes(trimmed)) return trimmed;
  return LEGACY_MAP[trimmed] || trimmed;
}
