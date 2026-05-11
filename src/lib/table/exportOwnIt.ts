// Build the Own It weekly export text block. Pure function — no IO.
import type { TableOwner, OwnerEntry } from '@/hooks/useTheTable';
import { LANE_CATEGORIES } from './laneSuggestions';

const DOMAIN_ORDER: readonly string[] = LANE_CATEGORIES;
const UNCATEGORIZED = 'Uncategorized';

const ANSWER = (v: string | null | undefined) => {
  const s = (v ?? '').trim();
  return s.length ? s : 'No response';
};

// Format an ISO timestamp as "YYYY-MM-DD HH:mm CST" anchored to America/Chicago.
function fmtSubmittedCT(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')} CST`;
}

// Format the meeting Monday as "Mon DD YYYY" (e.g. "Nov 10 2025").
function fmtMondayCT(meetingDate: string): string {
  const d = new Date(meetingDate + 'T12:00:00');
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    month: 'short', day: '2-digit', year: 'numeric',
  }).format(d);
}

export function buildOwnItExport(args: {
  meetingDate: string;
  owners: TableOwner[];
  entries: OwnerEntry[];
}): string {
  const { meetingDate, owners, entries } = args;

  // Index entries by owner_id; only include submitted ones.
  const byOwner = new Map<string, OwnerEntry>();
  for (const e of entries) {
    if (e.submitted_at) byOwner.set(e.owner_id, e);
  }

  // Active, non-architect owners with a submitted entry.
  const submitted = owners
    .filter(o => !o.is_architect && byOwner.has(o.id))
    .map(o => ({ owner: o, entry: byOwner.get(o.id)! }));

  // Group by category.
  const groups = new Map<string, typeof submitted>();
  for (const row of submitted) {
    const cat = row.owner.category && DOMAIN_ORDER.includes(row.owner.category as any)
      ? row.owner.category
      : UNCATEGORIZED;
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(row);
  }

  const orderedDomains = [...DOMAIN_ORDER, UNCATEGORIZED].filter(d => groups.has(d));

  const out: string[] = [];
  out.push(`OWN IT — WEEK OF ${fmtMondayCT(meetingDate)}`);
  out.push('');

  if (submitted.length === 0) {
    out.push('No submissions yet.');
    return out.join('\n');
  }

  for (const domain of orderedDomains) {
    const rows = groups.get(domain)!.sort((a, b) =>
      a.owner.display_name.localeCompare(b.owner.display_name)
    );
    out.push(`════════ ${domain.toUpperCase()} ════════`);
    out.push('');
    for (const { owner, entry } of rows) {
      const lane = owner.lane_name?.trim() || 'No lane set';
      out.push(`── ${owner.display_name} — ${lane}`);
      out.push(`Submitted: ${fmtSubmittedCT(entry.submitted_at!)}`);
      out.push('');
      out.push('1. What happened in your lane last week?');
      out.push(ANSWER(entry.last_week_update));
      out.push('');
      out.push('2. What are you focused on this week?');
      out.push(ANSWER(entry.this_week_focus));
      out.push('');
      out.push('3. Any ideas on your mind?');
      out.push(ANSWER(entry.ideas));
      out.push('');
      out.push('4. What do you need from someone in this room?');
      out.push(ANSWER(entry.ask));
      out.push('');
    }
  }

  return out.join('\n').trimEnd() + '\n';
}

export function ownItExportFilename(meetingDate: string): string {
  return `own-it-week-of-${meetingDate}.txt`;
}
