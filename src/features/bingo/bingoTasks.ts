/**
 * Summer Bingo task list — editable config.
 * 24 tasks + center FREE space = 25 squares.
 * The `id` is what's persisted in bingo_players.marked_squares,
 * so changing labels is safe but changing ids will orphan progress.
 */
export interface BingoTask {
  id: string;
  label: string;
}

export const FREE_SQUARE_ID = 'free';

export const BINGO_TASKS: BingoTask[] = [
  { id: 'steps-10k', label: 'Get 10,000 steps in one day' },
  { id: 'concert', label: 'Go to a concert' },
  { id: 'water-100oz', label: 'Drink 100oz of water in a day' },
  { id: 'orange-pic', label: 'Take a picture of something bright orange and tag us' },
  { id: 'workout-3x', label: 'Workout 3 days of the week' },
  { id: 'squats-50', label: 'Do 50 squats' },
  { id: 'run-for-time', label: 'Go on a run for time' },
  { id: 'podcast', label: 'Listen to a podcast' },
  { id: 'otf-traveling', label: 'Go to Orangetheory wherever you are' },
  { id: 'hit-pr', label: 'Hit a PR' },
  { id: 'new-recipe', label: 'Learn a new recipe' },
  { id: 'selfie-story', label: 'Post a workout selfie on your story and tag us' },
  { id: FREE_SQUARE_ID, label: 'FREE' },
  { id: 'stairs', label: 'Take the stairs rather than the elevator' },
  { id: 'swim', label: 'Go swimming' },
  { id: 'distance-run', label: 'Go on a distance run' },
  { id: 'sleep-8', label: 'Get 8 hours of sleep' },
  { id: 'stretch-15', label: 'Spend 15 minutes stretching' },
  { id: 'tiktok-follow', label: 'Follow OTFTTOWN on TikTok' },
  { id: 'row-500', label: 'Row 500 meters' },
  { id: 'pushups-20', label: 'Do 20 push-ups' },
  { id: 'ig-follow', label: 'Follow otftuscaloosa on Instagram' },
  { id: 'pickleball', label: 'Play pickleball' },
  { id: 'walk-outside', label: 'Go for a walk outside' },
  { id: 'run-5k', label: 'Run a 5k' },
];

// Tasks that count toward blackout (everything except FREE — FREE is auto).
export const REQUIRED_TASK_IDS = BINGO_TASKS
  .filter(t => t.id !== FREE_SQUARE_ID)
  .map(t => t.id);

export const TOTAL_REQUIRED = REQUIRED_TASK_IDS.length; // 24

export function normalizePhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function formatPhoneDisplay(raw: string | null | undefined): string {
  const d = normalizePhone(raw || '');
  if (d.length !== 10) return raw || '';
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

const CST_TZ = 'America/Chicago';
export function formatCstDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-US', {
      timeZone: CST_TZ,
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    }) + ' CST';
  } catch { return ''; }
}
