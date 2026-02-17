/**
 * Phone number extraction and normalization utilities.
 * Extracts US phone numbers from raw text, HTML, or email content.
 * Stores as 10-digit string. Formats for display.
 */

/**
 * Extract a US phone number from raw text/HTML content.
 * Returns 10-digit string or null.
 */
export function extractPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // Strip HTML tags and decode common entities
  let text = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();

  // Pass 1: tel: links (highest confidence)
  const telMatch = text.match(/tel:\s*\+?1?(\d{10})/i);
  if (telMatch) return telMatch[1];

  // Also try tel: with formatted number
  const telFmtMatch = text.match(/tel:\s*\+?1?[.\s-]?(\(?\d{3}\)?[.\s-]?\d{3}[.\s-]?\d{4})/i);
  if (telFmtMatch) {
    const digits = telFmtMatch[1].replace(/\D/g, '');
    const clean = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
    if (clean.length === 10) return clean;
  }

  // Pass 2: standard US formats
  // (xxx) xxx-xxxx, xxx-xxx-xxxx, xxx.xxx.xxxx, xxx xxx xxxx, +1 xxx xxx xxxx
  const patterns = [
    /\((\d{3})\)\s*(\d{3})[.\s-](\d{4})/,           // (205) 555-1234
    /(?:^|\D)(\d{3})[.\s-](\d{3})[.\s-](\d{4})(?:\D|$)/, // 205-555-1234
    /\+1\s*(\d{3})\s*(\d{3})\s*(\d{4})/,             // +1 205 555 1234
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      // Groups may vary: figure out which captured
      const groups = m.slice(1).filter(Boolean);
      const digits = groups.join('').replace(/\D/g, '');
      const clean = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
      if (clean.length === 10) return clean;
    }
  }

  // Pass 3: brute force — find any 10-digit sequence
  const allDigitRuns = text.replace(/[^\d+\s()\-\.]/g, ' ');
  const bruteMatch = allDigitRuns.match(/(?:\+?1[\s.-]?)?(?:\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4}))/);
  if (bruteMatch) {
    const digits = (bruteMatch[1] || '') + (bruteMatch[2] || '') + (bruteMatch[3] || '');
    if (digits.length === 10) return digits;
  }

  return null;
}

/**
 * Format a 10-digit phone for display: (205) 555-1234
 */
export function formatPhoneDisplay(digits: string | null | undefined): string | null {
  if (!digits) return null;
  const clean = digits.replace(/\D/g, '');
  if (clean.length === 10) {
    return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`;
  }
  return digits; // Return as-is if not 10 digits
}
