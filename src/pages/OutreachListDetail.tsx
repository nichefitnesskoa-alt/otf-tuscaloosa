/**
 * Outreach List detail — dense spreadsheet-style table so the team can see
 * many people at once. Search by name/phone/item, sort by any column,
 * mark Texted / In Person / Not Interested, log Save/Upgrade/Refer, or
 * delete a row (admin). Churning members flagged inline (red row + ⚠).
 */
import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertTriangle, ArrowLeft, ArrowUp, ArrowDown, ArrowUpDown, Check, Filter, Plus, Sparkles, ShieldAlert, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { isAdmin as isAdminCheck } from '@/lib/auth/roles';
import { useOutreachListDetail, OutreachRow, OutreachAction } from '@/features/outreach/useOutreach';
import { LogSomlDialog } from '@/features/soml/LogSomlDialog';
import { cn } from '@/lib/utils';

type ColKey = 'name' | 'item' | 'amount' | 'phone' | 'last_30d' | 'latest' | 'churns' | 'texted' | 'in_person' | 'not_interested';
type SortState = { key: ColKey; dir: 'asc' | 'desc' } | null;
type ColType = 'text' | 'number' | 'date' | 'bool';
type BoolFilter = 'any' | 'yes' | 'no';
type FilterState = Partial<Record<ColKey, string>>; // for text/number/date it's the text; for bool it's 'yes'/'no' (absent = any)

const COL_TYPES: Record<ColKey, ColType> = {
  name: 'text', item: 'text', amount: 'number', phone: 'text',
  last_30d: 'number', latest: 'date', churns: 'bool',
  texted: 'bool', in_person: 'bool', not_interested: 'bool',
};

/** Parse a numeric filter like ">10", "<= 5", "=3", or "3" → predicate. */
function makeNumberPredicate(raw: string): ((n: number | null | undefined) => boolean) | null {
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(/^(>=|<=|>|<|=)?\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const op = m[1] || '=';
  const val = Number(m[2]);
  return (n) => {
    if (n == null || isNaN(Number(n))) return false;
    const x = Number(n);
    switch (op) {
      case '>': return x > val;
      case '<': return x < val;
      case '>=': return x >= val;
      case '<=': return x <= val;
      default: return x === val;
    }
  };
}


function fmtWhen(iso: string) {
  try { return format(new Date(iso), 'M/d h:mma').toLowerCase(); } catch { return iso; }
}
function fmtDay(d: string | null) {
  if (!d) return '—';
  const [y, m, day] = d.split('-').map(Number);
  return format(new Date(y, m - 1, day), 'MMM d');
}
function fmtAmount(n: number | null) {
  if (n == null || isNaN(Number(n))) return '—';
  return `$${Number(n).toFixed(2)}`;
}

function CheckPill({
  active, attribution, onClick, label, tone = 'primary',
}: {
  active: boolean;
  attribution?: OutreachAction;
  onClick: () => void;
  label: string;
  tone?: 'primary' | 'destructive';
}) {
  return (
    <button
      onClick={onClick}
      title={attribution ? `${label} · ${attribution.done_by} · ${fmtWhen(attribution.done_at)}` : `Mark as ${label}`}
      className={cn(
        'inline-flex items-center justify-center h-6 w-6 rounded border transition-colors cursor-pointer',
        active && tone === 'primary' && 'bg-primary/20 border-primary text-primary',
        active && tone === 'destructive' && 'bg-destructive/20 border-destructive text-destructive',
        !active && 'border-border hover:border-primary/60 hover:bg-accent',
      )}
    >
      {active ? <Check className="w-3.5 h-3.5" /> : <span className="text-[10px] opacity-40">—</span>}
    </button>
  );
}

function SaveAttemptDialog({
  open, onClose, row,
}: { open: boolean; onClose: () => void; row: OutreachRow | null }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!row || !user?.name) return;
    setSaving(true);
    const { error } = await (supabase as any).from('outreach_row_actions').insert({
      row_id: row.id, list_id: row.list_id, action_type: 'save_attempt',
      done_by: user.name, notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Save attempt logged');
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Log save attempt · {row?.client_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Textarea placeholder="What did you say? Any commitment or objection?"
            rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
          <p className="text-[11px] text-muted-foreground">Logged as <b>{user?.name || '—'}</b>.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Log'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function OutreachListDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isAdmin = isAdminCheck(user);
  const { list, rows, actions, loading } = useOutreachListDetail(id);
  const [somlDialog, setSomlDialog] = useState<{ kind: 'upgrade' | 'referral'; name: string } | null>(null);
  const [saveDialog, setSaveDialog] = useState<OutreachRow | null>(null);
  const [rowToDelete, setRowToDelete] = useState<OutreachRow | null>(null);
  const [deletingRow, setDeletingRow] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>(null);
  const [filters, setFilters] = useState<FilterState>({});

  const setFilter = (col: ColKey, val: string | undefined) => {
    setFilters(f => {
      const next = { ...f };
      if (!val) delete next[col]; else next[col] = val;
      return next;
    });
  };
  const cycleSort = (col: ColKey) => {
    setSort(s => {
      if (!s || s.key !== col) return { key: col, dir: 'asc' };
      if (s.dir === 'asc') return { key: col, dir: 'desc' };
      return null;
    });
  };
  const clearAll = () => { setFilters({}); setSort(null); setSearch(''); };

  const rowBoolValue = (r: OutreachRow, col: ColKey): boolean => {
    if (col === 'churns') return !!r.is_churning;
    const rowActions = actions.filter(a => a.row_id === r.id);
    if (col === 'texted') return rowActions.some(a => a.action_type === 'texted');
    if (col === 'in_person') return rowActions.some(a => a.action_type === 'in_person');
    if (col === 'not_interested') return rowActions.some(a => a.action_type === 'not_interested');
    return false;
  };

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = q
      ? rows.filter(r =>
          r.client_name.toLowerCase().includes(q) ||
          (r.phone || '').toLowerCase().includes(q) ||
          (r.item || '').toLowerCase().includes(q) ||
          (r.email || '').toLowerCase().includes(q))
      : [...rows];

    // Per-column filters
    for (const [k, raw] of Object.entries(filters) as [ColKey, string][]) {
      if (!raw) continue;
      const type = COL_TYPES[k];
      if (type === 'bool') {
        const want = raw === 'yes';
        out = out.filter(r => rowBoolValue(r, k) === want);
      } else if (type === 'number') {
        const pred = makeNumberPredicate(raw);
        if (pred) {
          out = out.filter(r => pred(k === 'amount' ? (r.amount as any) : r.last_30d_count));
        } else {
          const s = raw.toLowerCase();
          out = out.filter(r => String(k === 'amount' ? (r.amount ?? '') : (r.last_30d_count ?? '')).toLowerCase().includes(s));
        }
      } else {
        const s = raw.toLowerCase();
        out = out.filter(r => {
          const v = k === 'name' ? r.client_name
            : k === 'item' ? (r.item || '')
            : k === 'phone' ? (r.phone || '')
            : k === 'latest' ? (r.latest_workout_date || '')
            : '';
          return v.toLowerCase().includes(s);
        });
      }
    }

    // Sort
    if (sort) {
      const dir = sort.dir === 'asc' ? 1 : -1;
      const cmp = (a: OutreachRow, b: OutreachRow) => {
        switch (sort.key) {
          case 'name': return a.client_name.localeCompare(b.client_name) * dir;
          case 'item': return (a.item || '').localeCompare(b.item || '') * dir;
          case 'phone': return (a.phone || '').localeCompare(b.phone || '') * dir;
          case 'amount': return ((Number(a.amount) || 0) - (Number(b.amount) || 0)) * dir;
          case 'last_30d': return ((a.last_30d_count ?? -1) - (b.last_30d_count ?? -1)) * dir;
          case 'latest': return (a.latest_workout_date || '').localeCompare(b.latest_workout_date || '') * dir;
          case 'churns': {
            if (a.is_churning !== b.is_churning) return (a.is_churning ? -1 : 1) * dir;
            return ((a.churn_date || '9999').localeCompare(b.churn_date || '9999')) * dir;
          }
          case 'texted':
          case 'in_person':
          case 'not_interested': {
            const av = rowBoolValue(a, sort.key) ? 1 : 0;
            const bv = rowBoolValue(b, sort.key) ? 1 : 0;
            return (bv - av) * dir;
          }
        }
      };
      out.sort(cmp);
    } else {
      // Default: churning first, then A→Z
      out.sort((a, b) => {
        if (a.is_churning !== b.is_churning) return a.is_churning ? -1 : 1;
        if (a.is_churning && b.is_churning) return (a.churn_date || '9999').localeCompare(b.churn_date || '9999');
        return a.client_name.localeCompare(b.client_name);
      });
    }
    return out;
  }, [rows, actions, search, sort, filters]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;


  const churnCount = rows.filter(r => r.is_churning).length;

  const toggle = async (row: OutreachRow, kind: 'texted' | 'in_person' | 'not_interested', existing?: OutreachAction) => {
    if (!user?.name) { toast.error('Login required'); return; }
    if (existing) {
      const { error } = await (supabase as any).from('outreach_row_actions').delete().eq('id', existing.id);
      if (error) toast.error(error.message);
    } else {
      const { error } = await (supabase as any).from('outreach_row_actions').insert({
        row_id: row.id, list_id: row.list_id, action_type: kind, done_by: user.name,
      });
      if (error) toast.error(error.message);
    }
  };

  const confirmDeleteRow = async () => {
    if (!rowToDelete) return;
    setDeletingRow(true);
    try {
      await (supabase as any).from('outreach_row_actions').delete().eq('row_id', rowToDelete.id);
      const { error } = await (supabase as any).from('outreach_list_rows').delete().eq('id', rowToDelete.id);
      if (error) throw error;
      toast.success(`Removed ${rowToDelete.client_name}`);
      setRowToDelete(null);
    } catch (e: any) {
      toast.error(`Delete failed: ${e.message}`);
    } finally {
      setDeletingRow(false);
    }
  };

  return (
    <div className="p-4 max-w-[1400px] mx-auto pb-24">
      <div className="mb-3">
        <Button asChild variant="ghost" size="sm" className="h-8 -ml-2">
          <Link to="/outreach-lists"><ArrowLeft className="w-4 h-4 mr-1" /> All lists</Link>
        </Button>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!loading && !list && <div className="text-sm text-muted-foreground">List not found.</div>}

      {list && (
        <>
          <div className="mb-3 flex items-baseline justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {list.campaign_tag}
              </div>
              <h1 className="text-xl font-black uppercase tracking-wide truncate">{list.name}</h1>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-muted-foreground">
                {filteredSorted.length}{filteredSorted.length !== rows.length ? ` / ${rows.length}` : ''} people
              </span>
              {churnCount > 0 && (
                <span className="inline-flex items-center gap-1 text-destructive font-semibold">
                  <ShieldAlert className="w-3.5 h-3.5" /> {churnCount} churning
                </span>
              )}
            </div>
          </div>

          {/* Search + clear-filters toolbar */}
          <div className="mb-3 flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, phone, item…"
                className="h-8 pl-7 pr-7 text-xs"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {(activeFilterCount > 0 || sort || search) && (
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={clearAll}>
                <X className="w-3.5 h-3.5 mr-1" /> Clear filters & sort
                {activeFilterCount > 0 && <span className="ml-1 text-muted-foreground">({activeFilterCount})</span>}
              </Button>
            )}
            <span className="text-[10px] text-muted-foreground">Click a column header to sort. Use the filter icon to filter that column.</span>
          </div>

          {/* Desktop / tablet: spreadsheet table */}
          <div className="hidden md:block rounded border border-border overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground sticky top-0 z-10">
                <tr>
                  <th className="text-left px-2 py-2 w-8"></th>
                  <ColHeader col="name" label="Name" align="left" className="min-w-[160px]" sort={sort} filters={filters} onSort={cycleSort} onFilter={setFilter} />
                  <ColHeader col="item" label="Item" align="left" className="min-w-[200px]" sort={sort} filters={filters} onSort={cycleSort} onFilter={setFilter} />
                  <ColHeader col="amount" label="Amount" align="right" className="w-[90px]" sort={sort} filters={filters} onSort={cycleSort} onFilter={setFilter} />
                  <ColHeader col="phone" label="Phone" align="left" className="w-[130px]" sort={sort} filters={filters} onSort={cycleSort} onFilter={setFilter} />
                  <ColHeader col="last_30d" label="30d" align="right" className="w-[80px]" sort={sort} filters={filters} onSort={cycleSort} onFilter={setFilter} />
                  <ColHeader col="latest" label="Latest" align="left" className="w-[90px]" sort={sort} filters={filters} onSort={cycleSort} onFilter={setFilter} />
                  <ColHeader col="churns" label="Churns" align="left" className="w-[100px]" sort={sort} filters={filters} onSort={cycleSort} onFilter={setFilter} />
                  <ColHeader col="texted" label="Text" align="center" className="w-[65px]" sort={sort} filters={filters} onSort={cycleSort} onFilter={setFilter} />
                  <ColHeader col="in_person" label="In-Per" align="center" className="w-[70px]" sort={sort} filters={filters} onSort={cycleSort} onFilter={setFilter} />
                  <ColHeader col="not_interested" label="Not Int" align="center" className="w-[70px]" sort={sort} filters={filters} onSort={cycleSort} onFilter={setFilter} />
                  <th className="text-right px-2 py-2 w-[240px]">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredSorted.map((r, idx) => {
                  const rowActions = actions.filter(a => a.row_id === r.id);
                  const texted = rowActions.find(a => a.action_type === 'texted');
                  const inPerson = rowActions.find(a => a.action_type === 'in_person');
                  const notInterested = rowActions.find(a => a.action_type === 'not_interested');
                  const saveAttempts = rowActions.filter(a => a.action_type === 'save_attempt');
                  return (
                    <tr key={r.id}
                      className={cn(
                        'border-t border-border h-10',
                        notInterested
                          ? 'bg-muted/40 opacity-60'
                          : r.is_churning
                            ? 'bg-destructive/10 hover:bg-destructive/15 border-l-2 border-l-destructive'
                            : idx % 2 === 0 ? 'bg-background hover:bg-accent/40' : 'bg-muted/20 hover:bg-accent/40',
                      )}
                    >
                      <td className="px-2 py-1 align-middle">
                        {r.is_churning && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                      </td>
                      <td className="px-2 py-1 align-middle font-semibold whitespace-nowrap">
                        {r.client_name}
                        {saveAttempts.length > 0 && (
                          <span className="ml-1 text-[9px] text-muted-foreground">({saveAttempts.length} save{saveAttempts.length !== 1 ? 's' : ''})</span>
                        )}
                      </td>
                      <td className="px-2 py-1 align-middle text-muted-foreground truncate max-w-[280px]" title={r.item || ''}>
                        {r.item || '—'}
                      </td>
                      <td className="px-2 py-1 align-middle text-right font-mono tabular-nums">
                        {fmtAmount(r.amount)}
                      </td>
                      <td className="px-2 py-1 align-middle text-muted-foreground whitespace-nowrap">
                        {r.phone || '—'}
                      </td>
                      <td className="px-2 py-1 align-middle text-right tabular-nums">
                        {r.last_30d_count ?? '—'}
                      </td>
                      <td className="px-2 py-1 align-middle text-muted-foreground whitespace-nowrap">
                        {fmtDay(r.latest_workout_date)}
                      </td>
                      <td className={cn(
                        'px-2 py-1 align-middle whitespace-nowrap',
                        r.is_churning ? 'text-destructive font-semibold' : 'text-muted-foreground',
                      )}>
                        {r.is_churning ? fmtDay(r.churn_date) : '—'}
                      </td>
                      <td className="px-2 py-1 align-middle text-center">
                        <CheckPill label="Texted" active={!!texted} attribution={texted}
                          onClick={() => toggle(r, 'texted', texted)} />
                      </td>
                      <td className="px-2 py-1 align-middle text-center">
                        <CheckPill label="In Person" active={!!inPerson} attribution={inPerson}
                          onClick={() => toggle(r, 'in_person', inPerson)} />
                      </td>
                      <td className="px-2 py-1 align-middle text-center">
                        <CheckPill label="Not Interested" active={!!notInterested} attribution={notInterested}
                          tone="destructive"
                          onClick={() => toggle(r, 'not_interested', notInterested)} />
                      </td>
                      <td className="px-2 py-1 align-middle text-right whitespace-nowrap">
                        {r.is_churning && (
                          <Button size="sm" variant="destructive" className="h-6 px-2 text-[10px] mr-1"
                            onClick={() => setSaveDialog(r)}>
                            Save
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
                          onClick={() => setSomlDialog({ kind: 'upgrade', name: r.client_name })}>
                          <Plus className="w-3 h-3 mr-0.5" /> Upgrade
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
                          onClick={() => setSomlDialog({ kind: 'referral', name: r.client_name })}>
                          <Sparkles className="w-3 h-3 mr-0.5" /> Refer
                        </Button>
                        {isAdmin && (
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            title="Remove from list"
                            onClick={() => setRowToDelete(r)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredSorted.length === 0 && (
                  <tr><td colSpan={12} className="text-center py-6 text-muted-foreground">
                    {rows.length === 0 ? 'No people in this list.' : 'No matches for your search.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: compact cards */}
          <div className="md:hidden space-y-2">
            {filteredSorted.map(r => {
              const rowActions = actions.filter(a => a.row_id === r.id);
              const texted = rowActions.find(a => a.action_type === 'texted');
              const inPerson = rowActions.find(a => a.action_type === 'in_person');
              const notInterested = rowActions.find(a => a.action_type === 'not_interested');
              return (
                <div key={r.id} className={cn(
                  'rounded border p-2',
                  notInterested ? 'bg-muted/40 border-border opacity-60'
                    : r.is_churning ? 'bg-destructive/10 border-destructive/40'
                    : 'bg-card border-border',
                )}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {r.is_churning && <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />}
                        <span className="font-semibold truncate">{r.client_name}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {r.item || '—'} · <span className="font-mono">{fmtAmount(r.amount)}</span>
                      </div>
                      {r.is_churning && (
                        <div className="text-[10px] text-destructive font-semibold">
                          Churns {fmtDay(r.churn_date)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <CheckPill label="Texted" active={!!texted} attribution={texted}
                        onClick={() => toggle(r, 'texted', texted)} />
                      <CheckPill label="In Person" active={!!inPerson} attribution={inPerson}
                        onClick={() => toggle(r, 'in_person', inPerson)} />
                      <CheckPill label="Not Interested" active={!!notInterested} attribution={notInterested}
                        tone="destructive"
                        onClick={() => toggle(r, 'not_interested', notInterested)} />
                    </div>
                  </div>
                  <div className="flex gap-1 mt-2 justify-end flex-wrap">
                    {r.is_churning && (
                      <Button size="sm" variant="destructive" className="h-7 text-[10px]" onClick={() => setSaveDialog(r)}>
                        Save
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 text-[10px]"
                      onClick={() => setSomlDialog({ kind: 'upgrade', name: r.client_name })}>
                      Upgrade
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[10px]"
                      onClick={() => setSomlDialog({ kind: 'referral', name: r.client_name })}>
                      Refer
                    </Button>
                    {isAdmin && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground"
                        onClick={() => setRowToDelete(r)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredSorted.length === 0 && (
              <div className="text-center py-6 text-sm text-muted-foreground">
                {rows.length === 0 ? 'No people in this list.' : 'No matches for your search.'}
              </div>
            )}
          </div>
        </>
      )}

      <LogSomlDialog
        open={!!somlDialog}
        onClose={() => setSomlDialog(null)}
        kind={somlDialog?.kind || 'upgrade'}
        defaultMemberName={somlDialog?.name}
      />
      <SaveAttemptDialog
        open={!!saveDialog}
        onClose={() => setSaveDialog(null)}
        row={saveDialog}
      />

      <AlertDialog open={!!rowToDelete} onOpenChange={o => !o && setRowToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {rowToDelete?.client_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes this person from the list and clears their Texted / In Person / Not Interested / Save Attempt history for this list. Upgrades and referrals already logged are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingRow}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRow} disabled={deletingRow}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingRow ? 'Removing…' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
