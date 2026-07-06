/**
 * Summer of More Life data hook.
 *
 * Reads soml_config (window + goals) and computes 3 metrics:
 *  - Referrals: realized pending-referral rows in the SOML window, credited to
 *    the original pending row's credited_sa, PLUS manual entries from
 *    soml_manual_referrals (deduped by member_name against realized auto rows).
 *  - Upgrades: soml_upgrades rows in window, grouped by upgraded_by.
 *  - Sales: intros_run where isSaleCanon and getRunSaleDate ∈ window,
 *    credited to intros_booked.intro_owner (matches existing WIG sales attribution).
 *
 * Reuses canonical helpers only — no new date/sale logic.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SALE_CANONS, getRunSaleDate } from '@/lib/sales-detection';
import { DATA_CHANGED_EVENT } from '@/lib/data/invalidation';

export interface SomlConfig {
  start_date: string;
  end_date: string;
  referrals_goal: number;
  upgrades_goal: number;
  sales_goal: number;
  referral_leads_goal: number;
}

export interface SomlSaRow {
  sa: string;
  referrals: number;
  upgrades: number;
  sales: number;
  pending: number;
  referralLeads: number;
}

export interface PendingReferralRow {
  id: string;
  booking_id: string;
  referring_member: string;
  credited_sa: string;
  state: 'pending' | 'realized' | 'not_converted';
  resolved_outcome: string | null;
  realized_at: string | null;
  created_at: string;
  member_name?: string | null;
  class_date?: string | null;
}

export interface SomlDetailItem {
  sa: string;
  member_name: string;
  date: string | null; // ISO date
  source: 'auto' | 'manual' | 'legacy';
}

export interface SomlData {
  config: SomlConfig | null;
  totals: { referrals: number; upgrades: number; sales: number; pending: number; referralLeads: number };
  rows: SomlSaRow[];
  pendingReferrals: PendingReferralRow[];
  realizedReferrals: SomlDetailItem[];
  upgradesList: SomlDetailItem[];
  salesList: SomlDetailItem[];
  referralLeadsList: SomlDetailItem[];
  loading: boolean;
  refetch: () => Promise<void>;
}

const MEMBER_REFERRAL_SOURCES = ['Member Referral', 'Member Referral (5 class pack)'];

function norm(s: string | null | undefined): string {
  return (s || '').trim().toLowerCase();
}

export function useSomlData(): SomlData {
  const [config, setConfig] = useState<SomlConfig | null>(null);
  const [rows, setRows] = useState<SomlSaRow[]>([]);
  const [totals, setTotals] = useState({ referrals: 0, upgrades: 0, sales: 0, pending: 0 });
  const [pendingReferrals, setPendingReferrals] = useState<PendingReferralRow[]>([]);
  const [realizedReferrals, setRealizedReferrals] = useState<SomlDetailItem[]>([]);
  const [upgradesList, setUpgradesList] = useState<SomlDetailItem[]>([]);
  const [salesList, setSalesList] = useState<SomlDetailItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);

    // 1. Config
    const { data: cfgRow } = await supabase
      .from('soml_config' as any)
      .select('start_date, end_date, referrals_goal, upgrades_goal, sales_goal')
      .eq('id', 1)
      .maybeSingle();
    const cfg = (cfgRow as unknown as SomlConfig | null) || null;
    setConfig(cfg);
    if (!cfg) {
      setRows([]); setPendingReferrals([]);
      setRealizedReferrals([]); setUpgradesList([]); setSalesList([]);
      setTotals({ referrals: 0, upgrades: 0, sales: 0, pending: 0 });
      setLoading(false); return;
    }

    const start = cfg.start_date;
    const end = cfg.end_date;

    // 2. Pending/referral ledger.
    const { data: pendingRows } = await (supabase as any)
      .from('soml_pending_referrals')
      .select('id, booking_id, referring_member, credited_sa, state, resolved_outcome, realized_at, created_at')
      .order('created_at', { ascending: false });
    const pendingBookingIds = ((pendingRows as any[]) || []).map(p => p.booking_id);
    let pendingBookingMap = new Map<string, any>();
    if (pendingBookingIds.length) {
      const { data: pb } = await supabase
        .from('intros_booked')
        .select('id, member_name, class_date')
        .in('id', pendingBookingIds);
      pendingBookingMap = new Map(((pb as any[]) || []).map(b => [b.id, b]));
    }
    const enrichedPending: PendingReferralRow[] = ((pendingRows as any[]) || []).map(p => ({
      ...p,
      member_name: pendingBookingMap.get(p.booking_id)?.member_name || null,
      class_date: pendingBookingMap.get(p.booking_id)?.class_date || null,
    }));

    const realizedItems: SomlDetailItem[] = enrichedPending
      .filter(p => p.state === 'realized' && !!p.realized_at && p.realized_at >= start && p.realized_at <= end)
      .map(p => ({ sa: p.credited_sa, member_name: p.member_name || '', date: p.realized_at, source: 'auto' }));

    // Legacy fallback — realized referral sales not in the pending ledger.
    const ledgerReferralMemberSet = new Set(realizedItems.map(r => norm(r.member_name)));
    const { data: refBookings } = await supabase
      .from('intros_booked')
      .select('id, member_name, booked_by, intro_owner, lead_source')
      .in('lead_source', MEMBER_REFERRAL_SOURCES)
      .is('deleted_at', null);
    const refBookingIds = (refBookings || []).map((b: any) => b.id);
    if (refBookingIds.length) {
      const saleCanonsX = Array.from(SALE_CANONS);
      const { data: runs } = await supabase
        .from('intros_run')
        .select('id, result_canon, buy_date, run_date, created_at, linked_intro_booked_id, ignore_from_metrics')
        .in('linked_intro_booked_id', refBookingIds)
        .in('result_canon', saleCanonsX);
      const bookingMap = new Map<string, any>((refBookings || []).map((b: any) => [b.id, b]));
      for (const r of (runs || [])) {
        if ((r as any).ignore_from_metrics) continue;
        const saleDate = getRunSaleDate(r as any);
        if (!saleDate || saleDate < start || saleDate > end) continue;
        const bk = bookingMap.get((r as any).linked_intro_booked_id);
        if (!bk || ledgerReferralMemberSet.has(norm(bk.member_name))) continue;
        const credit = (bk.booked_by && bk.booked_by !== 'Self booked' && bk.booked_by !== 'Self-booked')
          ? bk.booked_by
          : bk.intro_owner;
        if (!credit) continue;
        realizedItems.push({ sa: credit, member_name: bk.member_name || '', date: saleDate, source: 'legacy' });
      }
    }
    const autoReferralMemberSet = new Set(realizedItems.map(r => norm(r.member_name)));

    // 3. Manual referrals — dedup against auto by member_name
    const { data: manualRefs } = await supabase
      .from('soml_manual_referrals' as any)
      .select('member_name, referred_by, referred_at')
      .gte('referred_at', `${start}T00:00:00-06:00`)
      .lte('referred_at', `${end}T23:59:59-05:00`);
    const manualReferralItems: SomlDetailItem[] = ((manualRefs as any[]) || [])
      .filter(m => !autoReferralMemberSet.has(norm(m.member_name)))
      .map(m => ({
        sa: m.referred_by as string,
        member_name: m.member_name as string,
        date: (m.referred_at as string)?.slice(0, 10) || null,
        source: 'manual' as const,
      }));

    const allReferralItems: SomlDetailItem[] = [...realizedItems, ...manualReferralItems];

    // 4. Upgrades
    const { data: upgrades } = await supabase
      .from('soml_upgrades' as any)
      .select('member_name, upgraded_by, upgraded_at')
      .gte('upgraded_at', `${start}T00:00:00-06:00`)
      .lte('upgraded_at', `${end}T23:59:59-05:00`);
    const upgradeItems: SomlDetailItem[] = ((upgrades as any[]) || []).map(u => ({
      sa: u.upgraded_by as string,
      member_name: u.member_name as string,
      date: (u.upgraded_at as string)?.slice(0, 10) || null,
      source: 'manual' as const,
    }));

    // 5. Sales — all qualifying sales in window (attributed to intro_owner)
    const saleCanons = Array.from(SALE_CANONS);
    const { data: allSaleRuns } = await supabase
      .from('intros_run')
      .select('id, member_name, result_canon, buy_date, run_date, created_at, linked_intro_booked_id, ignore_from_metrics')
      .in('result_canon', saleCanons);
    const saleBookingIds = Array.from(new Set(((allSaleRuns as any[]) || [])
      .map(r => r.linked_intro_booked_id).filter(Boolean)));
    let salesBookingMap = new Map<string, any>();
    if (saleBookingIds.length) {
      const { data: bks } = await supabase
        .from('intros_booked')
        .select('id, member_name, intro_owner, booked_by')
        .in('id', saleBookingIds);
      salesBookingMap = new Map(((bks as any[]) || []).map(b => [b.id, b]));
    }
    const salesItems: SomlDetailItem[] = [];
    for (const r of ((allSaleRuns as any[]) || [])) {
      if (r.ignore_from_metrics) continue;
      const d = getRunSaleDate(r);
      if (!d || d < start || d > end) continue;
      const bk = r.linked_intro_booked_id ? salesBookingMap.get(r.linked_intro_booked_id) : null;
      const credit = bk?.intro_owner || bk?.booked_by;
      if (!credit) continue;
      salesItems.push({
        sa: credit,
        member_name: bk?.member_name || r.member_name || '',
        date: d,
        source: 'auto',
      });
    }

    // 6. Aggregate per-SA
    const byName = new Map<string, SomlSaRow>();
    const bump = (sa: string, key: 'referrals' | 'upgrades' | 'sales' | 'pending') => {
      const cur = byName.get(sa) || { sa, referrals: 0, upgrades: 0, sales: 0, pending: 0 };
      cur[key] += 1;
      byName.set(sa, cur);
    };
    allReferralItems.forEach(r => bump(r.sa, 'referrals'));
    upgradeItems.forEach(r => bump(r.sa, 'upgrades'));
    salesItems.forEach(r => bump(r.sa, 'sales'));

    // 7. Pending display-only
    enrichedPending.filter(p => p.state === 'pending').forEach(p => bump(p.credited_sa, 'pending'));

    const rowsOut = Array.from(byName.values())
      .sort((a, b) =>
        (b.referrals + b.upgrades + b.sales) - (a.referrals + a.upgrades + a.sales)
        || a.sa.localeCompare(b.sa)
      );
    const t = rowsOut.reduce(
      (acc, r) => ({
        referrals: acc.referrals + r.referrals,
        upgrades: acc.upgrades + r.upgrades,
        sales: acc.sales + r.sales,
        pending: acc.pending + r.pending,
      }),
      { referrals: 0, upgrades: 0, sales: 0, pending: 0 },
    );

    setRows(rowsOut);
    setPendingReferrals(enrichedPending);
    setRealizedReferrals(allReferralItems);
    setUpgradesList(upgradeItems);
    setSalesList(salesItems);
    setTotals(t);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const handler = () => { fetchAll(); };
    window.addEventListener(DATA_CHANGED_EVENT, handler);
    window.addEventListener('soml-data-changed', handler);
    return () => {
      window.removeEventListener(DATA_CHANGED_EVENT, handler);
      window.removeEventListener('soml-data-changed', handler);
    };
  }, [fetchAll]);

  return {
    config, totals, rows, pendingReferrals,
    realizedReferrals, upgradesList, salesList,
    loading, refetch: fetchAll,
  };
}

export function notifySomlChanged() {
  window.dispatchEvent(new CustomEvent('soml-data-changed'));
}
