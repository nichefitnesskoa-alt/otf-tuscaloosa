/**
 * CSV builder for the Unified Portal bulk import format.
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
import { stripCountryCode } from '@/lib/parsing/phone';

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

const HEADERS = ['First Name', 'Last Name', 'Phone', 'Email', 'Channel'];

export function buildSourcedLeadsCsv(rows: SourcedLeadCsvRow[]): string {
  const lines = [HEADERS.join(',')];
  for (const r of rows) {
    const phone = stripCountryCode(r.phone) ?? '';
    lines.push([
      r.first_name,
      r.last_name,
      phone,
      r.email ?? '',
      'Grassroots',
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
  a.download = `unified-portal-import-${safe}-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
