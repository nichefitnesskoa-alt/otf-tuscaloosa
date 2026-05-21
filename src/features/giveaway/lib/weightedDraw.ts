export interface DrawEntry {
  id: string;
  name: string;
  total_entries: number;
}

/** Only entries with > 0 tickets are eligible. */
export function eligibleEntries(entries: DrawEntry[]): DrawEntry[] {
  return entries.filter(e => e.total_entries > 0);
}

export function buildTicketPool(entries: DrawEntry[]): DrawEntry[] {
  const pool: DrawEntry[] = [];
  for (const e of eligibleEntries(entries)) {
    for (let i = 0; i < e.total_entries; i++) pool.push(e);
  }
  return pool;
}

export function drawWinner(entries: DrawEntry[]): DrawEntry | null {
  const pool = buildTicketPool(entries);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function topWeightedForWheel(entries: DrawEntry[], max = 20): DrawEntry[] {
  return eligibleEntries(entries)
    .sort((a, b) => b.total_entries - a.total_entries)
    .slice(0, max);
}
