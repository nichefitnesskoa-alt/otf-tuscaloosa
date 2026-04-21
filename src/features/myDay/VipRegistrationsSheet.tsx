/**
 * Privacy-first VIP group sheet: shows ONLY the group name + total registration count
 * + an outcome roll-up. No individual registrant names, phones, or PII rendered.
 *
 * The coach picker stays at the top — it's required for VIP-class sale attribution.
 *
 * When an attendee actually books a follow-up intro, that's done through the standard
 * Book Intro sheet on the floor (with lead_source = 'VIP Class' + vip_session_id),
 * and the SA logs the outcome on the resulting intro card via the standard OutcomeDrawer.
 */
import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { COACHES } from '@/types';

interface RegRow {
  id: string;
  outcome: string | null;
}

const OUTCOME_LABELS: Record<string, string> = {
  showed: 'showed',
  no_show: 'no-show',
  interested: 'interested',
  not_interested: 'not interested',
  booked_intro: 'booked intro',
  purchased: 'purchased',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vipSessionId: string;
  vipGroupName: string | null;
  userName: string;
}

export default function VipRegistrationsSheet({ open, onOpenChange, vipSessionId, vipGroupName }: Props) {
  const [loading, setLoading] = useState(false);
  const [regs, setRegs] = useState<RegRow[]>([]);
  const [vipCoach, setVipCoach] = useState<string>('');
  const [savingCoach, setSavingCoach] = useState(false);

  useEffect(() => {
    if (!open || !vipSessionId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [{ data, error }, { data: sessionRow }] = await Promise.all([
        supabase
          .from('vip_registrations' as any)
          .select('id, outcome')
          .eq('vip_session_id', vipSessionId)
          .eq('is_group_contact', false),
        supabase
          .from('vip_sessions' as any)
          .select('coach_name')
          .eq('id', vipSessionId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (error) {
        toast.error('Failed to load registrations');
        setRegs([]);
      } else {
        setRegs((data as any as RegRow[]) || []);
      }
      setVipCoach((sessionRow as any)?.coach_name || '');
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, vipSessionId]);

  const saveVipCoach = async (coach: string) => {
    setVipCoach(coach);
    setSavingCoach(true);
    try {
      const { error } = await supabase
        .from('vip_sessions' as any)
        .update({ coach_name: coach || null })
        .eq('id', vipSessionId);
      if (error) throw error;
      toast.success('VIP class coach saved');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save coach');
    } finally {
      setSavingCoach(false);
    }
  };

  const totalRegistered = regs.length;
  const outcomeBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of regs) {
      if (!r.outcome) continue;
      counts.set(r.outcome, (counts.get(r.outcome) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([k, v]) => `${v} ${OUTCOME_LABELS[k] || k}`)
      .join(' · ');
  }, [regs]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{vipGroupName || 'VIP Group'}</SheetTitle>
          <SheetDescription>
            {totalRegistered} registered for this VIP class. We don't store names — privacy by design.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1.5">
          <Label className="text-xs font-semibold">
            Who coached this VIP class? <span className="text-destructive">*</span>
          </Label>
          <Select value={vipCoach} onValueChange={saveVipCoach} disabled={savingCoach}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Select VIP class coach…" />
            </SelectTrigger>
            <SelectContent>
              {COACHES.map(c => (
                <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">
            Sale credits go to this coach for any VIP-class attendee who buys — even if a different coach runs their follow-up intro.
          </p>
        </div>

        <div className="mt-4 rounded-lg border bg-card p-4 space-y-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2.5">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold leading-tight">{totalRegistered}</div>
                  <div className="text-xs text-muted-foreground">people registered</div>
                </div>
              </div>
              {outcomeBreakdown && (
                <div className="text-xs text-muted-foreground border-t pt-2">
                  {outcomeBreakdown}
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Booked an intro from this group?</strong> Use the standard
            Book Intro sheet on the floor — set lead source to <em>VIP Class</em>. The booking will tie back
            to this session automatically and credit the coach above on any sale.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
