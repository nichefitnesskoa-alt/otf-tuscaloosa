/**
 * SA Weekly Goals — Own It view of the SA WIG numbers for the SELECTED
 * meeting week (driven by parent `weekStart` prop).
 *
 * Single source of truth: shares the SAME canonical helpers as WIG so the
 * numbers and color can never disagree.
 *   - useSaLeads        → self-generated leads (SGL)
 *   - useSaLeadsBooked  → booked intros (SGL-only path)
 *   - useSaSales        → sales
 *   - targets via src/lib/wig/targets.ts (monthly, adjustable)
 *   - pace/color via src/lib/wig/pace.ts
 *
 * All three tiles are MONTHLY. No weekly slicing. The displayed count is
 * the SA's progress in the current calendar month at this moment; the
 * goal is the monthly target; pace + color score against pace-to-today.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Check, Flag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { isAdmin as isAdminCheck, isSALike } from '@/lib/auth/roles';
import { useSaLeads } from '@/hooks/useSaLeads';
import { useSaLeadsBooked } from '@/hooks/useSaLeadsBooked';
import { useSaSales } from '@/hooks/useSaSales';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { notifyDataChanged } from '@/lib/data/invalidation';
import { toast } from 'sonner';
import { loadMonthlyTargets, type MonthlyTargets } from '@/lib/wig/targets';
import { paceToToday, statusColor, statusClasses, formatPace } from '@/lib/wig/pace';
import { parseLocalDate, getNowCentral } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { useSomlEffectiveTargets, somlPaceAnchor } from '@/lib/soml/effectiveTargets';
import { useTrailingConversion, deriveBookedTargetFromSales } from '@/lib/wig/derivedBookedTarget';

const DEFAULT_VISION = "Double last June's leads. 182 total.";

interface Props {
  /** Monday YYYY-MM-DD for the selected meeting week (from TheTable). */
  weekStart: string;
}

export function SaWeeklyGoals({ weekStart }: Props) {
  const { user } = useAuth();
  const isAdmin = isAdminCheck(user);
  const showForUser = isAdmin || isSALike(user);

  // Anchor goals to the calendar month of the selected week's Monday.
  const monthAnchor = useMemo(() => parseLocalDate(weekStart) || getNowCentral(), [weekStart]);
  const monthStartYMD = useMemo(() => format(startOfMonth(monthAnchor), 'yyyy-MM-dd'), [monthAnchor]);
  const monthEndYMD = useMemo(() => format(endOfMonth(monthAnchor), 'yyyy-MM-dd'), [monthAnchor]);
  const yyyymm = useMemo(() => format(monthAnchor, 'yyyy-MM'), [monthAnchor]);
  const monthLabel = format(monthAnchor, 'MMMM');

  const sgl = useSaLeads(monthStartYMD, monthEndYMD);
  const booked = useSaLeadsBooked(monthStartYMD, monthEndYMD);
  const sales = useSaSales(monthStartYMD, monthEndYMD);

  // Sales + Booked targets read from SOML (soml_config + soml_sa_goals) — the
  // real numbers Koa set — via the canonical effectiveTargets resolver. Same
  // path ShiftOutcomeHeader and SomlSection use. Never the flat
  // studio_settings.sa_sales_target.
  const somlTargets = useSomlEffectiveTargets();
  const { data: trailing } = useTrailingConversion();

  const [targets, setTargets] = useState<MonthlyTargets>({
    saSgl: null, saBooked: null, saSales: null, coachClose: null, studioLeads: null, netGain: null,
  });
  const [vision, setVision] = useState(DEFAULT_VISION);
  const [editingVision, setEditingVision] = useState(false);
  const [visionInput, setVisionInput] = useState(DEFAULT_VISION);
  const [visionSaved, setVisionSaved] = useState(false);

  const loadSettings = useCallback(async () => {
    const t = await loadMonthlyTargets(yyyymm);
    setTargets(t);
    const { data } = await supabase
      .from('studio_settings')
      .select('setting_value')
      .eq('setting_key', `sa_wig_vision:${yyyymm}`)
      .maybeSingle();
    const v = (data as any)?.setting_value || DEFAULT_VISION;
    setVision(v); setVisionInput(v);
  }, [yyyymm]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const saveVision = async () => {
    const key = `sa_wig_vision:${yyyymm}`;
    const value = (visionInput || '').trim() || DEFAULT_VISION;
    const { error } = await supabase
      .from('studio_settings')
      .upsert(
        {
          setting_key: key,
          setting_value: value,
          updated_by: user?.name || 'unknown',
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: 'setting_key' },
      );
    if (error) { toast.error('Failed to save vision'); return; }
    setVision(value); setEditingVision(false); setVisionSaved(true);
    setTimeout(() => setVisionSaved(false), 2000);
    notifyDataChanged(['sa_wig_vision'], 'sa-wig-vision-edit');
  };

  if (!showForUser || !user?.name) return null;

  const mySgl = sgl.rows.find(r => r.sa === user.name)?.count ?? 0;
  const myBooked = booked.rows.find(r => r.sa === user.name)?.count ?? 0;
  const mySales = sales.rows.find(r => r.sa === user.name)?.count ?? 0;

  // Pace anchors to "today in CST" inside the target month. For past months
  // the cap clamps pace to the full monthly target.
  const today = getNowCentral();
  const paceAnchor =
    today < startOfMonth(monthAnchor) ? startOfMonth(monthAnchor)
    : today > endOfMonth(monthAnchor) ? endOfMonth(monthAnchor)
    : today;

  const pace = {
    sgl: paceToToday(targets.saSgl, paceAnchor),
    booked: paceToToday(targets.saBooked, paceAnchor),
    sales: paceToToday(targets.saSales, paceAnchor),
  };

  const tiles = [
    { label: 'Leads (self-generated)', current: mySgl, target: targets.saSgl, pace: pace.sgl },
    { label: 'Booked intros', current: myBooked, target: targets.saBooked, pace: pace.booked },
    { label: 'Sales', current: mySales, target: targets.saSales, pace: pace.sales },
  ];

  return (
    <Card className="p-4 mb-4 border-brand/40 bg-gradient-to-br from-brand/5 to-transparent">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Flag className="w-4 h-4 text-brand shrink-0" />
          {editingVision ? (
            <div className="flex items-center gap-1 flex-1">
              <Input
                value={visionInput}
                onChange={e => setVisionInput(e.target.value)}
                className="h-7 text-xs"
                placeholder={DEFAULT_VISION}
              />
              <Button size="sm" className="h-7 px-2" onClick={saveVision}>Save</Button>
              <Button size="sm" variant="ghost" className="h-7 px-2"
                onClick={() => { setEditingVision(false); setVisionInput(vision); }}>Cancel</Button>
            </div>
          ) : (
            <p className="text-sm font-semibold text-foreground truncate">{vision}</p>
          )}
        </div>
        {!editingVision && isAdmin && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs shrink-0"
            onClick={() => setEditingVision(true)}>
            {visionSaved ? <><Check className="w-3 h-3 mr-1" />Saved</> : <Pencil className="w-3 h-3" />}
          </Button>
        )}
      </div>

      <div className="text-[11px] text-muted-foreground mb-2">
        Your numbers this month · {monthLabel}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {tiles.map(t => {
          const s = statusColor(t.current, t.pace);
          const sCls = statusClasses(s);
          const pct = t.target && t.target > 0 ? Math.min(100, (t.current / t.target) * 100) : 0;
          return (
            <div key={t.label} className="rounded-md border bg-card p-3">
              <p className="text-[11px] text-muted-foreground">{t.label}</p>
              <p className="mt-0.5">
                <span className={cn('text-2xl font-bold tabular-nums', sCls.text)}>{t.current}</span>
                <span className="text-sm text-muted-foreground">
                  {' of '}
                  {t.target ?? <em className="not-italic text-warning text-xs">set</em>}
                </span>
              </p>
              <div className="mt-1 w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                <div className={cn('h-full rounded-full', sCls.bar)} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                pace today {formatPace(t.pace)}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
