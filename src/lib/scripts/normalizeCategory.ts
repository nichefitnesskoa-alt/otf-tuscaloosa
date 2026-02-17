/**
 * Normalize script template category strings for tab filtering.
 * DB categories may not exactly match tab values.
 *
 * DB categories: booking_confirmation, no_show, post_class_no_close,
 * cancel_freeze, web_lead, cold_lead, ig_dm, post_class_joined,
 * referral_ask, promo
 */
export function normalizeCategory(
  cat: string | null | undefined,
): 'confirmation' | 'follow_up' | 'outreach' | 'other' {
  if (!cat) return 'other';
  const lower = cat.toLowerCase();
  if (lower.includes('confirm')) return 'confirmation';
  // follow_up bucket: no_show, post_class_no_close, cancel_freeze, any "follow"
  if (lower === 'no_show' || lower === 'post_class_no_close' || lower === 'cancel_freeze' || lower.includes('follow')) return 'follow_up';
  // outreach bucket: web_lead, cold_lead, ig_dm
  if (lower === 'web_lead' || lower === 'cold_lead' || lower === 'ig_dm' || lower.includes('outreach')) return 'outreach';
  return 'other';
}
