import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ClipboardCheck, ArrowLeft, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getLocalDateString } from '@/lib/utils';

interface CloseOutShiftProps {
  completedIntros: number;
  activeIntros: number;
  scriptsSent: number;
  followUpsSent: number;
  purchaseCount: number;
  noShowCount: number;
  didntBuyCount: number;
  topObjection?: string | null;
  forceOpen?: boolean;
  onForceOpenChange?: (open: boolean) => void;
  asButton?: boolean;
}

interface ShiftSummaryData {
  booked: number;
  ran: number;
  sold: number;
  noShow: number;
  didntBuy: number;
  followUpNeeded: number;
  calls: number;
  texts: number;
  dms: number;
  shiftType: string;
}

export function CloseOutShift({
  completedIntros,
  activeIntros,
  scriptsSent,
  followUpsSent,
  purchaseCount,
  noShowCount,
  didntBuyCount,
  topObjection,
  forceOpen,
  onForceOpenChange,
  asButton,
}: CloseOutShiftProps) {
  const { user } = useAuth();
  const { refreshData } = useData();
  const [internalOpen, setInternalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [visible, setVisible] = useState(false);
  const [summary, setSummary] = useState<ShiftSummaryData | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    const hour = new Date().getHours();
    const shouldShow = hour >= 11 && (completedIntros + scriptsSent + followUpsSent) > 0;
    setVisible(shouldShow);
  }, [completedIntros, scriptsSent, followUpsSent]);

  const isControlled = forceOpen !== undefined;
  const open = isControlled ? forceOpen! : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) onForceOpenChange?.(v);
    else setInternalOpen(v);
  };

  // Fetch live summary data whenever dialog opens
  useEffect(() => {
    if (!open || !user?.name) return;
    fetchSummary();
  }, [open, user?.name]);

  const fetchSummary = async () => {
    if (!user?.name) return;
    setLoadingSummary(true);
    const today = getLocalDateString();

    try {
      const SALE_RESULTS = ['Premier + OTbeat', 'Premier', 'Elite + OTbeat', 'Elite', 'Basic + OTbeat', 'Basic'];

      // Intros booked today for this SA — includes friend bookings (booked_by) and shift bookings (sa_working_shift)
      // Fetch both and deduplicate so friend bookings without shift_recap_id are always counted
      // Exclude VIP/COMP bookings from counts
      const [bookedByShift, bookedByAttrib] = await Promise.all([
        supabase
          .from('intros_booked')
          .select('id, booking_type_canon')
          .eq('class_date', today)
          .eq('sa_working_shift', user.name)
          .is('deleted_at', null),
        supabase
          .from('intros_booked')
          .select('id, booking_type_canon')
          .eq('class_date', today)
          .eq('booked_by', user.name)
          .is('deleted_at', null),
      ]);
      // Deduplicate by id and exclude VIP/COMP
      const allBookedIds = new Set<string>();
      for (const b of [...(bookedByShift.data || []), ...(bookedByAttrib.data || [])]) {
        const btc = (b as any).booking_type_canon;
        if (btc !== 'VIP' && btc !== 'COMP') {
          allBookedIds.add(b.id);
        }
      }

      // Intros run today
      const { data: ran } = await supabase
        .from('intros_run')
        .select('result, result_canon, buy_date, run_date, goal_why_captured')
        .or(`sa_name.eq.${user.name},intro_owner.eq.${user.name}`)
        .eq('run_date', today);

      const soldCount = (ran || []).filter(r => {
        const effectiveDate = r.buy_date || r.run_date || '';
        return effectiveDate === today && SALE_RESULTS.includes(r.result);
      }).length;

      const noShowCount = (ran || []).filter(r => r.result_canon === 'NO_SHOW').length;
      const didntBuyCount = (ran || []).filter(r => r.result_canon === 'DIDNT_BUY').length;
      const followUpNeeded = (ran || []).filter(r =>
        ['DIDNT_BUY', 'NO_SHOW', 'PLANNING_RESCHEDULE'].includes(r.result_canon || '')
      ).length;

      // Shift activity (calls/texts/DMs) from shift_recaps
      const hour = new Date().getHours();
      const shiftType = hour < 12 ? 'AM Shift' : hour < 16 ? 'Mid Shift' : 'PM Shift';

      const { data: shiftData } = await supabase
        .from('shift_recaps')
        .select('calls_made, texts_sent, dms_sent, shift_type')
        .eq('staff_name', user.name)
        .eq('shift_date', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setSummary({
        booked: allBookedIds.size,
        ran: (ran || []).length,
        sold: soldCount,
        noShow: noShowCount,
        didntBuy: didntBuyCount,
        followUpNeeded,
        calls: shiftData?.calls_made ?? 0,
        texts: shiftData?.texts_sent ?? 0,
        dms: shiftData?.dms_sent ?? 0,
        shiftType: shiftData?.shift_type || shiftType,
      });
    } catch (err) {
      console.error('End shift summary fetch error:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleSubmit = async () => {
    if (!user?.name || !summary) return;
    setSubmitting(true);

    try {
      const today = getLocalDateString();

      // 1. Save / upsert shift recap — DB write FIRST
      const { data: existing } = await supabase
        .from('shift_recaps')
        .select('id')
        .eq('staff_name', user.name)
        .eq('shift_date', today)
        .limit(1)
        .maybeSingle();

      let recapId: string;

      if (existing) {
        await supabase
          .from('shift_recaps')
          .update({ submitted_at: new Date().toISOString() })
          .eq('id', existing.id);
        recapId = existing.id;
      } else {
        const { data: newRecap } = await supabase
          .from('shift_recaps')
          .insert({
            staff_name: user.name,
            shift_date: today,
            shift_type: summary.shiftType,
            submitted_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        recapId = newRecap?.id || '';
      }

      // 2. Build GroupMe message (no commission figures)
      const dateLabel = format(new Date(), 'MMM d, yyyy');
      const groupMeText = [
        `🏋️ ${user.name} — ${summary.shiftType} Recap (${dateLabel})`,
        ``,
        `📅 INTROS`,
        `• Booked: ${summary.booked}`,
        `• Ran: ${summary.ran}`,
        `• Sold: ${summary.sold} ✅`,
        `• No-Show: ${summary.noShow}`,
        `• Didn't Buy: ${summary.didntBuy}`,
        `• Follow-Up: ${summary.followUpNeeded}`,
        ``,
        `📞 CONTACTS`,
        `• Calls: ${summary.calls}`,
        `• Texts: ${summary.texts}`,
        `• DMs: ${summary.dms}`,
      ].join('\n');

      // 3. Post to GroupMe (after DB write succeeds)
      let groupMePosted = false;
      try {
        const { data: gmData, error: gmError } = await supabase.functions.invoke('post-groupme', {
          body: { text: groupMeText, staffName: user.name },
        });

        if (gmError || !gmData?.success) {
          console.error('GroupMe post failed:', gmError || gmData?.error);
          // Store failed status in daily_recaps
          await supabase.from('daily_recaps').insert({
            shift_date: today,
            staff_name: user.name,
            recap_text: groupMeText,
            status: 'failed',
            shift_recap_id: recapId,
            error_message: gmError?.message || gmData?.error || 'GroupMe post failed',
          });
        } else {
          groupMePosted = true;
          await supabase.from('daily_recaps').insert({
            shift_date: today,
            staff_name: user.name,
            recap_text: groupMeText,
            status: 'sent',
            shift_recap_id: recapId,
          });
        }
      } catch (gmErr) {
        console.error('GroupMe exception:', gmErr);
        await supabase.from('daily_recaps').insert({
          shift_date: today,
          staff_name: user.name,
          recap_text: groupMeText,
          status: 'failed',
          shift_recap_id: recapId,
          error_message: gmErr instanceof Error ? gmErr.message : 'Unknown error',
        });
      }

      await refreshData();
      setOpen(false);

      if (groupMePosted) {
        toast.success('Shift recap submitted and posted to GroupMe ✓');
      } else {
        toast.error('Recap saved — GroupMe post failed. Try resending from Studio.');
      }
    } catch (err) {
      console.error('Close out error:', err);
      toast.error('Failed to submit shift recap');
    } finally {
      setSubmitting(false);
    }
  };

  const SummaryRow = ({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) => (
    <div className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${highlight ? 'text-primary' : ''}`}>{value}</span>
    </div>
  );

  return (
    <>
      {!isControlled && (asButton || visible) && (
        <Button
          className={asButton ? 'w-full h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90' : 'w-full gap-2 bg-primary hover:bg-primary/90'}
          size={asButton ? 'sm' : 'lg'}
          onClick={() => setInternalOpen(true)}
        >
          <ClipboardCheck className={asButton ? 'w-3.5 h-3.5' : 'w-5 h-5'} />
          {asButton ? 'End Shift' : 'Close Out Shift'}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="w-4 h-4 text-primary" />
              Confirm Shift Recap
            </DialogTitle>
          </DialogHeader>

          {loadingSummary || !summary ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading shift data…</div>
          ) : (
            <div className="space-y-4">
              {/* Header line */}
              <div className="bg-muted/50 rounded-lg px-3 py-2 text-center">
                <p className="text-xs font-semibold text-foreground">{user?.name} — {summary.shiftType}</p>
                <p className="text-[11px] text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
              </div>

              {/* Intros section */}
              <div className="rounded-lg border border-border/60 overflow-hidden">
                <div className="px-3 py-1.5 bg-muted/40 border-b border-border/40">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">📅 Intros</span>
                </div>
                <div className="px-3 py-1">
                  <SummaryRow label="Booked" value={summary.booked} />
                  <SummaryRow label="Ran" value={summary.ran} />
                  <SummaryRow label="Sold" value={summary.sold} highlight />
                  <SummaryRow label="No-Show" value={summary.noShow} />
                  <SummaryRow label="Didn't Buy" value={summary.didntBuy} />
                  <SummaryRow label="Follow-Up Needed" value={summary.followUpNeeded} />
                </div>
              </div>

              {/* Contacts section */}
              <div className="rounded-lg border border-border/60 overflow-hidden">
                <div className="px-3 py-1.5 bg-muted/40 border-b border-border/40">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">📞 Contacts</span>
                </div>
                <div className="px-3 py-1">
                  <SummaryRow label="Calls" value={summary.calls} />
                  <SummaryRow label="Texts" value={summary.texts} />
                  <SummaryRow label="DMs" value={summary.dms} />
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground text-center">
                Tapping "Submit + Post to GroupMe" will save this recap and post to the team chat.
              </p>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              onClick={handleSubmit}
              disabled={submitting || loadingSummary}
              className="w-full bg-primary hover:bg-primary/90 gap-2"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Submitting…' : 'Submit + Post to GroupMe'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
              className="w-full gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back and Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
