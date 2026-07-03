// OTF brand tokens — single source of truth for inline styling.
// Palette is locked. Orange is constant across modes. Surface/text are
// theme-aware and follow the active light/dark mode via CSS variables.
export const OTF = {
  // Constant brand accents (never theme-swap)
  orange: '#FF6F0D',
  blue: '#1DD0FD',
  gray: '#D7D7D7',

  // Theme-aware surface + text — resolve to bone in light mode, dark in dark mode
  // (bg-background / text-foreground tokens from index.css)
  dark: 'hsl(var(--background))',       // page/surface background
  bone: 'hsl(var(--foreground))',       // primary text color

  // Explicit raw hex — use ONLY when you need a color that must not flip
  // with theme (e.g. orange-on-anything CTA, brand splashes).
  rawDark: '#0A0A0A',
  rawBone: '#FDF7EA',
} as const;

// Theme-aware helpers for inline styles. Prefer these over ${OTF.bone}XX
// alpha-hex tricks — they respect light/dark automatically.
export const Theme = {
  bg: 'hsl(var(--background))',
  card: 'hsl(var(--card))',
  fg: 'hsl(var(--foreground))',
  mutedFg: 'hsl(var(--muted-foreground))',
  border: 'hsl(var(--border))',
  subtleBorder: 'hsl(var(--border) / 0.6)',
  primary: 'hsl(var(--primary))',
} as const;

export const brandFont = {
  fontFamily: "'PP Right Grotesk', 'Arial Black', 'Helvetica Neue', Arial, sans-serif",
  letterSpacing: '-0.02em',
} as const;
