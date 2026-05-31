/**
 * SA Weekly Goals — Own It view of the two SA WIG numbers.
 *
 * Reads the SAME canonical helpers as WIG so the numbers can never disagree:
 *   - useSaLeadsBooked  (target: studio_settings sa_leads_booked_target:YYYY-MM, default 4)
 *   - useSaSales        (target: studio_settings sa_sales_target:YYYY-MM, default 1)
 *
 * Vision line: studio_settings key `sa_wig_vision:YYYY-MM`, editable by Admin.
 *
 * Visible to SA / Both / Admin. Scoped to the CURRENT CST Monday-week,
 * independent of the meeting weekDate stepper.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Check, Flag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { isAdmin as isAdminCheck, isSALike } from '@/lib/auth/roles';
import { useSaLeadsBooked } from '@/hooks/useSaLeadsBooked';
import { useSaSales } from '@/hooks/useSaSales';
import { getNowCentral } from '@/lib/dateUtils';
import { format } from 'date-fns';
import { notifyDataChanged } from '@/lib/data/invalidation';
import { toast } from 'sonner';

const DEFAULT_LEADS_TARGET = 4;
const DEFAULT_SALES_TARGET = 1;
const DEFAULT_VISION = "Double last June's leads. 182 total.";

// Monday of the current CST week, YYYY-MM-DD.
function currentMondayYMD(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  });
  const parts = fmt.formatToParts(new Date());
  const day = parts.find(p => p.type === 'weekday')!.value;
  const y = +parts.find(p => p.type === 'year')!.value;
  const m = +parts.find(p => p.type === 'month')!.value;
  const d = +parts.find(p => p.type === 'day')!.value;
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const back = dayMap[day] === 0 ? -6 : 1 - dayMap[day];
  const dt = new Date(Date.UTC(y, m - 1, d + back));
  return dt.toISOString().slice(0, 10);
}

function shiftYMD(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function SaWeeklyGoals() {
  const { user } = useAuth();
  const isAdmin = isAdminCheck(user);
  const showForUser = isAdmin || isSALike(user);

  const weekStart = useMemo(() => currentMondayYMD(), []);
  const weekEnd = useMemo(() => shiftYMD(weekStart, 6), [weekStart]);
  const yyyymm = useMemo(() => format(getNowCentral(), 'yyyy-MM'), []);

  const leads = useSaLeadsBooked(weekStart, weekEnd);
  const sales = useSaSales(weekStart, weekEnd);

  const [leadsTarget, setLeadsTarget] = useState(DEFAULT_LEADS_TARGET);
  const [salesTarget, setSalesTarget] = useState(DEFAULT_SALES_TARGET);
  const [vision, setVision] = useState(DEFAULT_VISION);
  const [editingVision, setEditingVision] = useState(false);
  const [visionInput, setVisionInput] = useState(DEFAULT_VISION);
  const [visionSaved, setVisionSaved] = useState(false);

  const loadSettings = useCallback(async () => {
    const keys = [
      `sa_leads_booked_target:${yyyymm}`,
      `sa_sales_target:${yyyymm}`,
      `sa_wig_vision:${yyyymm}`,
    ];
    const { data: rows } = await supabase
      .from('studio_settings')
      .select('setting_key, setting_value')
      .in('setting_key', keys);
    const map = new Map(((rows as any[]) || []).map(r => [r.setting_key, r.setting_value]));
    const lt = parseInt(map.get(keys[0]) || '', 10);
    const st = parseInt(map.get(keys[1]) || '', 10);
    setLeadsTarget(isNaN(lt) ? DEFAULT_LEADS_TARGET : lt);
    setSalesTarget(isNaN(st) ? DEFAULT_SALES_TARGET : st);
    const v = map.get(keys[2]) || DEFAULT_VISION;
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

  const myLeads = leads.rows.find(r => r.sa === user.name)?.count ?? 0;
  const mySales = sales.rows.find(r => r.sa === user.name)?.count ?? 0;
  const leadsHit = myLeads >= leadsTarget;
  const salesHit = mySales >= salesTarget;

  const weekLabel = `Week of ${format(new Date(weekStart + 'T12:00:00'), 'M/d')}`;

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
        Your two numbers this week · {weekLabel}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border bg-card p-3">
          <p className="text-[11px] text-muted-foreground">Leads booked</p>
          <p className="mt-0.5">
            <span className={`text-2xl font-bold ${leadsHit ? 'text-success' : 'text-foreground'}`}>{myLeads}</span>
            <span className="text-sm text-muted-foreground"> of {leadsTarget}</span>
          </p>
        </div>
        <div className="rounded-md border bg-card p-3">
          <p className="text-[11px] text-muted-foreground">Sales</p>
          <p className="mt-0.5">
            <span className={`text-2xl font-bold ${salesHit ? 'text-success' : 'text-foreground'}`}>{mySales}</span>
            <span className="text-sm text-muted-foreground"> of {salesTarget}</span>
          </p>
        </div>
      </div>
    </Card>
  );
}
