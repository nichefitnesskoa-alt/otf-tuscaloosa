export interface DrawEntry {
  id: string;
  name: string;
  total_entries: number;
}

export function buildTicketPool(entries: DrawEntry[]): DrawEntry[] {
  const pool: DrawEntry[] = [];
  for (const e of entries) {
    for (let i = 0; i < Math.max(0, e.total_entries); i++) pool.push(e);
  }
  return pool;
}

export function drawWinner(entries: DrawEntry[]): DrawEntry | null {
  const pool = buildTicketPool(entries);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function topWeightedForWheel(entries: DrawEntry[], max = 20): DrawEntry[] {
  return [...entries].sort((a, b) => b.total_entries - a.total_entries).slice(0, max);
}
