/**
 * Stable color map for per-coach chart lines so a coach's color doesn't
 * shuffle when the active list changes. Falls back to a deterministic hash
 * for any coach not on the canonical list.
 */
const STABLE: Record<string, string> = {
  Koa: 'hsl(20 90% 47%)',       // OTF orange
  Alex: 'hsl(210 80% 55%)',     // blue
  Bri: 'hsl(285 70% 60%)',      // purple
  James: 'hsl(150 60% 45%)',    // green
  Nathan: 'hsl(38 92% 55%)',    // amber
  Faith: 'hsl(340 75% 60%)',    // pink
  Madison: 'hsl(190 70% 50%)',  // teal
  Jenna: 'hsl(0 70% 55%)',      // red
};

const FALLBACK_HUES = [55, 100, 170, 230, 260, 310, 15, 80, 130, 200];

export function colorForCoach(name: string): string {
  if (STABLE[name]) return STABLE[name];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${FALLBACK_HUES[h % FALLBACK_HUES.length]} 70% 55%)`;
}
