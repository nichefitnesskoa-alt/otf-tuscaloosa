/**
 * Outreach List detail — dense spreadsheet-style table so the team can see
 * many people at once. Search by name/phone/item, sort by any column,
 * multi-select filter per column (Excel-style), mark Texted / In Person /
 * Not Interested, log Save/Upgrade/Refer, or delete a row (admin).
 * Churning members flagged inline (red row + ⚠).
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { formatOutreachName, outreachNameKey } from '@/lib/outreachNames';

type ColKey = string; // built-ins ('name','texted', etc.) or 'meta:<header>'
type SortState = { key: ColKey; dir: 'asc' | 'desc' } | null;
type ColType = 'text' | 'number' | 'date' | 'bool';
type BoolFilter = 'yes' | 'no';
// For non-bool: array of selected raw string values (empty/absent = no filter).
// For bool: 'yes' | 'no' (absent = any).
type FilterState = Record<string, string[] | BoolFilter | undefined>;
type FilterOption = { value: string; label: string };

const BUILTIN_COL_TYPES: Record<string, ColType> = {
  name: 'text', item: 'text', amount: 'number', phone: 'text',
  last_30d: 'number', latest: 'date', churns: 'bool',
  texted: 'bool', in_person: 'bool', not_interested: 'bool',
};

/** Detect column type. Meta columns get numeric/bool auto-detection from sample values. */
function colType(col: ColKey, sample?: (r: OutreachRow) => any): ColType {
  const bi = BUILTIN_COL_TYPES[col];
  if (bi) return bi;
  return 'text';
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

function fmtMetaValue(v: any): string {
  if (v == null || v === '') return '';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

/** Raw value + display label for a row's cell in a given (non-bool) column. */
function rowColStringValue(r: OutreachRow, col: ColKey): { value: string; label: string } {
  if (col.startsWith('meta:')) {
    const k = col.slice(5);
    const md = (r as any).metadata as Record<string, any> | null;
    const v = md ? md[k] : undefined;
    const label = fmtMetaValue(v);
    return { value: label, label: label || '(blank)' };
  }
  switch (col) {
    case 'name': return { value: r.client_name, label: formatOutreachName(r.client_name) };
    case 'item': return { value: r.item || '', label: r.item || '(blank)' };
    case 'phone': return { value: r.phone || '', label: r.phone || '(blank)' };
    case 'amount': {
      const raw = r.amount == null ? '' : String(r.amount);
      return { value: raw, label: r.amount == null ? '(blank)' : fmtAmount(r.amount) };
    }
    case 'last_30d': {
      const raw = r.last_30d_count == null ? '' : String(r.last_30d_count);
      return { value: raw, label: r.last_30d_count == null ? '(blank)' : String(r.last_30d_count) };
    }
    case 'latest': {
      const raw = r.latest_workout_date || '';
      return { value: raw, label: r.latest_workout_date ? fmtDay(r.latest_workout_date) : '(blank)' };
    }
    default: return { value: '', label: '' };
  }
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
          <DialogTitle>Log save attempt · {formatOutreachName(row?.client_name)}</DialogTitle>
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

function ColHeader({
  col, label, align, className, sort, filters, options, onSort, onFilter,
}: {
  col: ColKey;
  label: string;
  align: 'left' | 'right' | 'center';
  className?: string;
  sort: SortState;
  filters: FilterState;
  options: FilterOption[]; // ignored for bool
  onSort: (c: ColKey) => void;
  onFilter: (c: ColKey, v: string[] | BoolFilter | undefined) => void;
}) {
  const type = colType(col);
  const active = sort?.key === col;
  const current = filters[col];
  const boolVal = type === 'bool' ? (current as BoolFilter | undefined) : undefined;
  const selected = type === 'bool' ? [] : ((current as string[] | undefined) || []);
  const hasFilter = type === 'bool' ? !!boolVal : selected.length > 0;
  const [q, setQ] = useState('');

  const shownOptions = useMemo(() => {
    if (type === 'bool') return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(o => o.label.toLowerCase().includes(needle) || o.value.toLowerCase().includes(needle));
  }, [options, q, type]);

  const toggleValue = (v: string) => {
    const next = selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v];
    onFilter(col, next.length ? next : undefined);
  };
  const selectAllShown = () => {
    const merged = Array.from(new Set([...selected, ...shownOptions.map(o => o.value)]));
    onFilter(col, merged.length ? merged : undefined);
  };
  const clearAllShown = () => {
    const shownSet = new Set(shownOptions.map(o => o.value));
    const next = selected.filter(v => !shownSet.has(v));
    onFilter(col, next.length ? next : undefined);
  };

  return (
    <th className={cn(
      'px-1 py-2 select-none',
      align === 'left' && 'text-left',
      align === 'right' && 'text-right',
      align === 'center' && 'text-center',
      className,
    )}>
      <div className={cn(
        'flex items-center gap-0.5',
        align === 'right' && 'justify-end',
        align === 'center' && 'justify-center',
      )}>
        <button
          onClick={() => onSort(col)}
          className={cn(
            'inline-flex items-center gap-1 px-1 py-0.5 rounded hover:bg-accent hover:text-foreground cursor-pointer',
            active && 'text-foreground font-bold',
          )}
          title={active ? `Sorted ${sort!.dir}. Click to cycle.` : 'Click to sort'}
        >
          <span>{label}</span>
          {active
            ? (sort!.dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
            : <ArrowUpDown className="w-3 h-3 opacity-30" />}
        </button>
        <Popover onOpenChange={o => { if (o) setQ(''); }}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                'inline-flex items-center justify-center h-5 w-5 rounded hover:bg-accent cursor-pointer',
                hasFilter ? 'text-primary' : 'text-muted-foreground/50 hover:text-foreground',
              )}
              title={hasFilter
                ? (type === 'bool' ? `Filter: ${boolVal}` : `Filter: ${selected.length} selected`)
                : 'Filter this column'}
            >
              <Filter className="w-3 h-3" fill={hasFilter ? 'currentColor' : 'none'} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2 space-y-2" align="start">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Filter {label}</div>
              {hasFilter && (
                <button
                  onClick={() => onFilter(col, undefined)}
                  className="text-[10px] text-muted-foreground hover:text-foreground underline"
                >
                  Reset
                </button>
              )}
            </div>

            {type === 'bool' ? (
              <div className="flex gap-1">
                {([
                  { v: undefined as BoolFilter | undefined, label: 'Any' },
                  { v: 'yes' as BoolFilter, label: 'Yes' },
                  { v: 'no' as BoolFilter, label: 'No' },
                ]).map(opt => {
                  const isActive = (opt.v === undefined ? !boolVal : boolVal === opt.v);
                  return (
                    <button
                      key={opt.label}
                      onClick={() => onFilter(col, opt.v)}
                      className={cn(
                        'flex-1 h-7 rounded border text-xs cursor-pointer',
                        isActive ? 'bg-primary/20 border-primary text-primary font-bold' : 'border-border hover:bg-accent',
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                {options.length > 8 && (
                  <Input
                    autoFocus
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    placeholder="Search values…"
                    className="h-7 text-xs"
                  />
                )}
                <div className="flex gap-2 text-[10px]">
                  <button onClick={selectAllShown} className="text-primary hover:underline">Select all{q ? ' shown' : ''}</button>
                  <span className="text-muted-foreground">·</span>
                  <button onClick={clearAllShown} className="text-muted-foreground hover:text-foreground hover:underline">Clear{q ? ' shown' : ''}</button>
                  <span className="ml-auto text-muted-foreground">{selected.length}/{options.length}</span>
                </div>
                <div className="max-h-56 overflow-y-auto border border-border rounded bg-background">
                  {shownOptions.length === 0 && (
                    <div className="px-2 py-3 text-[11px] text-center text-muted-foreground">No values</div>
                  )}
                  {shownOptions.map(opt => {
                    const checked = selected.includes(opt.value);
                    return (
                      <label
                        key={opt.value || '(blank)'}
                        className={cn(
                          'flex items-center gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-accent',
                          checked && 'bg-primary/10',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleValue(opt.value)}
                          className="accent-primary cursor-pointer"
                        />
                        <span className="truncate flex-1" title={opt.label}>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </th>
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

  // Map: normalized referring-member name → count of referrals they've logged
  // (manual + pending auto). Used to badge rows on this outreach list so an
  // SA can see at a glance that Ethan already referred someone.
  const [referralsByReferrer, setReferralsByReferrer] = useState<Map<string, number>>(new Map());
  const [referralsBump, setReferralsBump] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const norm = (s: string | null | undefined) => outreachNameKey(s);
    (async () => {
      const [manualRes, pendingRes] = await Promise.all([
        (supabase as any).from('soml_manual_referrals').select('referring_member_name'),
        (supabase as any).from('soml_pending_referrals').select('referring_member'),
      ]);
      if (cancelled) return;
      const map = new Map<string, number>();
      const bump = (name: string | null | undefined) => {
        const k = norm(name);
        if (!k) return;
        map.set(k, (map.get(k) || 0) + 1);
      };
      ((manualRes.data as any[]) || []).forEach(r => bump(r.referring_member_name));
      ((pendingRes.data as any[]) || []).forEach(r => bump(r.referring_member));
      setReferralsByReferrer(map);
    })();
    return () => { cancelled = true; };
  }, [referralsBump]);
  const referralCountFor = (name: string): number => {
    return referralsByReferrer.get(outreachNameKey(name)) || 0;
  };


  const setFilter = (col: ColKey, val: string[] | BoolFilter | undefined) => {
    setFilters(f => {
      const next = { ...f };
      if (val === undefined || (Array.isArray(val) && val.length === 0)) delete next[col];
      else next[col] = val;
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

  // Dynamic extra columns from row metadata (any un-mapped columns from the
  // uploaded Excel file are preserved on `metadata` — surface them here so
  // nothing from the source spreadsheet is hidden).
  const metaKeys = useMemo(() => {
    const seen = new Set<string>();
    for (const r of rows) {
      const md = (r as any).metadata as Record<string, any> | null;
      if (!md) continue;
      for (const k of Object.keys(md)) {
        const v = md[k];
        if (v == null || v === '') continue;
        seen.add(k);
      }
    }
    return Array.from(seen);
  }, [rows]);

  // Built-in columns (item, amount, phone, last_30d, latest) only appear if
  // at least one row in the list actually has a value. Older lists imported
  // before we made columns fully dynamic keep their pricing / product info
  // this way; newer imports where everything lives in metadata simply hide
  // these columns.
  const builtinKeys = useMemo(() => {
    const has = { item: false, amount: false, phone: false, last_30d: false, latest: false };
    for (const r of rows) {
      if (!has.item && r.item) has.item = true;
      if (!has.amount && r.amount != null) has.amount = true;
      if (!has.phone && r.phone) has.phone = true;
      if (!has.last_30d && r.last_30d_count != null) has.last_30d = true;
      if (!has.latest && r.latest_workout_date) has.latest = true;
    }
    const order: ColKey[] = ['item', 'amount', 'phone', 'last_30d', 'latest'];
    return order.filter(k => (has as any)[k]);
  }, [rows]);

  // Distinct filter options per non-bool column, computed from all rows.
  const filterOptions = useMemo(() => {
    const cols: ColKey[] = ['name', 'item', 'amount', 'phone', 'last_30d', 'latest', ...metaKeys.map(k => `meta:${k}`)];
    const map: Record<string, FilterOption[]> = {};
    for (const col of cols) {
      const seen = new Map<string, string>(); // value -> label
      for (const r of rows) {
        const { value, label } = rowColStringValue(r, col);
        if (!seen.has(value)) seen.set(value, label);
      }
      const arr: FilterOption[] = Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
      // Sort: numeric cols numerically; date cols by date desc; text alphabetical; blanks last.
      arr.sort((a, b) => {
        if (a.value === '' && b.value !== '') return 1;
        if (b.value === '' && a.value !== '') return -1;
        if (col === 'amount' || col === 'last_30d') {
          return Number(a.value) - Number(b.value);
        }
        if (col === 'latest') {
          return b.value.localeCompare(a.value); // most recent first
        }
        return a.label.localeCompare(b.label);
      });
      map[col] = arr;
    }
    return map;
  }, [rows, metaKeys]);


  const fmtMeta = (v: any): string => {
    if (v == null || v === '') return '—';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    return String(v);
  };

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = q
      ? rows.filter(r => {
          if (r.client_name.toLowerCase().includes(q)) return true;
          if (formatOutreachName(r.client_name).toLowerCase().includes(q)) return true;
          if ((r.phone || '').toLowerCase().includes(q)) return true;
          if ((r.item || '').toLowerCase().includes(q)) return true;
          if ((r.email || '').toLowerCase().includes(q)) return true;
          const md = (r as any).metadata as Record<string, any> | null;
          if (md) {
            for (const k of Object.keys(md)) {
              if (String(md[k] ?? '').toLowerCase().includes(q)) return true;
            }
          }
          return false;
        })
      : [...rows];

    // Per-column filters
    for (const [k, raw] of Object.entries(filters) as [ColKey, string[] | BoolFilter][]) {
      const type = colType(k);
      if (type === 'bool') {
        const want = raw === 'yes';
        out = out.filter(r => rowBoolValue(r, k) === want);
      } else {
        const set = new Set(raw as string[]);
        if (set.size === 0) continue;
        out = out.filter(r => set.has(rowColStringValue(r, k).value));
      }
    }

    // Sort
    if (sort) {
      const dir = sort.dir === 'asc' ? 1 : -1;
      const cmp = (a: OutreachRow, b: OutreachRow) => {
        const k = sort.key;
        if (k.startsWith('meta:')) {
          const av = rowColStringValue(a, k).value;
          const bv = rowColStringValue(b, k).value;
          const an = Number(av), bn = Number(bv);
          if (av !== '' && bv !== '' && !isNaN(an) && !isNaN(bn)) return (an - bn) * dir;
          if (av === '' && bv !== '') return 1;
          if (bv === '' && av !== '') return -1;
          return av.localeCompare(bv) * dir;
        }
        switch (k) {
          case 'name': return formatOutreachName(a.client_name).localeCompare(formatOutreachName(b.client_name)) * dir;
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
            const av = rowBoolValue(a, k) ? 1 : 0;
            const bv = rowBoolValue(b, k) ? 1 : 0;
            return (bv - av) * dir;
          }
        }
        return 0;
      };
      out.sort(cmp);
    } else {
      // Default: churning first, then A→Z
      out.sort((a, b) => {
        if (a.is_churning !== b.is_churning) return a.is_churning ? -1 : 1;
        if (a.is_churning && b.is_churning) return (a.churn_date || '9999').localeCompare(b.churn_date || '9999');
        return formatOutreachName(a.client_name).localeCompare(formatOutreachName(b.client_name));
      });
    }
    return out;
  }, [rows, actions, search, sort, filters]);

  const activeFilterCount = Object.keys(filters).length;


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
      toast.success(`Removed ${formatOutreachName(rowToDelete.client_name)}`);
      setRowToDelete(null);
    } catch (e: any) {
      toast.error(`Delete failed: ${e.message}`);
    } finally {
      setDeletingRow(false);
    }
  };

  const emptyOpts: FilterOption[] = [];

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
            <span className="text-[10px] text-muted-foreground">Click a column header to sort. Click the filter icon to pick values.</span>
          </div>

          {/* Desktop / tablet: spreadsheet table */}
          <div className="hidden md:block rounded border border-border overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground sticky top-0 z-10">
                <tr>
                  <th className="text-left px-2 py-2 w-8"></th>
                  <ColHeader col="name" label="Name" align="left" className="min-w-[160px]" sort={sort} filters={filters} options={filterOptions.name || emptyOpts} onSort={cycleSort} onFilter={setFilter} />
                  <ColHeader col="texted" label="Text" align="center" className="w-[65px]" sort={sort} filters={filters} options={emptyOpts} onSort={cycleSort} onFilter={setFilter} />
                  <ColHeader col="in_person" label="In-Per" align="center" className="w-[70px]" sort={sort} filters={filters} options={emptyOpts} onSort={cycleSort} onFilter={setFilter} />
                  <ColHeader col="not_interested" label="Not Int" align="center" className="w-[70px]" sort={sort} filters={filters} options={emptyOpts} onSort={cycleSort} onFilter={setFilter} />
                  {metaKeys.map(k => (
                    <ColHeader
                      key={`h-${k}`}
                      col={`meta:${k}`}
                      label={k}
                      align="left"
                      className="min-w-[120px] whitespace-nowrap"
                      sort={sort}
                      filters={filters}
                      options={filterOptions[`meta:${k}`] || emptyOpts}
                      onSort={cycleSort}
                      onFilter={setFilter}
                    />
                  ))}
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
                        {formatOutreachName(r.client_name)}
                        {saveAttempts.length > 0 && (
                          <span className="ml-1 text-[9px] text-muted-foreground">({saveAttempts.length} save{saveAttempts.length !== 1 ? 's' : ''})</span>
                        )}
                        {referralCountFor(r.client_name) > 0 && (
                          <span className="ml-1.5 inline-flex items-center rounded bg-primary/15 text-primary text-[9px] font-semibold px-1.5 py-0.5 align-middle" title="This member has referred someone in SOML">
                            <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                            Referred {referralCountFor(r.client_name)}
                          </span>
                        )}
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
                      {metaKeys.map(k => {
                        const md = (r as any).metadata as Record<string, any> | null;
                        const v = md ? md[k] : undefined;
                        const label = fmtMeta(v);
                        return (
                          <td key={`c-${r.id}-${k}`} className="px-2 py-1 align-middle text-muted-foreground truncate max-w-[220px]" title={label}>
                            {label}
                          </td>
                        );
                      })}
                      <td className="px-2 py-1 align-middle text-right whitespace-nowrap">
                        {r.is_churning && (
                          <Button size="sm" variant="destructive" className="h-6 px-2 text-[10px] mr-1"
                            onClick={() => setSaveDialog(r)}>
                            Save
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
                          onClick={() => setSomlDialog({ kind: 'upgrade', name: formatOutreachName(r.client_name) })}>
                          <Plus className="w-3 h-3 mr-0.5" /> Upgrade
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
                          onClick={() => setSomlDialog({ kind: 'referral', name: formatOutreachName(r.client_name) })}>
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
                  <tr><td colSpan={6 + metaKeys.length} className="text-center py-6 text-muted-foreground">
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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {r.is_churning && <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />}
                        <span className="font-semibold truncate">{formatOutreachName(r.client_name)}</span>
                        {referralCountFor(r.client_name) > 0 && (
                          <span className="inline-flex items-center rounded bg-primary/15 text-primary text-[9px] font-semibold px-1.5 py-0.5">
                            <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                            Referred {referralCountFor(r.client_name)}
                          </span>
                        )}
                      </div>

                      {metaKeys.length > 0 && (
                        <div className="text-[11px] text-muted-foreground space-y-0.5 mt-1">
                          {metaKeys.map(k => {
                            const md = (r as any).metadata as Record<string, any> | null;
                            const v = md ? md[k] : undefined;
                            if (v == null || v === '') return null;
                            return (
                              <div key={`m-${r.id}-${k}`} className="truncate">
                                <span className="uppercase tracking-wide text-[9px] font-semibold text-muted-foreground/70 mr-1">{k}:</span>
                                {fmtMeta(v)}
                              </div>
                            );
                          })}
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
                      onClick={() => setSomlDialog({ kind: 'upgrade', name: formatOutreachName(r.client_name) })}>
                      Upgrade
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[10px]"
                      onClick={() => setSomlDialog({ kind: 'referral', name: formatOutreachName(r.client_name) })}>
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
        onSaved={() => setReferralsBump(n => n + 1)}
      />

      <SaveAttemptDialog
        open={!!saveDialog}
        onClose={() => setSaveDialog(null)}
        row={saveDialog}
      />

      <AlertDialog open={!!rowToDelete} onOpenChange={o => !o && setRowToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {formatOutreachName(rowToDelete?.client_name)}?</AlertDialogTitle>
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
