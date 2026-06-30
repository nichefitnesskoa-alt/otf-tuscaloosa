/**
 * SGL (Self-Generated Lead) classification — single source of truth.
 *
 * Non-SGL = passive web traffic (the lead found us via the public Online
 * Intro Offer form). Every other lead source counts as SGL because staff
 * or members brought the person in, including any "(Friend)" variant
 * (a current member/staff brought them in).
 */
export const NON_SGL_SOURCES = ['Online Intro Offer (self-booked)'] as const;

export function isSglLeadSource(source: string | null | undefined): boolean {
  const s = (source ?? '').trim();
  if (!s) return false;
  if ((NON_SGL_SOURCES as readonly string[]).includes(s)) return false;
  return true;
}
