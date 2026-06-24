/**
 * Canonical fetcher for "who got checked off as imported to Mindbody".
 * Reads BOTH surfaces that write the flag:
 *   - leads.mindbody_imported_at  (sourced leads checked off in SourcedLeadsDialog / WIG)
 *   - vip_registrations.mindbody_imported_at  (VIP roster check-offs)
 * Single source of truth for the Admin → Mindbody Imports report so the two
 * tables stay coherent.
 */
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

export interface MindbodyImportRow {
  kind: 'lead' | 'vip';
  /** Underlying row id (leads.id or vip_registrations.id) */
  id: string;
  /** Person id used by PersonJourneyCard — leads.id for 'lead', null for 'vip' */
  leadId: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  importedBy: string;
  importedAt: string;          // ISO UTC
  sourceLabel: string;         // "Lead — Instagram" / "VIP — Bama Dining"
  vipSessionId?: string | null;
  vipGroup?: string | null;
}

export async function fetchMindbodyImports(
  startISO: string,
  endISO: string,
): Promise<MindbodyImportRow[]> {
  const [leadsRes, vipRes] = await Promise.all([
    sb
      .from('leads')
      .select('id, first_name, last_name, phone, email, source, mindbody_imported_at, mindbody_imported_by')
      .gte('mindbody_imported_at', startISO)
      .lt('mindbody_imported_at', endISO)
      .order('mindbody_imported_at', { ascending: true }),
    sb
      .from('vip_registrations')
      .select('id, first_name, last_name, phone, vip_class_name, vip_session_id, mindbody_imported_at, mindbody_imported_by')
      .gte('mindbody_imported_at', startISO)
      .lt('mindbody_imported_at', endISO)
      .order('mindbody_imported_at', { ascending: true }),
  ]);

  const rows: MindbodyImportRow[] = [];

  for (const l of (leadsRes.data || []) as any[]) {
    const name = `${l.first_name || ''} ${l.last_name || ''}`.trim() || '(unnamed)';
    rows.push({
      kind: 'lead',
      id: l.id,
      leadId: l.id,
      name,
      phone: l.phone || null,
      importedBy: l.mindbody_imported_by || '(unknown)',
      importedAt: l.mindbody_imported_at,
      sourceLabel: l.source ? `Lead — ${l.source}` : 'Lead',
    });
  }

  for (const r of (vipRes.data || []) as any[]) {
    const name = `${r.first_name || ''} ${r.last_name || ''}`.trim() || '(unnamed)';
    rows.push({
      kind: 'vip',
      id: r.id,
      leadId: null,
      name,
      phone: r.phone || null,
      importedBy: r.mindbody_imported_by || '(unknown)',
      importedAt: r.mindbody_imported_at,
      sourceLabel: r.vip_class_name ? `VIP — ${r.vip_class_name}` : 'VIP',
      vipSessionId: r.vip_session_id || null,
      vipGroup: r.vip_class_name || null,
    });
  }

  rows.sort((a, b) => a.importedAt.localeCompare(b.importedAt));
  return rows;
}

export function groupBySa(rows: MindbodyImportRow[]): Array<{ sa: string; rows: MindbodyImportRow[] }> {
  const map = new Map<string, MindbodyImportRow[]>();
  for (const r of rows) {
    if (!map.has(r.importedBy)) map.set(r.importedBy, []);
    map.get(r.importedBy)!.push(r);
  }
  return Array.from(map.entries())
    .map(([sa, rows]) => ({ sa, rows }))
    .sort((a, b) => b.rows.length - a.rows.length || a.sa.localeCompare(b.sa));
}

export function toCsv(rows: MindbodyImportRow[]): string {
  const header = ['Date (CT)', 'Time (CT)', 'Name', 'Phone', 'Imported By', 'Source'];
  const esc = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;
  const lines = [header.map(esc).join(',')];
  const fmtDate = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' });
  const fmtTime = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', hour12: true });
  for (const r of rows) {
    const d = new Date(r.importedAt);
    lines.push([
      fmtDate.format(d),
      fmtTime.format(d),
      r.name,
      r.phone || '',
      r.importedBy,
      r.sourceLabel,
    ].map(esc).join(','));
  }
  return lines.join('\n');
}
