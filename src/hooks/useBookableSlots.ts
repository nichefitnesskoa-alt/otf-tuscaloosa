/**
 * Bookable class slots for the PUBLIC intro scheduler.
 *
 * Reads the weekly template (intro_bookable_slots) + per-date overrides
 * (intro_bookable_slot_overrides) and materializes the next N days
 * of publicly-bookable slots in America/Chicago.
 *
 * Note: this is intentionally separate from src/lib/classSchedule.ts, which
 * remains the internal source of truth for other features. Changes here only
 * affect the /book public page and the admin editor.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getChicagoTodayYMD, getChicagoMinutesNow, hhmmToMinutes } from '@/lib/classSchedule';

export interface BookableSlot {
  id: string;
  day_of_week: number;
  slot_time: string;      // 'HH:mm:ss' from PG, we normalize to 'HH:mm'
  class_label: string | null;
  is_bookable: boolean;
  is_active: boolean;
}

export interface SlotOverride {
  id: string;
  class_date: string;
  slot_time: string;      // 'HH:mm:ss'
  action: 'cancel' | 'add';
  note: string | null;
}

export interface MaterializedDay {
  date: string;            // YYYY-MM-DD (Chicago)
  dayOfWeek: number;
  times: string[];         // HH:mm, sorted, publicly-bookable, future-only for today
}

function normalizeHhmm(t: string): string {
  const parts = t.split(':');
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
}

function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(x => parseInt(x, 10));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  const yy = dt.getFullYear();
  const mm = (dt.getMonth() + 1).toString().padStart(2, '0');
  const dd = dt.getDate().toString().padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function chicagoDowForYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(x => parseInt(x, 10));
  // ymd is already a Chicago date — using local Date is fine for DOW
  return new Date(y, m - 1, d).getDay();
}

export function useBookableSlots() {
  return useQuery({
    queryKey: ['intro_bookable_slots'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intro_bookable_slots' as any)
        .select('*')
        .order('day_of_week')
        .order('slot_time');
      if (error) throw error;
      return (data as unknown as BookableSlot[]) || [];
    },
    staleTime: 60_000,
  });
}

export function useSlotOverrides(fromYmd?: string, toYmd?: string) {
  return useQuery({
    queryKey: ['intro_bookable_slot_overrides', fromYmd, toYmd],
    queryFn: async () => {
      let q = supabase.from('intro_bookable_slot_overrides' as any).select('*');
      if (fromYmd) q = q.gte('class_date', fromYmd);
      if (toYmd) q = q.lte('class_date', toYmd);
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as SlotOverride[]) || [];
    },
    staleTime: 30_000,
  });
}

/**
 * Materialize the next `days` days of publicly-bookable slots in Chicago.
 * Slots for today that already started (Chicago wall time) are hidden.
 */
export function materializeBookableDays(
  slots: BookableSlot[],
  overrides: SlotOverride[],
  days: number = 14,
): MaterializedDay[] {
  const today = getChicagoTodayYMD();
  const minutesNow = getChicagoMinutesNow();

  const templateByDow = new Map<number, BookableSlot[]>();
  for (const s of slots) {
    if (!s.is_active || !s.is_bookable) continue;
    const arr = templateByDow.get(s.day_of_week) || [];
    arr.push(s);
    templateByDow.set(s.day_of_week, arr);
  }

  const cancelledByDate = new Map<string, Set<string>>();
  const addedByDate = new Map<string, Set<string>>();
  for (const o of overrides) {
    const map = o.action === 'cancel' ? cancelledByDate : addedByDate;
    const key = o.class_date;
    const set = map.get(key) || new Set<string>();
    set.add(normalizeHhmm(o.slot_time));
    map.set(key, set);
  }

  const out: MaterializedDay[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDaysYmd(today, i);
    const dow = chicagoDowForYmd(date);
    const base = (templateByDow.get(dow) || []).map(s => normalizeHhmm(s.slot_time));
    const added = Array.from(addedByDate.get(date) || []);
    const cancelled = cancelledByDate.get(date) || new Set<string>();
    const merged = Array.from(new Set([...base, ...added]))
      .filter(t => !cancelled.has(t))
      .filter(t => date !== today || hhmmToMinutes(t) > minutesNow)
      .sort();
    if (merged.length > 0) out.push({ date, dayOfWeek: dow, times: merged });
  }
  return out;
}
