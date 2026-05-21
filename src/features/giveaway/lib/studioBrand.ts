export const STUDIO_IG: Record<string, { handle: string; display: string }> = {
  tuscaloosa: { handle: 'otftuscaloosa', display: '@otftuscaloosa' },
  auburn:     { handle: 'otfauburn',     display: '@otfauburn' },
  montgomery: { handle: 'otfmontgomery', display: '@otfmontgomery' },
  vestavia:   { handle: 'otfvestaviahills', display: '@otfvestaviahills' },
};

export const STUDIO_CITY: Record<string, string> = {
  tuscaloosa: 'TUSCALOOSA',
  auburn: 'AUBURN',
  montgomery: 'MONTGOMERY',
  vestavia: 'VESTAVIA HILLS',
};

export function getStudioIg(slug: string): { handle: string; display: string } {
  return STUDIO_IG[slug] || { handle: 'orangetheory', display: '@orangetheory' };
}

export function getStudioCity(slug: string): string {
  return STUDIO_CITY[slug] || slug.toUpperCase();
}
