interface EntryRow {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  base_entries: number;
  bonus_entries: number;
  total_entries: number;
  action_instagram_follow: boolean;
  action_post_engagement: boolean;
  action_post_engagement_screenshot_url: string | null;
  action_story_share: boolean;
  action_story_share_screenshot_url: string | null;
  action_free_class: boolean;
  action_free_class_screenshot_url: string | null;
  action_partner_visit: boolean;
  action_partner_visit_photo_url: string | null;
  submitted_at: string;
}

const HEADERS = [
  'First Name','Last Name','Email','Phone','Base Entries','Bonus Entries','Total Entries',
  'Instagram Follow','Post Engagement','Post Engagement Screenshot',
  'Story Share','Story Share Screenshot',
  'Free Class','Free Class Screenshot',
  'Partner Visit','Partner Visit Photo',
  'Submitted At',
];

function esc(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadEntriesCsv(rows: EntryRow[], studioSlug: string) {
  const lines = [HEADERS.join(',')];
  for (const r of rows) {
    lines.push([
      r.first_name, r.last_name, r.email, r.phone,
      r.base_entries, r.bonus_entries, r.total_entries,
      r.action_instagram_follow, r.action_post_engagement, r.action_post_engagement_screenshot_url ?? '',
      r.action_story_share, r.action_story_share_screenshot_url ?? '',
      r.action_free_class, r.action_free_class_screenshot_url ?? '',
      r.action_partner_visit, r.action_partner_visit_photo_url ?? '',
      r.submitted_at,
    ].map(esc).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `giveaway-${studioSlug}-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
