/**
 * Outreach lists are imported with names as "Last, First" (e.g. "Cook, Madi",
 * "Henderson Jr., C Dewayne"). Everywhere we DISPLAY those names we want
 * "First Last" instead. The DB value stays as imported so sort order and
 * CSV round-trips still work.
 */
export function formatOutreachName(raw: string | null | undefined): string {
  const s = (raw || '').trim();
  if (!s) return '';
  const idx = s.indexOf(',');
  if (idx === -1) return s;
  const last = s.slice(0, idx).trim();
  const first = s.slice(idx + 1).trim();
  if (!first) return last;
  if (!last) return first;
  return `${first} ${last}`;
}

/** Canonical key for equality checks — works for both "Last, First" and "First Last". */
export function outreachNameKey(raw: string | null | undefined): string {
  return formatOutreachName(raw).toLowerCase().replace(/\s+/g, ' ').trim();
}
