import type { GiveawayPartner } from '../hooks/useGiveawayPartners';
import { getParticipantBrandName, getParticipantStudioName } from '@/lib/studioNames';

export type TitleFormat = 'auto_combined' | 'auto_studio_only' | 'custom';

/**
 * Build the participant-facing giveaway title.
 * City is NEVER included here — the co-brand bar carries city context.
 */
export function getGiveawayTitle(
  slug: string,
  partners: Pick<GiveawayPartner, 'partner_name'>[],
  titleFormat: TitleFormat | null | undefined,
  customTitle: string | null | undefined,
): string {
  const fmt: TitleFormat = (titleFormat as TitleFormat) || 'auto_combined';
  const brand = getParticipantBrandName();

  if (fmt === 'custom') {
    const ct = (customTitle || '').trim();
    if (ct) return ct;
    return `${brand} Giveaway`;
  }

  if (fmt === 'auto_studio_only') {
    return `${brand} Giveaway`;
  }

  // auto_combined
  const names = (partners || [])
    .map(p => p.partner_name?.trim())
    .filter((n): n is string => !!n);
  if (names.length === 0) return `${brand} Giveaway`;
  return `${brand} × ${names.join(' × ')} Giveaway`;
}

/**
 * "Presented by OrangeTheory Fitness Tuscaloosa + Partner1 + Partner2"
 * Returns the parts so the renderer can style separators distinctly.
 */
export function getCoBrandParts(
  slug: string,
  partners: Pick<GiveawayPartner, 'partner_name'>[],
): string[] {
  const parts = [getParticipantStudioName(slug)];
  for (const p of partners) {
    const n = p.partner_name?.trim();
    if (n) parts.push(n);
  }
  return parts;
}
