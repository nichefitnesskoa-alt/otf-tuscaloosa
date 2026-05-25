import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useData } from '@/context/DataContext';
import { DateRange } from '@/lib/pay-period';
import { computeSourceMembership, DriftItem, FixAction } from '@/lib/metrics/sourceMembership';
import { useActiveStaff } from '@/hooks/useActiveStaff';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Props {
  dateRange: DateRange | null;
  showWhenInSync?: boolean;
}

const REASON_LABEL: Record<DriftItem['reasonCode'], string> = {
  orphan_parent_excluded: 'Orphan — points at excluded parent',
  missing_intro_owner: 'Missing intro_owner',
  excluded_sa_owner: 'intro_owner is excluded staff',
  second_intro_outside_funnel_first: '2nd intro outside scoreboard set',
  first_intro_suppressed_by_passed_second: '1st intro suppressed by passed 2nd',
  booking_excluded_but_run_counted: 'Booking excluded, run still counted',
  no_ran_run: 'No ran run found',
  unknown: 'Unknown cause',
};

export function MetricsConsistencyAlert({ dateRange, showWhenInSync = false }: Props) {
  const { introsBooked, introsRun, refreshData } = useData();
  const { allActive } = useActiveStaff();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(true);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ownerDraft, setOwnerDraft] = useState<Record<string, string>>({});

  const { scoreboardRan, perSARan, funnelRan, drift } = useMemo(
    () => computeSourceMembership({ introsBooked, introsRun, dateRange }),
    [introsBooked, introsRun, dateRange],
  );

  const sources = [
    { label: 'Studio Scoreboard', ran: scoreboardRan },
    { label: 'Per-SA Runner Stats', ran: perSARan },
    { label: 'Conversion Funnel', ran: funnelRan },
  ];
  const ranValues = sources.map(s => s.ran);
  const ranDrift = Math.max(...ranValues) - Math.min(...ranValues);
  const inSync = ranDrift === 0 && drift.length === 0;

  if (inSync && !showWhenInSync) return null;

  if (inSync) {
    return (
      <Card className="border-success/40 bg-success-dim">
        <CardContent className="flex items-center gap-2 p-3">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <p className="text-xs text-text-primary">
            Scoreboard, Per-SA, and Conversion Funnel all agree on intros ran.
          </p>
        </CardContent>
      </Card>
    );
  }

  const applyFix = async (item: DriftItem, action: FixAction) => {
    setBusyId(item.bookingId + action);
    try {
      if (action === 'promote_to_first_intro') {
        const { error } = await supabase
          .from('intros_booked')
          .update({ originating_booking_id: null, last_edited_by: 'Drift Fix', last_edited_at: new Date().toISOString() })
          .eq('id', item.bookingId);
        if (error) throw error;
        toast({ title: 'Promoted to 1st intro', description: item.memberName });
      } else if (action === 'assign_intro_owner') {
        const newOwner = ownerDraft[item.bookingId];
        if (!newOwner) {
          toast({ title: 'Pick an owner first', variant: 'destructive' });
          setBusyId(null);
          return;
        }
        // Update both the run (where Per-SA reads from) and the booking
        const [bRes, rRes] = await Promise.all([
          supabase.from('intros_booked').update({
            intro_owner: newOwner,
            intro_owner_locked: true,
            last_edited_by: 'Drift Fix',
            last_edited_at: new Date().toISOString(),
          }).eq('id', item.bookingId),
          supabase.from('intros_run').update({ intro_owner: newOwner })
            .eq('linked_intro_booked_id', item.bookingId),
        ]);
        if (bRes.error) throw bRes.error;
        if (rRes.error) throw rRes.error;
        toast({ title: `Owner set to ${newOwner}`, description: item.memberName });
      } else if (action === 'toggle_ignore_metrics') {
        const current = (introsBooked.find(b => b.id === item.bookingId) as any)?.ignore_from_metrics === true;
        const { error } = await supabase
          .from('intros_booked')
          .update({ ignore_from_metrics: !current, last_edited_by: 'Drift Fix', last_edited_at: new Date().toISOString() })
          .eq('id', item.bookingId);
        if (error) throw error;
        toast({ title: current ? 'Re-included in metrics' : 'Excluded from metrics', description: item.memberName });
      } else if (action === 'toggle_vip') {
        const current = (introsBooked.find(b => b.id === item.bookingId) as any)?.is_vip === true;
        const { error } = await supabase
          .from('intros_booked')
          .update({ is_vip: !current, last_edited_by: 'Drift Fix', last_edited_at: new Date().toISOString() })
          .eq('id', item.bookingId);
        if (error) throw error;
        toast({ title: current ? 'VIP flag cleared' : 'Flagged VIP', description: item.memberName });
      }
      await refreshData();
    } catch (err: any) {
      toast({ title: 'Fix failed', description: err?.message || String(err), variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="border-danger bg-danger-dim">
      <CardContent className="p-3 space-y-3">
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="flex w-full items-center gap-2 text-left cursor-pointer"
        >
          {expanded ? <ChevronDown className="h-4 w-4 text-danger" /> : <ChevronRight className="h-4 w-4 text-danger" />}
          <AlertTriangle className="h-4 w-4 text-danger" />
          <span className="text-sm font-semibold text-danger">
            Metrics disagree for the selected date range
          </span>
          <span className="ml-auto text-[11px] text-text-secondary">
            {drift.length} affected booking{drift.length === 1 ? '' : 's'}
          </span>
        </button>

        {expanded && (
          <>
            <div className="overflow-hidden rounded border border-danger/30">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-danger-dim text-text-primary">
                    <th className="px-2 py-1 text-left font-medium">Source</th>
                    <th className="px-2 py-1 text-right font-medium">Intros Ran</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map(s => (
                    <tr key={s.label} className="border-t border-danger/20 text-text-primary">
                      <td className="px-2 py-1">{s.label}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{s.ran}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                Offenders
              </p>
              {drift.length === 0 && (
                <p className="text-xs text-text-secondary">
                  Drift detected in totals but no per-booking discrepancy could be isolated.
                  Likely a sale pulled forward from outside the date range.
                </p>
              )}
              {drift.map(item => {
                const isOpen = openRow === item.bookingId;
                return (
                  <div
                    key={item.bookingId}
                    className="rounded border border-danger/20 bg-background/40"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenRow(isOpen ? null : item.bookingId)}
                      className="flex w-full items-start gap-2 p-2 text-left cursor-pointer hover:bg-danger/5"
                    >
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5 mt-0.5 text-text-secondary" /> : <ChevronRight className="h-3.5 w-3.5 mt-0.5 text-text-secondary" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-xs font-semibold text-text-primary">{item.memberName}</span>
                          <span className="text-[11px] text-text-secondary">{item.classDate}</span>
                          <span className="text-[11px] text-text-secondary">
                            owner: {item.introOwner || <em className="text-danger">none</em>}
                          </span>
                        </div>
                        <p className="text-[11px] text-text-secondary mt-0.5">
                          {REASON_LABEL[item.reasonCode]} — {item.reasonText}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(['Scoreboard', 'Per-SA', 'Funnel'] as const).map(s => (
                            <span
                              key={s}
                              className={cn(
                                'inline-block rounded px-1.5 py-0.5 text-[10px] font-medium',
                                item.in.includes(s)
                                  ? 'bg-success/20 text-success'
                                  : 'bg-danger/20 text-danger',
                              )}
                            >
                              {item.in.includes(s) ? '✓' : '✗'} {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-danger/20 p-2 space-y-2">
                        <div className="flex flex-wrap gap-2 items-center">
                          {item.suggestedFixes.includes('promote_to_first_intro') && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyId === item.bookingId + 'promote_to_first_intro'}
                              onClick={() => applyFix(item, 'promote_to_first_intro')}
                            >
                              {busyId === item.bookingId + 'promote_to_first_intro' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                              Promote to 1st intro
                            </Button>
                          )}
                          {item.suggestedFixes.includes('assign_intro_owner') && (
                            <div className="flex items-center gap-1">
                              <Select
                                value={ownerDraft[item.bookingId] || ''}
                                onValueChange={v => setOwnerDraft(d => ({ ...d, [item.bookingId]: v }))}
                              >
                                <SelectTrigger className="h-8 w-40 text-xs">
                                  <SelectValue placeholder="Pick owner" />
                                </SelectTrigger>
                                <SelectContent>
                                  {allActive.map(n => (
                                    <SelectItem key={n} value={n}>{n}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busyId === item.bookingId + 'assign_intro_owner'}
                                onClick={() => applyFix(item, 'assign_intro_owner')}
                              >
                                {busyId === item.bookingId + 'assign_intro_owner' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                                Assign owner
                              </Button>
                            </div>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId === item.bookingId + 'toggle_ignore_metrics'}
                            onClick={() => applyFix(item, 'toggle_ignore_metrics')}
                          >
                            {busyId === item.bookingId + 'toggle_ignore_metrics' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                            Toggle ignore_from_metrics
                          </Button>
                        </div>
                        <p className="text-[10px] text-text-secondary font-mono break-all">
                          booking_id: {item.bookingId}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
