// Canonical helpers for studio display names across the giveaway surface.
// Participant-facing surfaces use the full "OrangeTheory Fitness" brand.
// Admin-facing surfaces keep the "OTF [Studio]" shorthand.
//
// Never display raw studio_name from the database — always route through here.

type Slug = 'tuscaloosa' | 'auburn' | 'montgomery' | 'vestavia' | string;

const CITY: Record<string, string> = {
  tuscaloosa: 'Tuscaloosa',
  auburn: 'Auburn',
  montgomery: 'Montgomery',
  vestavia: 'Vestavia Hills',
};

const IG_HANDLE: Record<string, string> = {
  tuscaloosa: '@otftuscaloosa',
  auburn: '@otfauburn',
  montgomery: '@otfmontgomery',
  vestavia: '@otfvestavia',
};

function humanize(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** "OrangeTheory Fitness Tuscaloosa" — full brand + city, participant-facing context */
export function getParticipantStudioName(slug: Slug): string {
  const city = CITY[slug] ?? humanize(slug);
  return `OrangeTheory Fitness ${city}`;
}

/** "OrangeTheory Fitness" — title strings where city is not needed */
export function getParticipantBrandName(): string {
  return 'OrangeTheory Fitness';
}

/** "OTF Tuscaloosa" — admin shorthand only */
export function getAdminStudioName(slug: Slug): string {
  const city = CITY[slug] ?? humanize(slug);
  // Keep admin shorthand short — first word of multi-word cities still reads well in nav.
  const shortCity = slug === 'vestavia' ? 'Vestavia' : city;
  return `OTF ${shortCity}`;
}

/** "Tuscaloosa" / "Vestavia Hills" — city only */
export function getStudioCity(slug: Slug): string {
  return CITY[slug] ?? humanize(slug);
}

/** "@otftuscaloosa" — single string, leading @ included */
export function getStudioIgHandle(slug: Slug): string {
  return IG_HANDLE[slug] ?? '@orangetheory';
}
