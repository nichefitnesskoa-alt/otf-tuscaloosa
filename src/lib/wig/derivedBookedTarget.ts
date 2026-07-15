/**
 * Derived Booked-Intros monthly target.
 *
 * The flat `sa_leads_booked_target` setting is deliberately NOT used to
 * drive the Booked Intros number in the WIG page or the shift header.
 * Instead we compute:
 *
 *   Booked Intros Monthly Goal = SA Sales Goal ÷ (showRate × closeRate)
 *
 * where showRate and closeRate are studio-wide, computed from real resolved
 * bookings in the last TRAILING_WINDOW_DAYS days. Recomputed daily as the
 * window rolls forward.
 *
 * All UI reads this SAME hook — never a second, parallel rate calc.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getNowCentral } from '@/lib/dateUtils';
import { format, subDays, startOfDay } from 'date-fns';
import { didIntroActuallyRun } from '@/lib/canon/introRules';
import { isSaleInRange } from '@/lib/sales-detection';

export const TRAILING_WINDOW_DAYS = 60;

export interface TrailingConversion {
  windowDays: number;
  bookedResolved: number;
  ran: number;
  sales: number;
  showRate: number | null;   // ran / bookedResolved
  closeRate: number | null;  // sales / ran
}

export function useTrailingConversion() {
  return useQuery<TrailingConversion>({
    queryKey: ['trailing-conversion', TRAILING_WINDOW_DAYS],
    staleTime: 1000 * 60 * 60, // 1 hour — rolls forward daily
    queryFn: async () => {
      const now = getNowCentral();
      const start = format(subDays(now, TRAILING_WINDOW_DAYS), 'yyyy-MM-dd');
      const end = format(now, 'yyyy-MM-dd');

      const { data: booked } = await supabase
        .from('intros_booked')
        .select('id, class_date, deleted_at, booking_status_canon, booking_type_canon, ignore_from_metrics')
        .gte('class_date', start)
        .lt('class_date', end)
        .is('deleted_at', null);

      const { data: runs } = await supabase
        .from('intros_run')
        .select('id, run_date, result_canon, result, buy_date, linked_intro_booked_id, ignore_from_metrics, is_winback, created_at')
        .gte('run_date', start)
        .lt('run_date', end);

      const activeBookingIds = new Set(
        (booked || [])
          .filter(b => (b.booking_status_canon || '').toUpperCase() !== 'DELETED_SOFT'
            && !b.ignore_from_metrics)
          .map(b => b.id),
      );

      // Winback runs are excluded from BOTH numerator and denominator of trailing
      // close-rate / show-rate. A winback was never a new lead — including it would
      // distort new-lead conversion the way corporate's Lead Funnel does not.
      const eligibleRuns = (runs || []).filter(r =>
        !r.ignore_from_metrics
        && !(r as any).is_winback
        && (r.result_canon || '').toUpperCase() !== 'DELETED'
        && (!r.linked_intro_booked_id || activeBookingIds.has(r.linked_intro_booked_id)),
      );


      const resolvedBookingIds = new Set(
        eligibleRuns
          .map(r => r.linked_intro_booked_id)
          .filter((x): x is string => !!x && activeBookingIds.has(x)),
      );

      // Canonical predicates — no inline rules. NOT_INTERESTED counts as ran
      // (member showed up and declined). PLANNING_RESCHEDULE does not.
      // Sales use isSaleInRange so older rows recorded only in the legacy
      // `result` field are still caught.
      const bookedResolved = resolvedBookingIds.size;
      const ran = eligibleRuns.filter(r => didIntroActuallyRun(r)).length;
      const windowRange = {
        start: startOfDay(subDays(now, TRAILING_WINDOW_DAYS)),
        end: startOfDay(now),
      };
      const sales = eligibleRuns.filter(r => isSaleInRange(r as any, windowRange)).length;

      return {
        windowDays: TRAILING_WINDOW_DAYS,
        bookedResolved,
        ran,
        sales,
        showRate: bookedResolved > 0 ? ran / bookedResolved : null,
        closeRate: ran > 0 ? sales / ran : null,
      };
    },
  });
}


/**
 * Derive the per-SA Booked Intros monthly goal from a sales target.
 * Returns null when sales target is unset or either rate is unavailable
 * (UI should render "—" rather than guess).
 */
export function deriveBookedTargetFromSales(
  saSalesTarget: number | null | undefined,
  trailing: Pick<TrailingConversion, 'showRate' | 'closeRate'> | undefined,
): number | null {
  if (saSalesTarget == null || saSalesTarget <= 0) return null;
  if (!trailing?.showRate || !trailing?.closeRate) return null;
  const conv = trailing.showRate * trailing.closeRate;
  if (conv <= 0) return null;
  return Math.ceil(saSalesTarget / conv);
}
