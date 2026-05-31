/**
 * PipelineSalesTab — flat, searchable list of every sale (intros_run SALE +
 * sales_outside_intro). Built so that finding and deleting a wrong sale
 * takes one search and one click. Reuses the existing DeleteSaleDialog
 * for both record types.
 */
import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Trash2, Loader2 } from 'lucide-react';
import { isMembershipSale } from '@/lib/sales-detection';
import { parseLocalDate } from '@/lib/utils';
import DeleteSaleDialog from '@/components/admin/DeleteSaleDialog';
import { useJourneyCard } from '@/components/person/useJourneyCard';

interface SaleRow {
  id: string;
  member_name: string;
  buy_date: string | null;
  membership_type: string;
  commission: number;
  source: 'intro_run' | 'outside_intro';
  lead_source: string | null;
  coach_name: string | null;
  intro_owner: string | null;
  via_2nd_intro: boolean;
}

interface Props {
  onAfterDelete: () => void;
}

export function PipelineSalesTab({ onAfterDelete }: Props) {
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [toDelete, setToDelete] = useState<SaleRow | null>(null);

  const load = async () => {
    setLoading(true);
    const [introsRes, outsideRes, bookingsRes] = await Promise.all([
      supabase
        .from('intros_run')
        .select('id, member_name, result, result_canon, buy_date, run_date, commission_amount, coach_name, intro_owner, ran_by, lead_source, linked_intro_booked_id')
        .order('buy_date', { ascending: false, nullsFirst: false }),
      supabase
        .from('sales_outside_intro')
        .select('id, member_name, date_closed, created_at, membership_type, commission_amount, lead_source, intro_owner')
        .order('date_closed', { ascending: false, nullsFirst: false }),
      supabase
        .from('intros_booked')
        .select('id, originating_booking_id')
        .not('originating_booking_id', 'is', null),
    ]);

    const secondIntroBookingIds = new Set(
      (bookingsRes.data || []).map((b: any) => b.id)
    );

    const introSales: SaleRow[] = (introsRes.data || [])
      .filter((r: any) => isMembershipSale(r.result || '') || ['SALE','PREMIER','PREMIER_OTBEAT','ELITE','BASIC'].includes((r.result_canon || '').toUpperCase()))
      .map((r: any) => ({
        id: r.id,
        member_name: r.member_name,
        buy_date: r.buy_date || r.run_date || null,
        membership_type: r.result || r.result_canon || '—',
        commission: Number(r.commission_amount) || 0,
        source: 'intro_run' as const,
        lead_source: r.lead_source,
        coach_name: r.coach_name,
        intro_owner: r.intro_owner || r.ran_by,
        via_2nd_intro: r.linked_intro_booked_id ? secondIntroBookingIds.has(r.linked_intro_booked_id) : false,
      }));

    const outsideSales: SaleRow[] = (outsideRes.data || []).map((r: any) => ({
      id: r.id,
      member_name: r.member_name,
      buy_date: r.date_closed || (r.created_at ? r.created_at.split('T')[0] : null),
      membership_type: r.membership_type || '—',
      commission: Number(r.commission_amount) || 0,
      source: 'outside_intro' as const,
      lead_source: r.lead_source,
      coach_name: null,
      intro_owner: r.intro_owner,
      via_2nd_intro: false,
    }));

    const merged = [...introSales, ...outsideSales].sort((a, b) =>
      (b.buy_date || '').localeCompare(a.buy_date || '')
    );
    setRows(merged);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    rows.forEach(r => { if (r.buy_date) months.add(r.buy_date.slice(0, 7)); });
    return Array.from(months).sort().reverse();
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(r => {
      if (monthFilter !== 'all' && (r.buy_date || '').slice(0, 7) !== monthFilter) return false;
      if (!term) return true;
      return (
        r.member_name.toLowerCase().includes(term) ||
        (r.membership_type || '').toLowerCase().includes(term) ||
        (r.coach_name || '').toLowerCase().includes(term) ||
        (r.intro_owner || '').toLowerCase().includes(term)
      );
    });
  }, [rows, search, monthFilter]);

  const totalCommission = useMemo(
    () => filtered.reduce((sum, r) => sum + r.commission, 0),
    [filtered]
  );

  return (
    <div className="space-y-3">
      {/* Search + month filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by member, tier, coach, or owner…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="h-9 px-2 rounded-md border border-input bg-background text-sm"
        >
          <option value="all">All months</option>
          {monthOptions.map(m => (
            <option key={m} value={m}>
              {format(parseLocalDate(`${m}-01`), 'MMM yyyy')}
            </option>
          ))}
        </select>
      </div>

      {/* Summary line */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span><strong className="text-foreground">{filtered.length}</strong> sales</span>
        <span>·</span>
        <span><strong className="text-foreground">${totalCommission.toFixed(2)}</strong> commission</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading sales…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No sales match your filters.
        </div>
      ) : (
        <div className="border border-border rounded-md divide-y divide-border">
          {filtered.map(r => (
            <div
              key={`${r.source}-${r.id}`}
              className="flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm truncate">{r.member_name}</span>
                  <Badge variant="outline" className="text-[10px] bg-success/15 text-success border-success/40">
                    {r.membership_type}
                  </Badge>
                  {r.via_2nd_intro && (
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/40">
                      via 2nd intro
                    </Badge>
                  )}
                  {r.source === 'outside_intro' && (
                    <Badge variant="outline" className="text-[10px]">outside intro</Badge>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {r.buy_date ? format(parseLocalDate(r.buy_date), 'MMM d, yyyy') : 'No date'}
                  {r.lead_source && <> · {r.lead_source}</>}
                  {r.coach_name && <> · Coach {r.coach_name}</>}
                  {r.intro_owner && <> · Owner {r.intro_owner}</>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold tabular-nums">${r.commission.toFixed(2)}</div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 min-h-[44px] min-w-[44px]"
                onClick={() => setToDelete(r)}
                aria-label={`Delete sale for ${r.member_name}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <DeleteSaleDialog
        open={!!toDelete}
        onOpenChange={(open) => { if (!open) setToDelete(null); }}
        purchase={toDelete ? {
          id: toDelete.id,
          member_name: toDelete.member_name,
          source: toDelete.source,
        } : null}
        onDeleted={() => {
          setToDelete(null);
          load();
          onAfterDelete();
        }}
      />
    </div>
  );
}
