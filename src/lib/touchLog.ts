/**
 * Utility for logging follow-up touches (no automated messaging).
 * Durable tracking so DailyProgress and TopActions reflect real actions.
 */
import { supabase } from '@/integrations/supabase/client';

export type TouchType = 'script_copy' | 'call' | 'text_manual' | 'dm_manual' | 'email_manual' | 'in_person' | 'mark_done';

export interface LogTouchParams {
  createdBy: string;
  touchType: TouchType;
  bookingId?: string | null;
  runId?: string | null;
  leadId?: string | null;
  scriptTemplateId?: string | null;
  channel?: string | null;
  notes?: string | null;
  meta?: Record<string, any> | null;
}

// Throttle: prevent duplicate touches within 30 seconds for same booking+type
const recentTouches = new Map<string, number>();
const THROTTLE_MS = 30_000;

export async function logTouch(params: LogTouchParams): Promise<boolean> {
  try {
    // Throttle check
    const key = `${params.bookingId || params.leadId || 'none'}_${params.touchType}`;
    const now = Date.now();
    const lastTouch = recentTouches.get(key);
    if (lastTouch && now - lastTouch < THROTTLE_MS) {
      console.log('Touch throttled:', key);
      return true; // Don't spam, but don't fail
    }
    recentTouches.set(key, now);

    const { error } = await supabase.from('followup_touches' as any).insert({
      created_by: params.createdBy,
      touch_type: params.touchType,
      booking_id: params.bookingId || null,
      run_id: params.runId || null,
      lead_id: params.leadId || null,
      script_template_id: params.scriptTemplateId || null,
      channel: params.channel || null,
      notes: params.notes || null,
      meta: params.meta ? JSON.stringify(params.meta) : null,
    } as any);

    if (error) {
      console.error('logTouch error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('logTouch exception:', err);
    return false;
  }
}

/**
 * Fetch touch counts and last touch for a set of booking IDs.
 * Returns a map of bookingId → { count, lastTouchAt }
 */
export async function fetchTouchSummaries(
  bookingIds: string[]
): Promise<Map<string, { count: number; lastTouchAt: string | null }>> {
  const map = new Map<string, { count: number; lastTouchAt: string | null }>();
  if (bookingIds.length === 0) return map;

  try {
    const { data } = await supabase
      .from('followup_touches' as any)
      .select('booking_id, created_at')
      .in('booking_id', bookingIds)
      .order('created_at', { ascending: false });

    if (data) {
      for (const row of data as any[]) {
        const bid = row.booking_id as string;
        const existing = map.get(bid);
        if (existing) {
          existing.count++;
        } else {
          map.set(bid, { count: 1, lastTouchAt: row.created_at });
        }
      }
    }
  } catch (err) {
    console.error('fetchTouchSummaries error:', err);
  }

  return map;
}

/**
 * Count touches by a specific user today.
 */
export async function countTouchesToday(createdBy: string): Promise<number> {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { count } = await supabase
      .from('followup_touches' as any)
      .select('id', { count: 'exact', head: true })
      .eq('created_by', createdBy)
      .gte('created_at', todayStart.toISOString());

    return count || 0;
  } catch {
    return 0;
  }
}
