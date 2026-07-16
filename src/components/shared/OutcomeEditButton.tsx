/**
 * OutcomeEditButton — inline outcome flip control.
 *
 * Clickable outcome badge. On click, fetches the booking + latest run and
 * opens the canonical OutcomeDrawer in a Sheet. All writes flow through
 * applyIntroOutcomeUpdate (via OutcomeDrawer). Fires notifyDataChanged so
 * every consumer (close rate, follow-up queue, canon) re-reads.
 *
 * Use this anywhere a static outcome label is shown but the operator should
 * be able to flip the outcome without opening the full Journey card.
 */
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { OutcomeDrawer } from '@/components/myday/OutcomeDrawer';
import { notifyDataChanged } from '@/lib/data/invalidation';

interface BookingContext {
  id: string;
  member_name: string;
  class_date: string;
  intro_time: string | null;
  coach_name: string | null;
  lead_source: string | null;
  is_vip: boolean | null;
  latest_run_id: string | null;
  latest_run_result: string | null;
  latest_run_objection: string | null;
  latest_run_is_winback: boolean;
}

interface Props {
  bookingId: string;
  /** Current outcome label to display when closed. */
  label?: string | null;
  /** Tone for the badge (matches PersonListDrillDown tones). */
  tone?: 'success' | 'warning' | 'destructive' | 'primary' | 'muted';
  /** Called after a successful save (in addition to the global event). */
  onChanged?: () => void;
  className?: string;
}

const TONE_CLASS: Record<NonNullable<Props['tone']>, string> = {
  success: 'bg-success/15 text-success border-success/40 hover:bg-success/25',
  warning: 'bg-warning/15 text-warning border-warning/40 hover:bg-warning/25',
  destructive: 'bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20',
  primary: 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20',
  muted: 'bg-muted text-muted-foreground border-border hover:bg-muted/70',
};

export function OutcomeEditButton({ bookingId, label, tone = 'muted', onChanged, className }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ctx, setCtx] = useState<BookingContext | null>(null);

  const handleOpen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setLoading(true);
    try {
      const { data: bk, error: bkErr } = await supabase
        .from('intros_booked')
        .select('id, member_name, class_date, intro_time, coach_name, lead_source, is_vip')
        .eq('id', bookingId)
        .maybeSingle();
      if (bkErr) throw bkErr;
      if (!bk) throw new Error('Booking not found');

      const { data: runs } = await supabase
        .from('intros_run')
        .select('id, result, primary_objection, is_winback, run_date, created_at')
        .eq('linked_intro_booked_id', bookingId)
        .order('run_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1);
      const latest = (runs as any[])?.[0] || null;

      setCtx({
        id: bk.id,
        member_name: bk.member_name,
        class_date: bk.class_date,
        intro_time: bk.intro_time ?? null,
        coach_name: bk.coach_name ?? null,
        lead_source: bk.lead_source ?? null,
        is_vip: bk.is_vip ?? false,
        latest_run_id: latest?.id ?? null,
        latest_run_result: latest?.result ?? null,
        latest_run_objection: latest?.primary_objection ?? null,
        latest_run_is_winback: latest?.is_winback ?? false,
      });
      setOpen(true);
    } catch (err: any) {
      console.error('[OutcomeEditButton] open failed', err);
      toast.error(err?.message || 'Could not open outcome editor');
    } finally {
      setLoading(false);
    }
  };

  const handleSaved = () => {
    setOpen(false);
    notifyDataChanged(
      ['intros_run', 'intros_booked', 'sa-sales', 'sa-leads-booked', 'follow_up_queue'],
      'outcome-edit-button',
    );
    onChanged?.();
  };

  const displayLabel = label || 'Set outcome';

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={loading}
        aria-label={`Edit outcome (current: ${displayLabel})`}
        title="Tap to change outcome"
        className={cn(
          'inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 transition-colors cursor-pointer min-h-[28px]',
          TONE_CLASS[tone],
          loading && 'opacity-60 cursor-wait',
          className,
        )}
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pencil className="w-2.5 h-2.5 opacity-70" />}
        <span>{displayLabel}</span>
      </button>

      <Sheet open={open} onOpenChange={(o) => { if (!o) setOpen(false); }}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Outcome{ctx ? ` — ${ctx.member_name}` : ''}</SheetTitle>
          </SheetHeader>
          {ctx && (
            <OutcomeDrawer
              bookingId={ctx.id}
              memberName={ctx.member_name}
              classDate={ctx.class_date}
              introTime={ctx.intro_time}
              leadSource={ctx.lead_source || ''}
              existingRunId={ctx.latest_run_id}
              currentResult={ctx.latest_run_result}
              editedBy={user?.name || 'Unknown'}
              initialCoach={ctx.coach_name || ''}
              initialObjection={ctx.latest_run_objection || ''}
              isVipClassIntro={ctx.latest_run_result === 'VIP Class Intro'}
              onSaved={handleSaved}
              onCancel={() => setOpen(false)}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
