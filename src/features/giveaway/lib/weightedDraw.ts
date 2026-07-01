export interface DrawEntry {
  id: string;
  name: string;
  total_entries: number;
  /** Legacy — no longer used to gate eligibility. Follow verification happens in person. */
  action_instagram_follow?: boolean;
}

/**
 * Everyone who submitted is eligible. Follow verification happens in person at the drawing.
 * Weight defaults to 1 for entries with zero actions logged.
 */
export function effectiveWeight(e: DrawEntry): number {
  return Math.max(1, e.total_entries || 0);
}

export function eligibleEntries(entries: DrawEntry[], excludeIds?: Set<string>): DrawEntry[] {
  return entries.filter(e => !(excludeIds?.has(e.id)));
}

export function buildTicketPool(entries: DrawEntry[], excludeIds?: Set<string>): DrawEntry[] {
  const pool: DrawEntry[] = [];
  for (const e of eligibleEntries(entries, excludeIds)) {
    const w = effectiveWeight(e);
    for (let i = 0; i < w; i++) pool.push(e);
  }
  return pool;
}

export function drawWinner(entries: DrawEntry[], excludeIds?: Set<string>): DrawEntry | null {
  const pool = buildTicketPool(entries, excludeIds);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function topWeightedForWheel(entries: DrawEntry[], max = 20, excludeIds?: Set<string>): DrawEntry[] {
  return eligibleEntries(entries, excludeIds)
    .sort((a, b) => effectiveWeight(b) - effectiveWeight(a))
    .slice(0, max);
}
