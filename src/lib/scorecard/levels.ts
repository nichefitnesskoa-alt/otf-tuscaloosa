// First Visit Experience Scorecard — locked spec
// Source: FVExperienceScorecard_V2_1_1.pdf

export type ColumnKey = 'tread' | 'rower' | 'floor' | 'otbeat' | 'handback';
export type ClassType = 'orange_60_2g' | 'orange_60_3g' | 'strength_and_tread_50';
export type EvalType = 'self_eval' | 'formal_eval';

export const COLUMNS: { key: ColumnKey; label: string; subtitle?: string }[] = [
  { key: 'tread',    label: 'Treadmill' },
  { key: 'rower',    label: 'Rower' },
  { key: 'floor',    label: 'Floor' },
  { key: 'otbeat',   label: 'OTBeat' },
  { key: 'handback', label: 'Handback', subtitle: 'B.E.S.T.' },
];

export const BULLETS: Record<ColumnKey, { key: string; label: string }[]> = {
  tread: [
    { key: 'tread_otconnect',     label: 'Assisted guest get connected to OTConnect' },
    { key: 'tread_first_effort',  label: 'Check in during first effort' },
    { key: 'tread_throughout',    label: 'Check in throughout the blocks (purposefully)' },
  ],
  rower: [
    { key: 'rower_setup',         label: 'Check in for setup / equipment / OTConnect' },
    { key: 'rower_phases',        label: 'Check in on 4 phases of rowing / tempo' },
    { key: 'rower_throughout',    label: 'Check in throughout the blocks' },
  ],
  floor: [
    { key: 'floor_connect',       label: 'Connect — check in throughout block' },
    { key: 'floor_correct',       label: 'Correct — ensure proper form' },
    { key: 'floor_customize',     label: 'Customize — provide options and challenges' },
  ],
  otbeat: [
    { key: 'otbeat_color',        label: 'Color — coaching to colors, dependent on effort' },
    { key: 'otbeat_feeling',      label: 'Feeling — coaching to how an effort should feel' },
    { key: 'otbeat_hr',           label: 'HR % — coaching to desired HR zones using percentages' },
  ],
  handback: [
    { key: 'handback_recap',      label: 'OTBeat summary recap — 1–2 points tied to intro goals' },
    { key: 'handback_recommend',  label: 'Provided specific recommendation (frequency / OTBeat wearable)' },
    { key: 'handback_prebook',    label: 'Prebook (class specific)' },
  ],
};

export const ALL_BULLETS = (Object.keys(BULLETS) as ColumnKey[]).flatMap(col =>
  BULLETS[col].map(b => ({ ...b, column: col }))
);

export const CLASS_TYPES: { value: ClassType; label: string }[] = [
  { value: 'orange_60_2g',          label: 'Orange 60 — 2G' },
  { value: 'orange_60_3g',          label: 'Orange 60 — 3G' },
  { value: 'strength_and_tread_50', label: 'Strength & Tread 50' },
];

export function scoreToLevel(total: number): 1 | 2 | 3 {
  if (total >= 11) return 3;
  if (total >= 6) return 2;
  return 1;
}

// Per-column bullet count (for 0–6 score: 3 bullets × 0/1/2)
// Scoring: 0 = missed, 1 = partial, 2 = hit standard.
// We collapse bullets to a column score by summing the three bullets in that column.
export function bulletsToColumnScore(bullets: Record<string, number>, col: ColumnKey): number {
  return BULLETS[col].reduce((sum, b) => sum + (bullets[b.key] ?? 0), 0);
}

export const LEVEL_COPY: Record<1 | 2 | 3, { headline: string; body: string; color: string }> = {
  1: {
    headline: 'Level 1 — Foundation',
    body: 'You showed up. Now go build the habit. Pick one column to lock in next class.',
    color: 'hsl(217 80% 60%)', // blue
  },
  2: {
    headline: 'Level 2 — Standard',
    body: 'You delivered the standard. The first-timer felt seen. Keep stacking the habits.',
    color: 'hsl(142 71% 45%)', // green
  },
  3: {
    headline: 'Level 3 — Studio Best',
    body: 'This is what we run on. The first-timer just met the coach who changes their year.',
    color: 'hsl(20 90% 47%)',  // OTF orange
  },
};
