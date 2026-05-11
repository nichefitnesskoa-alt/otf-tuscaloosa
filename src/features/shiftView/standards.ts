// Five-standard grouping for the Shift View. Maps task_name → standard key.
// Templates not matched here fall into the 'other' bucket so admin-added rows still render.

export type StandardKey = 's1' | 's2' | 's3' | 's4' | 's5' | 'other';

export interface Standard {
  key: StandardKey;
  title: string;
}

export const STANDARDS: Standard[] = [
  { key: 's1', title: 'Every intro feels expected, prepared for, and personally welcomed before they walk in.' },
  { key: 's2', title: 'Every lead interaction is real. Not a script sent. A conversation started.' },
  { key: 's3', title: 'Every follow-up moves someone forward. Not just touched. Moved.' },
  { key: 's4', title: 'Every member interaction counts.' },
  { key: 's5', title: 'Every piece of equipment is ready before the next person needs it.' },
  { key: 'other', title: 'Other shift duties' },
];

// Exact task_name → standard. Keep in sync with the migration seed.
export const TASK_STANDARD_MAP: Record<string, StandardKey> = {
  'Name on whiteboard before they arrive': 's1',
  'Booking confirmation and questionnaire sent': 's1',
  'Read their questionnaire before they walk in — know one thing about them': 's1',

  'Comment genuinely on a post from someone we follow today': 's2',
  'IG DMs sent this shift': 's2',
  'Lead texts sent this shift — new or cold': 's2',

  'Follow-up queue worked this shift': 's3',
  'At least one person got a real next step — a booking, a date, a real answer': 's3',

  'Create a connection with a member. Learn something new about them.': 's4',
  'Ask a member if they have a friend who wants a free class': 's4',

  'Milestones checked after every check-in wave — bag prepped before they finish class': 's5',
  'Rowers checked and charging if needed — nothing left for the next SA to discover': 's5',
};

// The "ask a member" template task is rendered as a custom referral row,
// not a generic checkbox. ShiftTaskList skips it; ReferralAskRow owns it.
export const REFERRAL_ASK_TASK_NAME = 'Ask a member if they have a friend who wants a free class';

export function standardForTask(taskName: string): StandardKey {
  return TASK_STANDARD_MAP[taskName] ?? 'other';
}
