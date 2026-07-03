/**
 * Net Gain scoreboard — one manually-adjusted number visible at the top of
 * My Day, Studio, and WIG. Every change is written to net_gain_log for audit.
 *
 * Reads and writes go through a small event bus so all mounted scoreboards
 * stay in sync across tabs and pages without a full refetch.
 */
import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Minus, Plus, Pencil, TrendingUp, TrendingDown, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';

const EVT = 'otf:netGainChanged';
function notifyChanged() { window.dispatchEvent(new Event(EVT)); }

interface State { value: number; updated_at: string; updated_by: string | null }

export function NetGainScoreboard({ className }: { className?: string }) {
  const { user } = useAuth();
  const [state, setState] = useState<State | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('net_gain_state').select('value,updated_at,updated_by').eq('id', 1).maybeSingle();
    if (data) setState(data as State);
  }, []);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener(EVT, h);
    return () => window.removeEventListener(EVT, h);
  }, [load]);

  const applyDelta = async (delta: number, note?: string) => {
    if (!user?.name) { toast.error('Login required'); return; }
    if (!state) return;
    setBusy(true);
    const newValue = state.value + delta;
    const { error: e1 } = await (supabase as any)
      .from('net_gain_state')
      .update({ value: newValue, updated_by: user.name })
      .eq('id', 1);
    if (e1) { setBusy(false); toast.error('Save failed'); return; }
    await (supabase as any).from('net_gain_log').insert({
      delta, new_value: newValue, note: note?.trim() || null, changed_by: user.name,
    });
    setBusy(false);
    notifyChanged();
    toast.success(delta > 0 ? `+${delta} · Net Gain now ${newValue}` : `${delta} · Net Gain now ${newValue}`);
  };

  const setAbsolute = async (v: number, note?: string) => {
    if (!user?.name) { toast.error('Login required'); return; }
    if (!state) return;
    const delta = v - state.value;
    if (delta === 0) return;
    await applyDelta(delta, note || 'set to exact value');
  };

  const value = state?.value ?? 0;
  const positive = value > 0;
  const negative = value < 0;

  return (
    <>
      <Card
        className={cn(
          'p-3 flex items-center gap-3 border-2',
          positive && 'border-success/60 bg-success/5',
          negative && 'border-destructive/60 bg-destructive/5',
          !positive && !negative && 'border-border',
          className,
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {positive && <TrendingUp className="w-4 h-4 text-success shrink-0" />}
          {negative && <TrendingDown className="w-4 h-4 text-destructive shrink-0" />}
          <span className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
            Net Gain
          </span>
        </div>

        <div className="flex items-baseline gap-1 flex-1 justify-center">
          <span
            className={cn(
              'text-3xl font-black tabular-nums leading-none',
              positive && 'text-success',
              negative && 'text-destructive',
              !positive && !negative && 'text-foreground',
            )}
          >
            {value > 0 ? '+' : ''}{value}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-9 w-9 p-0"
            aria-label="Decrease Net Gain by 1"
            disabled={busy || !state}
            onClick={() => applyDelta(-1)}
          >
            <Minus className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 w-9 p-0"
            aria-label="Increase Net Gain by 1"
            disabled={busy || !state}
            onClick={() => applyDelta(1)}
          >
            <Plus className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-9 w-9 p-0"
            aria-label="Edit exact value"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-9 w-9 p-0"
            aria-label="View change history"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      <EditDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        current={value}
        onSubmit={async (v, note) => { await setAbsolute(v, note); setEditOpen(false); }}
      />
      <HistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </>
  );
}

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
            <Input
              type="number"
              value={val}
              onChange={e => setVal(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <Label className="text-xs">Note (optional)</Label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Freezes cleared, 2 cancels tonight"
              rows={2}
            />
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

interface LogRow { id: string; delta: number; new_value: number; note: string | null; changed_by: string; changed_at: string }

function HistoryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<LogRow[]>([]);
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('net_gain_log')
        .select('id,delta,new_value,note,changed_by,changed_at')
        .order('changed_at', { ascending: false })
        .limit(30);
      setRows((data ?? []) as LogRow[]);
    })();
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[75vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>Net Gain — recent changes</DialogTitle></DialogHeader>
        <div className="overflow-y-auto -mx-2 px-2">
          {rows.length === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center">No changes yet.</div>
          )}
          <ul className="space-y-2">
            {rows.map(r => (
              <li key={r.id} className="border border-border rounded-md p-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(
                    'font-bold tabular-nums',
                    r.delta > 0 ? 'text-success' : r.delta < 0 ? 'text-destructive' : 'text-foreground',
                  )}>
                    {r.delta > 0 ? '+' : ''}{r.delta}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    → {r.new_value}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {r.changed_by} · {format(new Date(r.changed_at), 'MMM d, h:mm a')}
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
