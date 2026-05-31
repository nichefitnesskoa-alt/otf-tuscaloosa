/**
 * VIP page — "Needs setup SA" section.
 *
 * Lists every vip_session whose sa_setup_name is null/empty, with an inline
 * SA picker that writes sa_setup_name using the SAME write path the My Day
 * VIP drawer uses (supabase update on vip_sessions + notifyDataChanged on
 * ['vip_sessions','sa-leads-booked']). Assigning a row drops it off the
 * gap list and re-credits the SA in WIG + Own It immediately.
 *
 * A secondary collapsible section lists already-assigned VIP classes so a
 * wrong assignment can be corrected later through the same picker.
 */
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Check, AlertTriangle, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useActiveStaff } from '@/hooks/useActiveStaff';
import { notifyDataChanged } from '@/lib/data/invalidation';

interface SessionRow {
  id: string;
  session_date: string | null;
  session_time: string | null;
  reserved_by_group: string | null;
  session_type: string | null;
  sa_setup_name: string | null;
  intros_count: number;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-').map(Number);
  const dt = new Date(y, m - 1, day);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', weekday: 'short' });
}

function fmtTime(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, '0')} ${period}`;
}

function classLabel(r: SessionRow): string {
  return r.reserved_by_group?.trim() || (r.session_type === 'exclusive' ? 'Exclusive slot' : 'VIP class');
}

export function VipNeedsSetupSection() {
  const { salesAssociates: SAS, loading: staffLoading } = useActiveStaff();
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [showAssigned, setShowAssigned] = useState(false);
  const [showEmptyGaps, setShowEmptyGaps] = useState(false);

  const fetchRows = async () => {
    setLoading(true);
    // 1. all non-cancelled sessions
    const { data: sessions, error } = await supabase
      .from('vip_sessions' as any)
      .select('id, session_date, session_time, reserved_by_group, session_type, sa_setup_name, status')
      .neq('status', 'cancelled')
      .order('session_date', { ascending: false });
    if (error) {
      console.error(error);
      toast.error('Failed to load VIP sessions');
      setRows([]); setLoading(false); return;
    }
    const ids = (sessions || []).map((s: any) => s.id);
    // 2. count intros per session (single query, group in JS)
    let countsBySession: Record<string, number> = {};
    if (ids.length) {
      const { data: intros } = await supabase
        .from('intros_booked')
        .select('vip_session_id')
        .in('vip_session_id', ids)
        .is('deleted_at', null);
      (intros || []).forEach((row: any) => {
        const k = row.vip_session_id;
        if (k) countsBySession[k] = (countsBySession[k] || 0) + 1;
      });
    }
    const merged: SessionRow[] = (sessions || []).map((s: any) => ({
      id: s.id,
      session_date: s.session_date,
      session_time: s.session_time,
      reserved_by_group: s.reserved_by_group,
      session_type: s.session_type,
      sa_setup_name: s.sa_setup_name,
      intros_count: countsBySession[s.id] || 0,
    }));
    setRows(merged);
    setLoading(false);
  };

  useEffect(() => { fetchRows(); }, []);

  const unassigned = useMemo(() => rows.filter(r => !r.sa_setup_name?.trim()), [rows]);
  const assigned = useMemo(() =>
    rows.filter(r => !!r.sa_setup_name?.trim())
        .sort((a, b) => (b.session_date || '').localeCompare(a.session_date || '')),
    [rows]
  );

  // Sort gaps: leaks (intros > 0) first by date desc, then empty slots by date desc.
  const sortedGaps = useMemo(() => {
    const withIntros = unassigned.filter(r => r.intros_count > 0)
      .sort((a, b) => (b.session_date || '').localeCompare(a.session_date || ''));
    const empty = unassigned.filter(r => r.intros_count === 0)
      .sort((a, b) => (b.session_date || '').localeCompare(a.session_date || ''));
    return showEmptyGaps ? [...withIntros, ...empty] : withIntros;
  }, [unassigned, showEmptyGaps]);

  const emptyGapCount = unassigned.filter(r => r.intros_count === 0).length;

  const assign = async (sessionId: string, saName: string) => {
    setSavingId(sessionId);
    try {
      const { error } = await supabase
        .from('vip_sessions' as any)
        .update({ sa_setup_name: saName || null })
        .eq('id', sessionId);
      if (error) throw error;
      // Same broadcast keys as MyDay VIP drawer.
      notifyDataChanged(['vip_sessions', 'sa-leads-booked'], 'vip-sa-setup-edit');
      // Optimistic update.
      setRows(prev => prev.map(r => r.id === sessionId ? { ...r, sa_setup_name: saName } : r));
      setSavedId(sessionId);
      setTimeout(() => setSavedId(s => s === sessionId ? null : s), 2000);
    } catch (e) {
      console.error(e);
      toast.error('Failed to assign SA');
    } finally {
      setSavingId(null);
    }
  };

  const renderRow = (r: SessionRow, isAssigned: boolean) => (
    <div
      key={r.id}
      className="flex items-center gap-3 px-3 py-2 border border-border rounded-md bg-card hover:bg-accent/40 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{classLabel(r)}</div>
        <div className="text-xs text-muted-foreground">
          {fmtDate(r.session_date)} · {fmtTime(r.session_time)}
        </div>
      </div>
      <div className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-muted text-muted-foreground min-w-[88px] justify-center">
        <Users className="w-3 h-3" />
        {r.intros_count} {r.intros_count === 1 ? 'intro' : 'intros'}
      </div>
      <div className="w-[180px]">
        <Select
          value={r.sa_setup_name || ''}
          onValueChange={(v) => assign(r.id, v)}
          disabled={savingId === r.id || staffLoading}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder={isAssigned ? 'Change SA…' : 'Pick setup SA…'} />
          </SelectTrigger>
          <SelectContent>
            {SAS.map(name => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-14 text-right text-xs text-muted-foreground">
        {savingId === r.id ? 'Saving…' : savedId === r.id ? (
          <span className="inline-flex items-center gap-1 text-emerald-500"><Check className="w-3 h-3" /> Saved</span>
        ) : ''}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <Card className="p-4 space-y-3 border-amber-500/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold">Needs setup SA</h2>
            <span className="text-xs text-muted-foreground">
              {loading ? 'loading…' : `${sortedGaps.length} of ${unassigned.length} unassigned`}
            </span>
          </div>
          {emptyGapCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setShowEmptyGaps(v => !v)}
            >
              {showEmptyGaps ? 'Hide empty slots' : `Show empty slots (${emptyGapCount})`}
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          VIP classes without a setup SA are uncredited on the WIG leaderboard.
          Assigning here writes the same field as the My Day VIP card and re-credits the SA instantly.
        </p>

        {loading ? (
          <div className="text-xs text-muted-foreground py-4">Loading VIP sessions…</div>
        ) : unassigned.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-500 py-3">
            <Check className="w-4 h-4" />
            All VIP classes have a setup SA.
          </div>
        ) : sortedGaps.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2">
            No unassigned classes with intros booked. {emptyGapCount} empty slot(s) hidden.
          </div>
        ) : (
          <div className="space-y-2">
            {sortedGaps.map(r => renderRow(r, false))}
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <button
          type="button"
          onClick={() => setShowAssigned(v => !v)}
          className="flex items-center gap-2 w-full text-left"
        >
          {showAssigned ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span className="text-sm font-semibold">Assigned VIP classes</span>
          <span className="text-xs text-muted-foreground">({assigned.length})</span>
        </button>
        {showAssigned && (
          <div className="space-y-2">
            {assigned.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2">No VIP classes have a setup SA assigned yet.</div>
            ) : assigned.map(r => renderRow(r, true))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default VipNeedsSetupSection;
