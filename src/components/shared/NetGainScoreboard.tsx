/**
 * Net Gain scoreboard — one manually-adjusted number visible at the top of
 * My Day, Studio, and WIG. Everything is admin-editable (Koa only) and every
 * change writes to net_gain_log for audit.
 *
 * Automation:
 * - On mount, calls apply_pending_net_gain_churns() so any churn scheduled
 *   for yesterday or earlier auto-subtracts.
 * - New sales (intros_run flipping to a sale canon, or sales_outside_intro
 *   inserts) auto-add +1 via Postgres triggers.
 *
 * All scoreboards on all pages sync via the otf:netGainChanged event bus.
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Minus, Plus, Pencil, TrendingUp, TrendingDown, History, Upload, List, Trash2, Loader2, CalendarClock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useEffectiveAdmin } from '@/hooks/useViewAsAdmin';
import { format, endOfMonth, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';

const EVT = 'otf:netGainChanged';
function notifyChanged() { window.dispatchEvent(new Event(EVT)); }

interface State { value: number; updated_at: string; updated_by: string | null }
interface Churn {
  id: string;
  member_name: string;
  churn_date: string;
  notes: string | null;
  applied_at: string | null;
  created_by: string;
  created_at: string;
}

function todayCST(): string {
  // YYYY-MM-DD in America/Chicago
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(now);
}

function endOfThisMonthCST(): string {
  const [y, m] = todayCST().split('-').map(Number);
  return format(endOfMonth(new Date(y, m - 1, 1)), 'yyyy-MM-dd');
}

export function NetGainScoreboard({ className }: { className?: string }) {
  const { user } = useAuth();
  const isAdmin = useEffectiveAdmin();
  const [state, setState] = useState<State | null>(null);
  const [pendingChurns, setPendingChurns] = useState<Churn[]>([]);
  const [appliedChurns, setAppliedChurns] = useState<Churn[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const appliedRef = useRef(false);

  const load = useCallback(async () => {
    const [{ data: s }, { data: pending }, { data: applied }] = await Promise.all([
      (supabase as any).from('net_gain_state').select('value,updated_at,updated_by').eq('id', 1).maybeSingle(),
      (supabase as any).from('net_gain_churns')
        .select('id,member_name,churn_date,notes,applied_at,created_by,created_at')
        .is('applied_at', null)
        .lte('churn_date', endOfThisMonthCST())
        .order('churn_date', { ascending: true }),
      (supabase as any).from('net_gain_churns')
        .select('id,member_name,churn_date,notes,applied_at,created_by,created_at')
        .not('applied_at', 'is', null)
        .order('churn_date', { ascending: false })
        .limit(100),
    ]);
    if (s) setState(s as State);
    setPendingChurns((pending as Churn[]) || []);
    setAppliedChurns((applied as Churn[]) || []);
  }, []);

  // Auto-apply pending churns once per page-load, then hook the event bus.
  useEffect(() => {
    (async () => {
      if (!appliedRef.current) {
        appliedRef.current = true;
        try {
          const { data } = await (supabase as any).rpc('apply_pending_net_gain_churns');
          if (data && (data as any).applied > 0) notifyChanged();
        } catch { /* silent — read still works */ }
      }
      await load();
    })();
    const h = () => load();
    window.addEventListener(EVT, h);
    return () => window.removeEventListener(EVT, h);
  }, [load]);

  const writeDelta = async (delta: number, note: string) => {
    if (!user?.name) { toast.error('Login required'); return; }
    setBusy(true);
    const { error } = await (supabase as any).rpc('net_gain_write_delta', {
      p_delta: delta,
      p_source_type: 'manual',
      p_source_id: null,
      p_note: note,
      p_changed_by: user.name,
    });
    setBusy(false);
    if (error) { toast.error('Save failed'); return; }
    notifyChanged();
  };

  const applyDelta = (delta: number) => writeDelta(delta, delta > 0 ? 'Manual +1' : 'Manual -1');
  const setAbsolute = async (v: number, note: string) => {
    if (!state) return;
    const delta = v - state.value;
    if (delta === 0) return;
    await writeDelta(delta, note || 'Set to exact value');
  };

  const value = state?.value ?? 0;
  const positive = value > 0;
  const negative = value < 0;

  // End-of-month goal: pending terminations still have to be offset by new sales.
  const scheduledTerminationsLeft = pendingChurns.length;
  const goalToBreakEven = Math.max(0, scheduledTerminationsLeft - value);
  const eomLabel = format(parseISO(endOfThisMonthCST()), 'MMM d');

  // Next churn at-a-glance
  const nextChurnDate = pendingChurns[0]?.churn_date ?? null;
  const nextChurnCount = nextChurnDate
    ? pendingChurns.filter(c => c.churn_date === nextChurnDate).length
    : 0;
  const nextChurnLabel = nextChurnDate ? format(parseISO(nextChurnDate), 'EEE, MMM d') : '';

  return (
    <>
      <Card
        className={cn(
          'relative overflow-hidden border-2 shadow-sm',
          positive && 'border-emerald-600/70 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white',
          negative && 'border-red-600/70 bg-gradient-to-br from-red-600 to-red-700 text-white',
          !positive && !negative && 'border-border bg-card text-foreground',
          className,
        )}
      >
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          {/* Left: label + trend icon */}
          <div className="flex items-center gap-2 shrink-0">
            {positive && <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={2.5} />}
            {negative && <TrendingDown className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={2.5} />}
            <div className="flex flex-col">
              <span className={cn(
                'text-[11px] sm:text-xs uppercase tracking-widest font-black',
                (positive || negative) ? 'text-white/80' : 'text-muted-foreground',
              )}>
                Net Gain
              </span>
              <span className={cn(
                'text-[10px] font-medium',
                (positive || negative) ? 'text-white/60' : 'text-muted-foreground/70',
              )}>
                Members this month
              </span>
            </div>
          </div>

          {/* Center: huge number */}
          <div className="flex-1 flex items-baseline justify-center gap-2 min-w-0">
            <span
              className={cn(
                'text-6xl sm:text-7xl font-black tabular-nums leading-none tracking-tight',
                positive && 'text-white',
                negative && 'text-white',
                !positive && !negative && 'text-foreground',
              )}
            >
              {value > 0 ? '+' : ''}{value}
            </span>
          </div>

          {/* Right: admin controls */}
          {isAdmin && (
            <div className="flex items-center gap-1 shrink-0 self-center">
              <Button
                size="sm" variant={positive || negative ? 'secondary' : 'outline'}
                className="h-10 w-10 p-0" aria-label="Decrease by 1"
                disabled={busy || !state} onClick={() => applyDelta(-1)}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Button
                size="sm" variant={positive || negative ? 'secondary' : 'outline'}
                className="h-10 w-10 p-0" aria-label="Increase by 1"
                disabled={busy || !state} onClick={() => applyDelta(1)}
              >
                <Plus className="w-4 h-4" />
              </Button>
              <Button
                size="sm" variant={positive || negative ? 'secondary' : 'ghost'}
                className={cn('h-10 w-10 p-0', !(positive||negative) && 'hover:bg-secondary')}
                aria-label="Edit exact value" onClick={() => setEditOpen(true)}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                size="sm" variant={positive || negative ? 'secondary' : 'ghost'}
                className={cn('h-10 w-10 p-0', !(positive||negative) && 'hover:bg-secondary')}
                aria-label="Upload churn spreadsheet" onClick={() => setUploadOpen(true)}
              >
                <Upload className="w-4 h-4" />
              </Button>
              <Button
                size="sm" variant={positive || negative ? 'secondary' : 'ghost'}
                className={cn('h-10 w-10 p-0', !(positive||negative) && 'hover:bg-secondary')}
                aria-label="Manage churns" onClick={() => setManageOpen(true)}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>


        {/* Bottom strip: end-of-month goal line */}
        {(scheduledTerminationsLeft > 0 || goalToBreakEven > 0 || negative) && (
          <div className={cn(
            'px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold border-t flex flex-wrap items-center gap-x-3 gap-y-1',
            positive && 'border-white/20 bg-black/10 text-white/90',
            negative && 'border-white/20 bg-black/10 text-white/90',
            !positive && !negative && 'border-border bg-muted/30 text-muted-foreground',
          )}>
            {nextChurnDate && (
              <button
                type="button"
                onClick={() => setUpcomingOpen(true)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2 py-1 -my-1 border cursor-pointer transition-colors',
                  (positive || negative)
                    ? 'border-white/30 bg-white/10 hover:bg-white/20 text-white'
                    : 'border-border bg-background hover:bg-muted text-foreground',
                )}
                aria-label="View upcoming churns"
              >
                <CalendarClock className="w-3.5 h-3.5" />
                <span>
                  Next churn: <span className="font-black">{nextChurnLabel}</span>
                  {' · '}
                  <span className="tabular-nums font-black">{nextChurnCount}</span> member{nextChurnCount === 1 ? '' : 's'}
                </span>
                <span className="opacity-70 underline underline-offset-2 ml-1">View all</span>
              </button>
            )}
            {scheduledTerminationsLeft > 0 && (
              <span>
                <span className="tabular-nums font-black">{scheduledTerminationsLeft}</span> scheduled termination{scheduledTerminationsLeft === 1 ? '' : 's'} left this month.
              </span>
            )}
            {goalToBreakEven > 0 ? (
              <span>
                Need <span className="tabular-nums font-black">+{goalToBreakEven}</span> membership sale{goalToBreakEven === 1 ? '' : 's'} by {eomLabel} to finish positive.
              </span>
            ) : value >= 0 && scheduledTerminationsLeft > 0 ? (
              <span>On pace to end {eomLabel} positive.</span>
            ) : null}
          </div>
        )}
      </Card>

      <EditDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        current={value}
        onSubmit={async (v, note) => { await setAbsolute(v, note); setEditOpen(false); }}
      />
      <UpcomingChurnsDialog
        open={upcomingOpen}
        onClose={() => setUpcomingOpen(false)}
        pending={pendingChurns}
        applied={appliedChurns}
        eomLabel={eomLabel}
      />
      {isAdmin && (
        <>
          <UploadChurnsDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onSaved={load} />
          <ManageChurnsDialog open={manageOpen} onClose={() => setManageOpen(false)} />
        </>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Edit exact value
// ─────────────────────────────────────────────────────────────
function EditDialog({
  open, onClose, current, onSubmit,
}: { open: boolean; onClose: () => void; current: number; onSubmit: (v: number, note: string) => Promise<void> }) {
  const [val, setVal] = useState(String(current));
  const [note, setNote] = useState('');
  useEffect(() => { if (open) { setVal(String(current)); setNote(''); } }, [open, current]);
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Set Net Gain</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Exact value (can be negative)</Label>
            <Input type="number" value={val} onChange={e => setVal(e.target.value)} autoFocus />
          </div>
          <div>
            <Label className="text-xs">Note (optional)</Label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Freezes cleared, 2 cancels tonight" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => {
            const n = parseInt(val, 10);
            if (isNaN(n)) { toast.error('Enter a whole number'); return; }
            onSubmit(n, note);
          }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// Upcoming churns (read-only, all roles)
// ─────────────────────────────────────────────────────────────
function UpcomingChurnsDialog({
  open, onClose, churns, eomLabel,
}: { open: boolean; onClose: () => void; churns: Churn[]; eomLabel: string }) {
  const grouped = useMemo(() => {
    const byDate = new Map<string, Churn[]>();
    for (const c of churns) {
      const arr = byDate.get(c.churn_date) || [];
      arr.push(c);
      byDate.set(c.churn_date, arr);
    }
    return Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [churns]);
  const today = todayCST();

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Upcoming churns</DialogTitle>
          <DialogDescription>
            {churns.length === 0
              ? 'No scheduled churns through end of month.'
              : `${churns.length} scheduled through ${eomLabel}. Net Gain drops by −1 the day each member actually churns out.`}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto -mx-2 px-2">
          {grouped.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">🎉 No scheduled churns.</div>
          ) : (
            <div className="space-y-4">
              {grouped.map(([date, rows]) => {
                const isPast = date < today;
                return (
                  <div key={date}>
                    <div className="flex items-center justify-between mb-1.5 sticky top-0 bg-background/95 backdrop-blur py-1">
                      <div className="text-sm font-black">
                        {format(parseISO(date), 'EEE, MMM d')}
                        {isPast && <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-600 font-bold">Overdue</span>}
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted text-foreground tabular-nums">
                        {rows.length} member{rows.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {rows.map(r => (
                        <li key={r.id} className="border border-border rounded-md px-3 py-2 text-sm">
                          <div className="font-medium">{r.member_name}</div>
                          {r.notes && <div className="text-xs text-muted-foreground mt-0.5">{r.notes}</div>}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// History
// ─────────────────────────────────────────────────────────────
interface LogRow {
  id: string; delta: number; new_value: number; note: string | null; changed_by: string; changed_at: string;
  source_type: string; source_id: string | null;
}
function HistoryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<LogRow[]>([]);
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('net_gain_log')
        .select('id,delta,new_value,note,changed_by,changed_at,source_type,source_id')
        .order('changed_at', { ascending: false }).limit(50);
      setRows((data ?? []) as LogRow[]);
    })();
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[75vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>Net Gain — recent changes</DialogTitle></DialogHeader>
        <div className="overflow-y-auto -mx-2 px-2">
          {rows.length === 0 && <div className="text-sm text-muted-foreground py-6 text-center">No changes yet.</div>}
          <ul className="space-y-2">
            {rows.map(r => (
              <li key={r.id} className="border border-border rounded-md p-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(
                    'font-bold tabular-nums',
                    r.delta > 0 ? 'text-emerald-600' : r.delta < 0 ? 'text-red-600' : 'text-foreground',
                  )}>
                    {r.delta > 0 ? '+' : ''}{r.delta}
                  </span>
                  <span className="text-xs text-muted-foreground">→ {r.new_value}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {r.changed_by} · {format(new Date(r.changed_at), 'MMM d, h:mm a')}
                  {r.source_type !== 'manual' && <span className="ml-1 px-1 rounded bg-muted text-[10px] uppercase">{r.source_type}</span>}
                </div>
                {r.note && <div className="text-xs mt-1 text-foreground/80">{r.note}</div>}
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// Upload churn spreadsheet
// ─────────────────────────────────────────────────────────────
interface ParsedChurn { member_name: string; churn_date: string; notes: string; date_source: string; error?: string }

function duplicateKey(name: string, churnDate: string): string {
  return `${name.toLowerCase().trim().replace(/\s+/g, ' ')}|${churnDate}`;
}

function normalizeHeader(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function pickNameKey(keys: string[]): string | undefined {
  return keys.find(k => normalizeHeader(k) === 'name')
    || keys.find(k => normalizeHeader(k) === 'member name')
    || keys.find(k => /\b(member|client|customer)\b/.test(normalizeHeader(k)) && /\bname\b/.test(normalizeHeader(k)))
    || keys.find(k => /\bname\b/.test(normalizeHeader(k)));
}

function pickNotesKey(keys: string[]): string | undefined {
  return keys.find(k => /\b(reason|note|notes)\b/.test(normalizeHeader(k)));
}

function pickChurnDateKey(keys: string[]): string | undefined {
  const normalized = keys.map(key => ({ key, header: normalizeHeader(key) }));
  const isRequestOnly = (header: string) => /\b(request|requested|submitted|notice)\b/.test(header);

  const exactPriority = [
    'churn date',
    'actual churn date',
    'churn out date',
    'actual churn out date',
    'termination date',
    'actual termination date',
    'cancellation effective date',
    'cancel effective date',
    'effective cancellation date',
    'effective termination date',
    'membership end date',
    'contract end date',
  ];

  for (const wanted of exactPriority) {
    const match = normalized.find(({ header }) => header === wanted && !isRequestOnly(header));
    if (match) return match.key;
  }

  const fallback = normalized.find(({ header }) => /\bchurn\b/.test(header) && /\bdate\b/.test(header) && !isRequestOnly(header))
    || normalized.find(({ header }) => /\btermination\b/.test(header) && /\bdate\b/.test(header) && !isRequestOnly(header))
    || normalized.find(({ header }) => /\b(cancel|cancellation)\b/.test(header) && /\b(effective|date)\b/.test(header) && !isRequestOnly(header))
    || normalized.find(({ header }) => header === 'contract end date');

  return fallback?.key;
}

function ymdIfValid(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseChurnDate(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return ymdIfValid(raw.getFullYear(), raw.getMonth() + 1, raw.getDate());
  }
  // Excel serial date
  if (typeof raw === 'number') {
    const d = XLSX.SSF.parse_date_code(raw);
    if (!d) return null;
    return ymdIfValid(d.y, d.m, d.d);
  }
  const s = String(raw).trim();
  if (!s) return null;
  // ISO YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:\b|T)/);
  if (iso) return ymdIfValid(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  // M/D/YYYY or MM/DD/YYYY
  const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m1) {
    const mm = Number(m1[1]);
    const dd = Number(m1[2]);
    let yy = Number(m1[3]);
    if (yy < 100) yy += yy > 50 ? 1900 : 2000;
    return ymdIfValid(yy, mm, dd);
  }
  return null;
}

function UploadChurnsDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<ParsedChurn[]>([]);
  const [fileName, setFileName] = useState('');
  const [dateColumn, setDateColumn] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!open) { setRows([]); setFileName(''); setDateColumn(''); } }, [open]);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const keys = Array.from(new Set(json.flatMap(r => Object.keys(r))));
      const nameKey = pickNameKey(keys);
      const dateKey = pickChurnDateKey(keys);
      const notesKey = pickNotesKey(keys);
      setDateColumn(dateKey || '');
      if (!dateKey) toast.error('No actual churn date column found. Use a column named “Churn date” or “Termination date”.');
      const parsedDraft: ParsedChurn[] = json.map((r) => {
        const name = nameKey ? String(r[nameKey] ?? '').trim() : '';
        const dateRaw = dateKey ? r[dateKey] : '';
        const date = parseChurnDate(dateRaw);
        const notes = notesKey ? String(r[notesKey] ?? '').trim() : '';
        const err = !name ? 'Missing name' : !dateKey ? 'Missing actual churn date column' : !date ? 'Invalid date' : undefined;
        return { member_name: name, churn_date: date || '', notes, date_source: dateKey || '', error: err };
      }).filter(r => r.member_name || r.churn_date);

      const validDraft = parsedDraft.filter(r => !r.error && r.churn_date);
      const existingKeys = new Set<string>();
      if (validDraft.length > 0) {
        const minDate = validDraft.reduce((min, r) => r.churn_date < min ? r.churn_date : min, validDraft[0].churn_date);
        const maxDate = validDraft.reduce((max, r) => r.churn_date > max ? r.churn_date : max, validDraft[0].churn_date);
        const { data: existing } = await (supabase as any)
          .from('net_gain_churns')
          .select('member_name,churn_date')
          .gte('churn_date', minDate)
          .lte('churn_date', maxDate);
        ((existing as Pick<Churn, 'member_name' | 'churn_date'>[]) || [])
          .forEach(r => existingKeys.add(duplicateKey(r.member_name, r.churn_date)));
      }

      const seenInFile = new Set<string>();
      const parsed = parsedDraft.map(r => {
        if (r.error || !r.churn_date) return r;
        const key = duplicateKey(r.member_name, r.churn_date);
        if (existingKeys.has(key)) return { ...r, error: 'Already loaded' };
        if (seenInFile.has(key)) return { ...r, error: 'Duplicate in file' };
        seenInFile.add(key);
        return r;
      });
      setRows(parsed);
      if (parsed.length === 0) toast.error('No rows found. Expect columns like "Name" and "Churn Date".');
    } catch (e: any) {
      toast.error('Could not parse file: ' + (e?.message || 'unknown'));
    }
  };

  const valid = rows.filter(r => !r.error);
  const invalid = rows.filter(r => r.error);

  const commit = async () => {
    if (valid.length === 0 || !user?.name) return;
    setSaving(true);
    const batchId = crypto.randomUUID();
    const payload = valid.map(r => ({
      member_name: r.member_name,
      churn_date: r.churn_date,
      notes: r.notes || null,
      upload_batch_id: batchId,
      created_by: user.name,
    }));
    const { error } = await (supabase as any).from('net_gain_churns').insert(payload);
    setSaving(false);
    if (error) { toast.error('Upload failed: ' + error.message); return; }
    toast.success(`${valid.length} churn${valid.length === 1 ? '' : 's'} loaded`);
    // Immediately try applying any that are already past-due
    try {
      const { data } = await (supabase as any).rpc('apply_pending_net_gain_churns');
      if (data && (data as any).applied > 0) toast.success(`${(data as any).applied} applied immediately`);
    } catch {}
    onSaved();
    notifyChanged();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Upload churn spreadsheet</DialogTitle>
          <DialogDescription>
            CSV or Excel. Uses the actual churn date, not the termination request date.
            Each termination auto-subtracts −1 from Net Gain the day after its churn date.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <Button onClick={() => inputRef.current?.click()} variant="outline">
              <Upload className="w-4 h-4 mr-1" /> Choose file
            </Button>
            {fileName && <span className="text-sm text-muted-foreground truncate">{fileName}</span>}
          </div>

          {rows.length > 0 && (
            <>
              <div className="text-sm">
                <span className="font-semibold text-emerald-700">{valid.length} valid</span>
                {invalid.length > 0 && <span className="ml-2 font-semibold text-red-700">{invalid.length} with errors</span>}
              </div>
              {dateColumn && (
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Using date column: <span className="font-semibold text-foreground">{dateColumn}</span>
                </div>
              )}
              <div className="border rounded-md max-h-[45vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Churn date</TableHead>
                      <TableHead>Notes</TableHead>
                        <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={i} className={r.error ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                        <TableCell className="font-medium">{r.member_name || '—'}</TableCell>
                        <TableCell className="tabular-nums">{r.churn_date || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.notes}</TableCell>
                        <TableCell className="text-xs">
                          {r.error
                            ? <span className="text-red-600">{r.error}</span>
                            : r.churn_date < todayCST()
                              ? <span className="text-amber-600">Applies now</span>
                              : <span className="text-emerald-700">Scheduled</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={commit} disabled={valid.length === 0 || saving}>
            {saving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Saving…</> : `Load ${valid.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// Manage churns
// ─────────────────────────────────────────────────────────────
function ManageChurnsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<Churn[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('net_gain_churns')
      .select('id,member_name,churn_date,notes,applied_at,created_by,created_at')
      .order('churn_date', { ascending: true });
    setRows((data as Churn[]) || []);
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  const del = async (id: string) => {
    if (!confirm('Delete this churn? If already applied, the −1 will be reversed.')) return;
    setBusy(true);
    const { error } = await (supabase as any).from('net_gain_churns').delete().eq('id', id);
    setBusy(false);
    if (error) { toast.error('Delete failed'); return; }
    toast.success('Churn removed');
    notifyChanged();
    load();
  };

  const today = todayCST();
  const pending = rows.filter(r => !r.applied_at);
  const applied = rows.filter(r => r.applied_at);

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>Manage churns</DialogTitle></DialogHeader>
        <div className="overflow-y-auto space-y-4">
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2">
              Pending ({pending.length})
            </h3>
            {pending.length === 0
              ? <p className="text-sm text-muted-foreground">No pending churns.</p>
              : (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Churn date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pending.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.member_name}</TableCell>
                          <TableCell className="tabular-nums">{r.churn_date}</TableCell>
                          <TableCell className="text-xs">
                            {r.churn_date < today
                              ? <span className="text-amber-600">Overdue — will apply on next load</span>
                              : <span className="text-muted-foreground">Scheduled</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" disabled={busy} onClick={() => del(r.id)}>
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
          </section>

          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2">
              Applied ({applied.length})
            </h3>
            {applied.length === 0
              ? <p className="text-sm text-muted-foreground">None yet.</p>
              : (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Churn date</TableHead>
                        <TableHead>Applied</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {applied.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.member_name}</TableCell>
                          <TableCell className="tabular-nums">{r.churn_date}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.applied_at && format(new Date(r.applied_at), 'MMM d, h:mm a')}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" disabled={busy} onClick={() => del(r.id)}>
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
          </section>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
