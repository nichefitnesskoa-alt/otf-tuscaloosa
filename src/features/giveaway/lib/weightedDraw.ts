export interface DrawEntry {
  id: string;
  name: string;
  total_entries: number;
  /** Hard requirement: must have completed the Instagram follow action to be eligible. */
  action_instagram_follow?: boolean;
}

/** Only entries with > 0 tickets, completed IG follow, and not in excludeIds are eligible. */
export function eligibleEntries(entries: DrawEntry[], excludeIds?: Set<string>): DrawEntry[] {
  return entries.filter(
    e =>
      e.total_entries > 0 &&
      e.action_instagram_follow === true &&
      !(excludeIds?.has(e.id))
  );
}

export function buildTicketPool(entries: DrawEntry[], excludeIds?: Set<string>): DrawEntry[] {
  const pool: DrawEntry[] = [];
  for (const e of eligibleEntries(entries, excludeIds)) {
    for (let i = 0; i < e.total_entries; i++) pool.push(e);
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
    .sort((a, b) => b.total_entries - a.total_entries)
    .slice(0, max);
}
