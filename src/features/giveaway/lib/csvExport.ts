import { GiveawayPartner } from '../hooks/useGiveawayPartners';

interface PartnerActionRow {
  partner_id: string;
  completed: boolean;
  screenshot_url: string | null;
}

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
  partner_actions: PartnerActionRow[] | null;
  submitted_at: string;
}

function esc(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function slugifyPartner(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function downloadEntriesCsv(rows: EntryRow[], studioSlug: string, partners: GiveawayPartner[]) {
  const partnerHeaders: string[] = [];
  for (const p of partners) {
    const s = slugifyPartner(p.partner_name);
    partnerHeaders.push(`partner_${s}_completed`, `partner_${s}_screenshot_url`);
  }
  const HEADERS = [
    'first_name','last_name','email','phone','total_entries','submitted_at',
    'action_instagram_follow','action_post_engagement','action_story_share','action_free_class',
    ...partnerHeaders,
  ];

  const lines = [HEADERS.join(',')];
  for (const r of rows) {
    const pa = r.partner_actions || [];
    const map = new Map(pa.map(a => [a.partner_id, a]));
    const partnerCols: (string | boolean)[] = [];
    for (const p of partners) {
      const a = map.get(p.id);
      partnerCols.push(!!a?.completed, a?.screenshot_url ?? '');
    }
    lines.push([
      r.first_name, r.last_name, r.email, r.phone, r.total_entries, r.submitted_at,
      r.action_instagram_follow, r.action_post_engagement, r.action_story_share, r.action_free_class,
      ...partnerCols,
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
