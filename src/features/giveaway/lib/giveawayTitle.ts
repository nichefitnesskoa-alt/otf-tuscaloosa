import type { GiveawayPartner } from '../hooks/useGiveawayPartners';

export type TitleFormat = 'auto_combined' | 'auto_studio_only' | 'custom';

/**
 * Strip the leading "OTF " from a stored studio_name so we can rebuild
 * "OTF X × Y × Z Giveaway" without doubling the prefix.
 */
function stripOtfPrefix(name: string): string {
  return (name || '').replace(/^otf\s+/i, '').trim();
}

export function getGiveawayTitle(
  studioName: string,
  partners: Pick<GiveawayPartner, 'partner_name'>[],
  titleFormat: TitleFormat | null | undefined,
  customTitle: string | null | undefined,
): string {
  const fmt: TitleFormat = (titleFormat as TitleFormat) || 'auto_combined';
  const studio = stripOtfPrefix(studioName) || 'Giveaway';

  if (fmt === 'custom') {
    const ct = (customTitle || '').trim();
    if (ct) return ct;
    return `OTF ${studio} Giveaway`;
  }

  if (fmt === 'auto_studio_only') {
    return `OTF ${studio} Giveaway`;
  }

  // auto_combined
  const names = partners.map(p => p.partner_name?.trim()).filter(Boolean) as string[];
  if (names.length === 0) return `OTF ${studio} Giveaway`;
  return `OTF ${studio} × ${names.join(' × ')} Giveaway`;
}

/**
 * "Presented by OTF Studio + Partner1 + Partner2"
 * Returns the parts so the renderer can style separators distinctly.
 */
export function getCoBrandParts(
  studioName: string,
  partners: Pick<GiveawayPartner, 'partner_name'>[],
): string[] {
  const studio = stripOtfPrefix(studioName) || 'Giveaway';
  const parts = [`OTF ${studio}`];
  for (const p of partners) {
    const n = p.partner_name?.trim();
    if (n) parts.push(n);
  }
  return parts;
}
