/**
 * Pure CSV builder for the self-sourced leads explorer.
 * Mirrors the format style used by src/features/giveaway/lib/csvExport.ts.
 */
import { format } from 'date-fns';
import type { SourcedLeadRow } from '@/lib/sa/sourcedLeadsToText';

export interface SourcedLeadCsvRow extends SourcedLeadRow {
  stage?: string | null;
}

function esc(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** YYYY-MM-DD HH:mm in America/Chicago for an ISO timestamp. */
function ymdCentral(iso: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date(iso));
    const get = (t: string) => parts.find(p => p.type === t)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
  } catch {
    return iso;
  }
}

const HEADERS = [
  'first_name', 'last_name', 'phone', 'email', 'source',
  'sourced_by_sa', 'created_at_central', 'stage',
  'booked', 'booked_intro_id', 'text_archived_at', 'text_archived_reason',
];

export function buildSourcedLeadsCsv(rows: SourcedLeadCsvRow[]): string {
  const lines = [HEADERS.join(',')];
  for (const r of rows) {
    lines.push([
      r.first_name, r.last_name, r.phone, r.email ?? '', r.source ?? '',
      r.sourced_by_sa ?? '', ymdCentral(r.created_at), r.stage ?? '',
      r.booked_intro_id ? 'yes' : 'no',
      r.booked_intro_id ?? '',
      r.text_archived_at ? ymdCentral(r.text_archived_at) : '',
      r.text_archived_reason ?? '',
    ].map(esc).join(','));
  }
  return lines.join('\n');
}

export function downloadSourcedLeadsCsv(rows: SourcedLeadCsvRow[], label: string) {
  const csv = buildSourcedLeadsCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = format(new Date(), 'yyyy-MM-dd');
  const safe = label.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
  a.download = `sourced-leads-${safe}-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
