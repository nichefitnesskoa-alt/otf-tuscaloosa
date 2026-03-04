import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ClipboardCheck, ArrowLeft, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getLocalDateString } from '@/lib/utils';
import { getTodayStartISO, getTomorrowStartISO } from '@/lib/dateUtils';
import { isMembershipSale } from '@/lib/sales-detection';

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
  soldNames: string[];
  noShow: number;
  followUpNeeded: number;
  followUpPurchases: number;
  followUpPurchaseNames: string[];
  calls: number;
  texts: number;
  dms: number;
  shiftType: string;
  qSent: number;
  qCompleted: number;
  scriptsSent: number;
  followUpTouches: number;
  introsPrepped: number;
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

  useEffect(() => {
    if (!open || !user?.name) return;
    fetchSummary();
  }, [open, user?.name]);

  const fetchSummary = async () => {
    if (!user?.name) return;
    setLoadingSummary(true);
    const today = getLocalDateString();
    const todayStart = getTodayStartISO();
    const tomorrowStart = getTomorrowStartISO();

    try {
      // Intros booked today by this SA (exclude VIP/COMP)
      const [bookedByShift, bookedByAttrib] = await Promise.all([
        supabase.from('intros_booked').select('id, booking_type_canon')
          .gte('created_at', todayStart).lt('created_at', tomorrowStart)
          .eq('sa_working_shift', user.name).is('deleted_at', null),
        supabase.from('intros_booked').select('id, booking_type_canon')
          .gte('created_at', todayStart).lt('created_at', tomorrowStart)
          .eq('booked_by', user.name).is('deleted_at', null),
      ]);
      const allBookedIds = new Set<string>();
      for (const b of [...(bookedByShift.data || []), ...(bookedByAttrib.data || [])]) {
        if ((b as any).booking_type_canon !== 'VIP' && (b as any).booking_type_canon !== 'COMP') {
          allBookedIds.add(b.id);
        }
      }

      // Intros ran today
      const { data: ran } = await supabase.from('intros_run')
        .select('member_name, result, result_canon, buy_date, run_date, intro_owner, sa_name')
        .or(`sa_name.eq.${user.name},intro_owner.eq.${user.name}`)
        .eq('run_date', today);

      const sameDaySales = (ran || []).filter(r => {
        const effectiveDate = r.buy_date || r.run_date || '';
        return effectiveDate === today && isMembershipSale(r.result);
      });
      const soldNames = sameDaySales.map(r => `${r.member_name}: ${r.result}`);

      const noShowCnt = (ran || []).filter(r => r.result_canon === 'NO_SHOW' || r.result === 'No-show').length;
      const followUpNeeded = (ran || []).filter(r =>
        ['FOLLOW_UP_NEEDED', 'UNRESOLVED'].includes(r.result_canon || '') && r.result !== 'No-show'
      ).length;

      // Follow-up purchases (buy_date = today, run_date != today)
      const { data: fuPurch } = await supabase.from('intros_run')
        .select('member_name, result, intro_owner, sa_name')
        .eq('buy_date', today)
        .neq('run_date', today)
        .or(`sa_name.eq.${user.name},intro_owner.eq.${user.name}`);
      const fuPurchNames = (fuPurch || []).map(r => `${r.member_name}: ${r.result}`);

      // Shift activity
      const hour = new Date().getHours();
      const shiftType = hour < 12 ? 'AM Shift' : hour < 16 ? 'Mid Shift' : 'PM Shift';

      const [shiftDataRes, qSentRes, qCompletedRes, scriptsRes, fuTouchesRes, preppedRes] = await Promise.all([
        supabase.from('shift_recaps')
          .select('calls_made, texts_sent, dms_sent, shift_type')
          .eq('staff_name', user.name).eq('shift_date', today)
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('intros_booked')
          .select('id', { count: 'exact', head: true })
          .gte('questionnaire_sent_at', todayStart).lt('questionnaire_sent_at', tomorrowStart)
          .or(`sa_working_shift.eq.${user.name},booked_by.eq.${user.name}`),
        supabase.from('intros_booked')
          .select('id', { count: 'exact', head: true })
          .gte('questionnaire_completed_at', todayStart).lt('questionnaire_completed_at', tomorrowStart),
        supabase.from('script_actions')
          .select('id', { count: 'exact', head: true })
          .eq('action_type', 'script_sent').eq('completed_by', user.name)
          .gte('completed_at', todayStart).lt('completed_at', tomorrowStart),
        supabase.from('followup_touches')
          .select('id', { count: 'exact', head: true })
          .eq('created_by', user.name)
          .gte('created_at', todayStart).lt('created_at', tomorrowStart),
        supabase.from('intros_booked')
          .select('id', { count: 'exact', head: true })
          .eq('prepped', true)
          .gte('prepped_at', todayStart).lt('prepped_at', tomorrowStart),
      ]);

      const shiftData = shiftDataRes.data;

      setSummary({
        booked: allBookedIds.size,
        ran: (ran || []).length,
        sold: sameDaySales.length,
        soldNames,
        noShow: noShowCnt,
        followUpNeeded,
        followUpPurchases: (fuPurch || []).length,
        followUpPurchaseNames: fuPurchNames,
        calls: shiftData?.calls_made ?? 0,
        texts: shiftData?.texts_sent ?? 0,
        dms: shiftData?.dms_sent ?? 0,
        shiftType: shiftData?.shift_type || shiftType,
        qSent: qSentRes.count ?? 0,
        qCompleted: qCompletedRes.count ?? 0,
        scriptsSent: scriptsRes.count ?? 0,
        followUpTouches: fuTouchesRes.count ?? 0,
        introsPrepped: preppedRes.count ?? 0,
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

      // 1. Save / upsert shift recap
      const { data: existing } = await supabase.from('shift_recaps')
        .select('id').eq('staff_name', user.name).eq('shift_date', today)
        .limit(1).maybeSingle();

      let recapId: string;
      if (existing) {
        await supabase.from('shift_recaps')
          .update({ submitted_at: new Date().toISOString() }).eq('id', existing.id);
        recapId = existing.id;
      } else {
        const { data: newRecap } = await supabase.from('shift_recaps')
          .insert({
            staff_name: user.name,
            shift_date: today,
            shift_type: summary.shiftType,
            submitted_at: new Date().toISOString(),
          }).select('id').single();
        recapId = newRecap?.id || '';
      }

      // 2. Call edge function to build message server-side and post to GroupMe
      let groupMePosted = false;
      try {
        const { data: gmData, error: gmError } = await supabase.functions.invoke('post-groupme', {
          body: {
            action: 'post',
            staffName: user.name,
            date: today,
            shiftType: summary.shiftType,
          },
        });

        if (gmError || !gmData?.success) {
          console.error('GroupMe post failed:', gmError || gmData?.error);
        } else {
          groupMePosted = true;
        }
      } catch (gmErr) {
        console.error('GroupMe exception:', gmErr);
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

  const SummaryRow = ({ label, value, highlight, detail }: { label: string; value: number; highlight?: boolean; detail?: string }) => (
    <div className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-semibold tabular-nums ${highlight ? 'text-primary' : ''}`}>{value}</span>
        {detail && <p className="text-[10px] text-muted-foreground max-w-[180px] truncate">{detail}</p>}
      </div>
    </div>
  );

  const formatNames = (names: string[], max = 3) => {
    if (names.length === 0) return undefined;
    const shown = names.slice(0, max).join(', ');
    return names.length > max ? `${shown} +${names.length - max} more` : shown;
  };

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
              <div className="bg-muted/50 rounded-lg px-3 py-2 text-center">
                <p className="text-xs font-semibold text-foreground">{user?.name} — {summary.shiftType}</p>
                <p className="text-[11px] text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
              </div>

              {/* Intros */}
              <div className="rounded-lg border border-border/60 overflow-hidden">
                <div className="px-3 py-1.5 bg-muted/40 border-b border-border/40">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">📅 Intros</span>
                </div>
                <div className="px-3 py-1">
                  <SummaryRow label="Booked" value={summary.booked} />
                  <SummaryRow label="Ran" value={summary.ran} />
                  <SummaryRow label="Sold" value={summary.sold} highlight detail={formatNames(summary.soldNames)} />
                  <SummaryRow label="No-Show" value={summary.noShow} />
                  <SummaryRow label="Follow-Up Needed" value={summary.followUpNeeded} />
                </div>
              </div>

              {/* Follow-Up Purchases */}
              <div className="rounded-lg border border-border/60 overflow-hidden">
                <div className="px-3 py-1.5 bg-muted/40 border-b border-border/40">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">💳 Follow-Up Purchases</span>
                </div>
                <div className="px-3 py-1">
                  <SummaryRow label="Purchases" value={summary.followUpPurchases} highlight detail={formatNames(summary.followUpPurchaseNames)} />
                </div>
              </div>

              {/* Prep & Q */}
              <div className="rounded-lg border border-border/60 overflow-hidden">
                <div className="px-3 py-1.5 bg-muted/40 border-b border-border/40">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">📋 Prep & Questionnaires</span>
                </div>
                <div className="px-3 py-1">
                  <SummaryRow label="Questionnaires Sent" value={summary.qSent} />
                  <SummaryRow label="Questionnaires Completed" value={summary.qCompleted} />
                  <SummaryRow label="Intros Prepped" value={summary.introsPrepped} />
                  <SummaryRow label="Scripts Sent" value={summary.scriptsSent} />
                </div>
              </div>

              {/* Contacts & Follow-Ups */}
              <div className="rounded-lg border border-border/60 overflow-hidden">
                <div className="px-3 py-1.5 bg-muted/40 border-b border-border/40">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">📞 Contacts & Follow-Ups</span>
                </div>
                <div className="px-3 py-1">
                  <SummaryRow label="Calls" value={summary.calls} />
                  <SummaryRow label="Texts" value={summary.texts} />
                  <SummaryRow label="IG DMs" value={summary.dms} />
                  <SummaryRow label="Follow-Up Touches" value={summary.followUpTouches} />
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
