/**
 * Small inline chip that displays the current-month Net Gain goal and lets
 * Koa edit it inline. Reads/writes through `loadMonthlyTargets` /
 * `saveMonthlyTarget` (key `net_gain_target:YYYY-MM`) so the value flows
 * through the same canonical monthly-target loader every other WIG number uses.
 */
import { useEffect, useState, useCallback } from 'react';
import { Target, Pencil, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { isKoa } from '@/lib/auth/roles';
import { loadMonthlyTargets, saveMonthlyTarget } from '@/lib/wig/targets';
import { toast } from 'sonner';

function currentMonthKeyCST(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit',
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find(p => p.type === 'year')!.value;
  const m = parts.find(p => p.type === 'month')!.value;
  return `${y}-${m}`;
}

export function NetGainGoalChip({
  currentValue,
  className,
  tone = 'auto',
}: {
  currentValue: number;
  className?: string;
  tone?: 'auto' | 'light' | 'dark';
}) {
  const { user } = useAuth();
  const canEdit = isKoa(user);
  const [goal, setGoal] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const monthKey = currentMonthKeyCST();

  const load = useCallback(async () => {
    const t = await loadMonthlyTargets(monthKey);
    setGoal(t.netGain);
  }, [monthKey]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener('otf:netGainChanged', h);
    return () => window.removeEventListener('otf:netGainChanged', h);
  }, [load]);

  const save = async () => {
    const n = parseInt(draft, 10);
    if (isNaN(n)) { toast.error('Enter a whole number'); return; }
    setBusy(true);
    const { error } = await saveMonthlyTarget('netGain', monthKey, n, user?.name ?? 'system');
    setBusy(false);
    if (error) { toast.error('Save failed'); return; }
    setGoal(n);
    setEditing(false);
    toast.success('Goal saved');
  };

  const delta = goal != null ? currentValue - goal : null;
  const onPace = delta != null && delta >= 0;

  const baseCls = tone === 'light'
    ? 'border-white/30 bg-white/10 text-white'
    : tone === 'dark'
      ? 'border-border bg-background text-foreground'
      : 'border-border bg-background text-foreground';

  if (editing) {
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 border', baseCls, className)}>
        <Target className="w-3.5 h-3.5 opacity-70" />
        <span className="text-xs opacity-70">Goal</span>
        <input
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          className="w-16 h-6 text-xs px-1 rounded border border-border text-foreground"
          autoFocus
          disabled={busy}
        />
        <button onClick={save} disabled={busy} aria-label="Save goal" className="p-0.5 hover:opacity-70">
          <Check className="w-3.5 h-3.5 text-emerald-500" />
        </button>
        <button onClick={() => setEditing(false)} aria-label="Cancel" className="p-0.5 hover:opacity-70">
          <X className="w-3.5 h-3.5" />
        </button>
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 border text-xs font-semibold',
        baseCls,
        className,
      )}
    >
      <Target className="w-3.5 h-3.5" />
      {goal == null ? (
        <>
          <span>No monthly goal set</span>
          {canEdit && (
            <button
              onClick={() => { setDraft(''); setEditing(true); }}
              className="underline underline-offset-2 opacity-80 hover:opacity-100"
            >
              Set
            </button>
          )}
        </>
      ) : (
        <>
          <span>Goal: <span className="tabular-nums font-black">{goal}</span></span>
          {delta != null && (
            <span className={cn(
              'tabular-nums font-black',
              onPace ? 'text-emerald-500' : 'text-red-500',
            )}>
              ({delta >= 0 ? '+' : ''}{delta})
            </span>
          )}
          {canEdit && (
            <button
              onClick={() => { setDraft(String(goal)); setEditing(true); }}
              aria-label="Edit goal"
              className="opacity-70 hover:opacity-100"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </>
      )}
    </span>
  );
}
