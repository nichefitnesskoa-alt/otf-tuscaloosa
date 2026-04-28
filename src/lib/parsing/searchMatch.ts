/**
 * Shared search-match helpers. Supports phone-by-digits matching alongside
 * standard text matching so users can search "(205) 555-1234", "205-555-1234",
 * or "5551234" and get the same hits.
 */

/** Strip everything but digits from a phone-like string. */
export function digitsOnly(s: string | null | undefined): string {
  return (s || '').replace(/\D/g, '');
}

/** True if the search query looks like the user is typing a phone (3+ digits). */
export function isPhoneSearch(searchTerm: string): boolean {
  return digitsOnly(searchTerm).length >= 3;
}

/**
 * Returns true when `phone` (any format) contains the digits in `searchTerm`.
 * Pass any number of phone fields — first non-empty match wins.
 */
export function phoneMatchesSearch(searchTerm: string, ...phones: (string | null | undefined)[]): boolean {
  const qDigits = digitsOnly(searchTerm);
  if (qDigits.length < 3) return false;
  for (const p of phones) {
    const pDigits = digitsOnly(p);
    if (pDigits && pDigits.includes(qDigits)) return true;
  }
  return false;
}
