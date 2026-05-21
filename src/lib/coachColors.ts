// OTF Tuscaloosa Coach Color Map
// Single source of truth for all coach line colors in charts and UI.
// Colors are stable — never reassign a color to a different coach.
// To add a new coach: append to COACH_COLORS, take next color from COACH_COLOR_LEGEND.
// To remove a coach: set active: false — do not delete (preserves historical data).

export const COACH_COLORS: Record<string, {
  color: string;
  hsl: string;
  active: boolean;
}> = {
  Koa:     { color: '#3B82F6', hsl: '217 91% 60%', active: true }, // Blue
  James:   { color: '#A855F7', hsl: '271 91% 65%', active: true }, // Purple
  Nathan:  { color: '#22D3EE', hsl: '189 94% 60%', active: true }, // Cyan
  Jackson: { color: '#F59E0B', hsl: '38 92% 50%',  active: true }, // Amber
  Natalya: { color: '#EC4899', hsl: '330 81% 60%', active: true }, // Pink
};

// Color legend for new hires — assign in order, top to bottom.
export const COACH_COLOR_LEGEND = [
  { name: 'Emerald', color: '#10B981', hsl: '160 84% 39%' },
  { name: 'Lime',    color: '#84CC16', hsl: '84 81% 44%'  },
  { name: 'Rose',    color: '#FB7185', hsl: '351 95% 71%' },
];

// None of the coach colors are OTF orange (#E8540A).
// Studio overall line always uses OTF orange — reserved exclusively for that.

export function colorForCoach(name: string): string {
  return COACH_COLORS[name]?.color ?? '#8E8E93';
}

export function hslForCoach(name: string): string {
  return COACH_COLORS[name]?.hsl ?? '240 2% 57%';
}

export function isActiveCoach(name: string): boolean {
  return COACH_COLORS[name]?.active ?? false;
}
