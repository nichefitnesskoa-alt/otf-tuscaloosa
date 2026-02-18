import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ClipboardCheck, CheckCircle2, MessageSquare, Users, Calendar, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getLocalDateString } from '@/lib/utils';

interface SaleLineItem {
  memberName: string;
  tier: string;
  commission: number;
  saleType: 'intro' | 'walk-in' | 'upgrade' | 'hrm-addon' | 'follow-up';
}

interface CloseOutShiftProps {
  completedIntros: number;
  activeIntros: number;
  scriptsSent: number;
  followUpsSent: number;
  purchaseCount: number;
  noShowCount: number;
  didntBuyCount: number;
  topObjection?: string | null;
  /** If provided, the dialog is controlled externally */
  forceOpen?: boolean;
  onForceOpenChange?: (open: boolean) => void;
  /** Render always as a small button (for use in floating header) */
  asButton?: boolean;
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
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [visible, setVisible] = useState(false);
  const [saleItems, setSaleItems] = useState<SaleLineItem[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);

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

  // Fetch sale line items whenever dialog opens
  useEffect(() => {
    if (!open || !user?.name) return;
    fetchSaleItems();
  }, [open, user?.name]);

  const fetchSaleItems = async () => {
    if (!user?.name) return;
    setLoadingSales(true);
    const today = getLocalDateString();

    try {
      // 1) Intro-linked sales from intros_run — filter by buy_date = today, attributed to this SA
      const SALE_RESULTS = ['Premier + OTbeat', 'Premier', 'Elite + OTbeat', 'Elite', 'Basic + OTbeat', 'Basic'];
      const { data: introSales } = await supabase
        .from('intros_run')
        .select('member_name, result, commission_amount, buy_date, run_date, intro_owner, sa_name, lead_source')
        .or(`intro_owner.eq.${user.name},sa_name.eq.${user.name}`)
        .in('result', SALE_RESULTS);

      // Filter: buy_date = today (fallback to run_date = today)
      const filteredIntroSales = (introSales || []).filter(r => {
        const effectiveDate = r.buy_date || r.run_date || '';
        return effectiveDate === today;
      });

      const introItems: SaleLineItem[] = filteredIntroSales.map(r => ({
        memberName: r.member_name,
        tier: r.result,
        commission: Number(r.commission_amount) || 0,
        saleType: 'intro' as const,
      }));

      // 2) Outside sales (walk-ins, upgrades, HRM add-ons) from sales_outside_intro
      const { data: outsideSales } = await supabase
        .from('sales_outside_intro')
        .select('member_name, membership_type, commission_amount, date_closed, sale_type, intro_owner')
        .eq('intro_owner', user.name)
        .eq('date_closed', today);

      const outsideItems: SaleLineItem[] = (outsideSales || []).map(r => {
        let saleType: SaleLineItem['saleType'] = 'walk-in';
        if (r.sale_type === 'hrm_addon') saleType = 'hrm-addon';
        else if (r.sale_type === 'upgrade') saleType = 'upgrade';
        return {
          memberName: r.member_name,
          tier: r.membership_type,
          commission: Number(r.commission_amount) || 0,
          saleType,
        };
      });

      setSaleItems([...introItems, ...outsideItems]);
    } catch (err) {
      console.error('End shift sale fetch error:', err);
    } finally {
      setLoadingSales(false);
    }
  };

  const totalCommission = saleItems.reduce((sum, s) => sum + s.commission, 0);

  const saleTypeLabel: Record<SaleLineItem['saleType'], string> = {
    'intro': 'Intro',
    'walk-in': 'Walk-In',
    'upgrade': 'Upgrade',
    'hrm-addon': 'HRM Add-On',
    'follow-up': 'Follow-Up',
  };

  const handleSubmit = async () => {
    if (!user?.name) return;
    setSubmitting(true);

    try {
      const today = getLocalDateString();
      const hour = new Date().getHours();
      const shiftType = hour < 12 ? 'AM Shift' : hour < 16 ? 'Mid Shift' : 'PM Shift';

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
          .update({
            other_info: notes || null,
            submitted_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        recapId = existing.id;
      } else {
        const { data: newRecap } = await supabase
          .from('shift_recaps')
          .insert({
            staff_name: user.name,
            shift_date: today,
            shift_type: shiftType,
            other_info: notes || null,
            submitted_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        recapId = newRecap?.id || '';
      }

      // Post to GroupMe
      try {
        const saleLines = saleItems.length > 0
          ? saleItems.map(s => `  • ${s.memberName} — ${s.tier} ($${s.commission.toFixed(2)})`).join('\n')
          : '  None';

        const summary = [
          `📋 ${user.name} — Shift Close Out`,
          `📅 ${format(new Date(), 'EEEE MMM d')}`,
          ``,
          `Intros: ${completedIntros} logged (${saleItems.length} sales, ${didntBuyCount} didn't buy, ${noShowCount} no-show)`,
          `Sales:`,
          saleLines,
          `Total Commission: $${totalCommission.toFixed(2)}`,
          `Follow-ups: ${followUpsSent} sent`,
          `Scripts: ${scriptsSent} sent`,
          topObjection ? `Top objection: ${topObjection}` : '',
          notes ? `\nNotes: ${notes}` : '',
        ].filter(Boolean).join('\n');

        await supabase.functions.invoke('post-groupme', {
          body: { text: summary },
        });
      } catch (err) {
        console.error('GroupMe post error:', err);
      }

      await refreshData();
      toast.success('Shift closed out! Great work today.');
      setOpen(false);
    } catch (err) {
      console.error('Close out error:', err);
      toast.error('Failed to close out shift');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Inline button — when asButton prop is true OR when conditions are met */}
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
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-primary" />
              End Shift
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <Calendar className="w-4 h-4 mx-auto mb-1 text-primary" />
                <p className="text-xl font-bold">{completedIntros}</p>
                <p className="text-[10px] text-muted-foreground">Intros Ran</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <CheckCircle2 className="w-4 h-4 mx-auto mb-1 text-primary" />
                <p className="text-xl font-bold">{saleItems.length || purchaseCount}</p>
                <p className="text-[10px] text-muted-foreground">Sales Today</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <MessageSquare className="w-4 h-4 mx-auto mb-1 text-info" />
                <p className="text-xl font-bold">{scriptsSent}</p>
                <p className="text-[10px] text-muted-foreground">Scripts Sent</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <Users className="w-4 h-4 mx-auto mb-1 text-warning" />
                <p className="text-xl font-bold">{followUpsSent}</p>
                <p className="text-[10px] text-muted-foreground">Follow-Ups</p>
              </div>
            </div>

            {/* Sale line items */}
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border/40">
                <span className="text-xs font-semibold">Sales This Shift</span>
                {totalCommission > 0 && (
                  <span className="text-xs font-bold text-primary flex items-center gap-0.5">
                    <DollarSign className="w-3 h-3" />{totalCommission.toFixed(2)}
                  </span>
                )}
              </div>
              {loadingSales ? (
                <p className="text-xs text-muted-foreground px-3 py-2">Loading…</p>
              ) : saleItems.length === 0 ? (
                <p className="text-xs text-muted-foreground px-3 py-2 italic">No sales recorded today</p>
              ) : (
                <div className="divide-y divide-border/30">
                  {saleItems.map((s, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                      <div className="flex flex-col">
                        <span className="font-medium">{s.memberName}</span>
                        <span className="text-muted-foreground">{s.tier}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[9px] px-1 h-4">
                          {saleTypeLabel[s.saleType]}
                        </Badge>
                        <span className="font-semibold text-primary">${s.commission.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* No-shows / Didn't buy / Pending / Objection */}
            <div className="text-xs space-y-1 px-1">
              {noShowCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">No-shows</span>
                  <span className="font-medium text-destructive">{noShowCount}</span>
                </div>
              )}
              {didntBuyCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Didn't buy</span>
                  <span className="font-medium">{didntBuyCount}</span>
                </div>
              )}
              {activeIntros > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Still pending</span>
                  <Badge variant="outline" className="text-[10px]">{activeIntros}</Badge>
                </div>
              )}
              {topObjection && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Top objection</span>
                  <span className="font-medium">{topObjection}</span>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Anything to add?
              </label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Shift notes, equipment issues, member interactions..."
                className="text-sm min-h-[60px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit & Post to GroupMe'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
