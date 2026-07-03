/**
 * Outreach List detail — two structurally separate sections:
 *   - RETENTION / AT-RISK (is_churning=true) with a Save Attempt flow
 *   - STANDARD (is_churning=false) with Texted / In Person live actions
 *
 * Any row can be logged as a SOML upgrade or referral via the shared
 * LogSomlDialog which posts to the SAME tables the WIG scoreboard reads.
 */
import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { AlertTriangle, ArrowLeft, Check, MessageCircle, User, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useOutreachListDetail, OutreachRow, OutreachAction } from '@/features/outreach/useOutreach';
import { LogSomlDialog } from '@/features/soml/LogSomlDialog';
import { cn } from '@/lib/utils';

function fmtWhen(iso: string) {
  try {
    return format(new Date(iso), 'M/d h:mma').toLowerCase();
  } catch { return iso; }
}

function fmtChurnDate(d: string | null) {
  if (!d) return '—';
  const [y, m, day] = d.split('-').map(Number);
  return format(new Date(y, m - 1, day), 'EEE, MMM d');
}

function ActionPill({
  label, icon, active, attribution, onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  attribution?: OutreachAction;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors min-h-[32px]',
        active
          ? 'bg-primary/15 border-primary text-primary'
          : 'border-border hover:border-primary/60 hover:bg-accent',
      )}
      title={attribution ? `${label} · ${attribution.done_by} · ${fmtWhen(attribution.done_at)}` : `Mark as ${label}`}
    >
      {active ? <Check className="w-3 h-3" /> : icon}
      <span>{label}</span>
      {active && attribution && (
        <span className="opacity-80 font-normal">
          · {attribution.done_by} · {fmtWhen(attribution.done_at)}
        </span>
      )}
    </button>
  );
}

function StandardRowCard({
  row, actions, onLogUpgrade, onLogReferral,
}: {
  row: OutreachRow;
  actions: OutreachAction[];
  onLogUpgrade: (r: OutreachRow) => void;
  onLogReferral: (r: OutreachRow) => void;
}) {
  const { user } = useAuth();
  const rowActions = actions.filter(a => a.row_id === row.id);
  const texted = rowActions.find(a => a.action_type === 'texted');
  const inPerson = rowActions.find(a => a.action_type === 'in_person');

  const toggle = async (kind: 'texted' | 'in_person', existing?: OutreachAction) => {
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

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold truncate">{row.client_name}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {row.item && <span>{row.item}</span>}
              {row.amount != null && <span> · ${Number(row.amount).toFixed(0)}</span>}
              {row.phone && <span> · {row.phone}</span>}
            </div>
            {(row.worked_out_30d != null || row.last_30d_count != null) && (
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {row.last_30d_count != null && <>Last 30d: <b>{row.last_30d_count}</b> workouts</>}
                {row.latest_workout_date && <> · latest {fmtChurnDate(row.latest_workout_date)}</>}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <ActionPill label="Texted" icon={<MessageCircle className="w-3 h-3" />}
            active={!!texted} attribution={texted} onClick={() => toggle('texted', texted)} />
          <ActionPill label="In person" icon={<User className="w-3 h-3" />}
            active={!!inPerson} attribution={inPerson} onClick={() => toggle('in_person', inPerson)} />
          <div className="flex-1" />
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => onLogUpgrade(row)}>
            <Plus className="w-3 h-3 mr-1" /> Log Upgrade
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => onLogReferral(row)}>
            <Sparkles className="w-3 h-3 mr-1" /> Log Referral
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ChurningRowCard({
  row, actions, onSaveAttempt, onLogUpgrade,
}: {
  row: OutreachRow;
  actions: OutreachAction[];
  onSaveAttempt: (r: OutreachRow) => void;
  onLogUpgrade: (r: OutreachRow) => void;
}) {
  const rowActions = actions.filter(a => a.row_id === row.id && a.action_type === 'save_attempt');
  const latest = rowActions[0];

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
              <span className="font-semibold truncate">{row.client_name}</span>
            </div>
            <div className="text-[11px] text-destructive font-medium">
              Churns {fmtChurnDate(row.churn_date)}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              {row.item && <span>{row.item}</span>}
              {row.phone && <span> · {row.phone}</span>}
            </div>
          </div>
          <Badge variant="destructive" className="shrink-0 text-[9px]">SAVE CALL</Badge>
        </div>

        {latest && (
          <div className="text-[11px] text-muted-foreground bg-background/60 rounded px-2 py-1">
            Last save attempt: <b>{latest.done_by}</b> · {fmtWhen(latest.done_at)}
            {latest.notes && <> — {latest.notes}</>}
            {rowActions.length > 1 && <> ({rowActions.length} total)</>}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="destructive" className="h-8 text-[11px]" onClick={() => onSaveAttempt(row)}>
            Log Save Attempt
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => onLogUpgrade(row)}>
            <Plus className="w-3 h-3 mr-1" /> Log Upgrade
          </Button>
        </div>
      </CardContent>
    </Card>
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
          <Textarea
            placeholder="What did you say? Any commitment or objection?"
            rows={3} value={notes} onChange={e => setNotes(e.target.value)}
          />
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
  const { list, rows, actions, loading } = useOutreachListDetail(id);
  const [somlDialog, setSomlDialog] = useState<{ kind: 'upgrade' | 'referral'; name: string } | null>(null);
  const [saveDialog, setSaveDialog] = useState<OutreachRow | null>(null);

  const { churning, standard } = useMemo(() => {
    const c = rows.filter(r => r.is_churning)
      .sort((a, b) => (a.churn_date || '9999').localeCompare(b.churn_date || '9999'));
    const s = rows.filter(r => !r.is_churning);
    return { churning: c, standard: s };
  }, [rows]);

  return (
    <div className="p-4 max-w-4xl mx-auto pb-24">
      <div className="mb-3">
        <Button asChild variant="ghost" size="sm" className="h-8 -ml-2">
          <Link to="/outreach-lists"><ArrowLeft className="w-4 h-4 mr-1" /> All lists</Link>
        </Button>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!loading && !list && <div className="text-sm text-muted-foreground">List not found.</div>}

      {list && (
        <>
          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {list.campaign_tag}
            </div>
            <h1 className="text-xl font-black uppercase tracking-wide">{list.name}</h1>
            <div className="text-[11px] text-muted-foreground">
              {rows.length} people · {churning.length} at-risk
            </div>
          </div>

          {churning.length > 0 && (
            <section className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-destructive">
                  Retention · Save calls, not upsells
                </h2>
                <span className="text-[11px] text-muted-foreground">({churning.length})</span>
              </div>
              <div className="grid gap-2">
                {churning.map(r => (
                  <ChurningRowCard key={r.id} row={r} actions={actions}
                    onSaveAttempt={setSaveDialog}
                    onLogUpgrade={(row) => setSomlDialog({ kind: 'upgrade', name: row.client_name })} />
                ))}
              </div>
            </section>
          )}

          {standard.length > 0 && (
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2">
                Standard outreach <span className="text-[11px] font-normal">({standard.length})</span>
              </h2>
              <div className="grid gap-2">
                {standard.map(r => (
                  <StandardRowCard key={r.id} row={r} actions={actions}
                    onLogUpgrade={(row) => setSomlDialog({ kind: 'upgrade', name: row.client_name })}
                    onLogReferral={(row) => setSomlDialog({ kind: 'referral', name: row.client_name })} />
                ))}
              </div>
            </section>
          )}
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
    </div>
  );
}
