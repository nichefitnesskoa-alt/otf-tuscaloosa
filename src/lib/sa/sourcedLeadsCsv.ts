/**
 * Pure CSV builder for the self-sourced leads explorer.
 *
 * `SourcedLeadCsvRow` is the union shape used by the dialog. It is now
 * derived from `useSaLeads.SaLeadPersonRow` so the dialog total always
 * matches the WIG tile total — same source, same counting rules.
 *
 * source_type:
 *   - 'lead'           → real leads row (id starts with `lead-`)
 *   - 'booking'        → intros_booked row with no separate lead (id `bk-`)
 *   - 'vip_registrant' → vip_registrations row, unbooked (id `vip-`)
 */
import { format } from 'date-fns';

export interface SourcedLeadCsvRow {
  /** Stable id — keep the source-prefixed form from useSaLeads so the UI
   *  can branch checkbox writes correctly. */
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  source: string | null;
  sourced_by_sa: string | null;
  booked_intro_id: string | null;
  text_archived_at: string | null;
  text_archived_reason?: string | null;
  created_at: string;
  stage?: string | null;
  mindbody_imported_at: string | null;
  mindbody_imported_by: string | null;
  source_type: 'lead' | 'booking' | 'vip_registrant';
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
  'sourced_by_sa', 'created_at_central', 'stage', 'source_type',
  'booked', 'booked_intro_id',
  'in_mindbody', 'mindbody_imported_at_central', 'mindbody_imported_by',
  'text_archived_at', 'text_archived_reason',
];

export function buildSourcedLeadsCsv(rows: SourcedLeadCsvRow[]): string {
  const lines = [HEADERS.join(',')];
  for (const r of rows) {
    const inMindbody = !!r.booked_intro_id || !!r.mindbody_imported_at;
    lines.push([
      r.first_name, r.last_name, r.phone, r.email ?? '', r.source ?? '',
      r.sourced_by_sa ?? '', ymdCentral(r.created_at), r.stage ?? '', r.source_type,
      r.booked_intro_id ? 'yes' : 'no',
      r.booked_intro_id ?? '',
      inMindbody ? 'yes' : 'no',
      r.mindbody_imported_at ? ymdCentral(r.mindbody_imported_at) : '',
      r.mindbody_imported_by ?? '',
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
