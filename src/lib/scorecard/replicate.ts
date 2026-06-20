/**
 * Auto-replicate FV scorecards across same-class intros.
 *
 * When a coach submits one scorecard, the other intros in the SAME class
 * (same coach, same class_date, same intro_time) automatically get a
 * copy of the scorecard so the coach doesn't have to re-grade identical
 * intros. The coach can still open any auto-created scorecard and adjust
 * it; once they do, it is considered "touched" and is preserved.
 *
 * If an intro later resolves as NO_SHOW / CANCELLED / PLANNING_RESCHEDULE
 * / DELETED_SOFT, any UNTOUCHED replica for that intro is removed so
 * the coach isn't credited for an intro that didn't actually happen.
 */
import { supabase } from '@/integrations/supabase/client';
import { isBookingExcludedFromMetrics } from '@/lib/intros/excludedBookings';

const EXCLUDED_STATUSES = new Set(['NO_SHOW', 'CANCELLED', 'PLANNING_RESCHEDULE', 'DELETED_SOFT', 'RESCHEDULED']);

export interface ReplicateResult {
  created: string[];
  skipped: number;
}

export async function replicateScorecardToSiblings(sourceScorecardId: string): Promise<ReplicateResult> {
  // 1. Load source scorecard + bullets
  const { data: source, error: srcErr } = await supabase
    .from('fv_scorecards' as any)
    .select('*')
    .eq('id', sourceScorecardId)
    .maybeSingle();
  if (srcErr || !source) return { created: [], skipped: 0 };
  const src = source as any;

  // Practice scorecards never replicate.
  if (src.is_practice || !src.first_timer_id) return { created: [], skipped: 0 };

  const { data: bullets } = await supabase
    .from('fv_scorecard_bullets' as any)
    .select('column_key, bullet_key, score')
    .eq('scorecard_id', sourceScorecardId);

  // 2. Resolve the source booking
  const { data: srcBooking } = await supabase
    .from('intros_booked')
    .select('id, coach_name, class_date, intro_time')
    .eq('id', src.first_timer_id)
    .maybeSingle();
  if (!srcBooking?.coach_name || !srcBooking?.class_date || !srcBooking?.intro_time) {
    return { created: [], skipped: 0 };
  }

  // 3. Find siblings: same coach + date + intro_time, different booking
  const { data: siblings } = await supabase
    .from('intros_booked')
    .select('id, member_name, coach_name, class_date, intro_time, booking_status_canon, is_vip, ignore_from_metrics, deleted_at')
    .eq('coach_name', srcBooking.coach_name)
    .eq('class_date', srcBooking.class_date)
    .eq('intro_time', srcBooking.intro_time)
    .neq('id', srcBooking.id);

  const eligible = (siblings || []).filter(b => {
    if (isBookingExcludedFromMetrics(b)) return false;
    const status = (b.booking_status_canon || '').toUpperCase();
    if (EXCLUDED_STATUSES.has(status)) return false;
    return true;
  });
  if (eligible.length === 0) return { created: [], skipped: 0 };

  // 4. Skip siblings that already have a scorecard from this evaluator on this date
  const { data: existing } = await supabase
    .from('fv_scorecards' as any)
    .select('first_timer_id')
    .in('first_timer_id', eligible.map(s => s.id))
    .eq('evaluator_name', src.evaluator_name)
    .eq('class_date', src.class_date);
  const alreadyScored = new Set((existing || []).map((e: any) => e.first_timer_id));

  const toCreate = eligible.filter(s => !alreadyScored.has(s.id));

  const created: string[] = [];
  for (const sib of toCreate) {
    const payload: any = {
      first_timer_id: sib.id,
      is_practice: false,
      practice_name: null,
      evaluator_name: src.evaluator_name,
      evaluatee_name: src.evaluatee_name,
      eval_type: src.eval_type,
      class_type: src.class_type,
      class_date: src.class_date,
      member_count: src.member_count,
      tread_score: src.tread_score,
      rower_score: src.rower_score,
      floor_score: src.floor_score,
      otbeat_score: src.otbeat_score,
      handback_score: src.handback_score,
      interactions_notes: src.interactions_notes,
      otbeat_notes: src.otbeat_notes,
      handback_notes: src.handback_notes,
      submitted_at: new Date().toISOString(),
      created_by: src.created_by,
      replicated_from_scorecard_id: sourceScorecardId,
    };
    const { data: inserted, error: insErr } = await supabase
      .from('fv_scorecards' as any)
      .insert(payload)
      .select('id')
      .single();
    if (insErr || !inserted) continue;
    const newId = (inserted as any).id;
    created.push(newId);

    if (bullets && bullets.length > 0) {
      const bulletRows = (bullets as any[]).map(b => ({
        scorecard_id: newId,
        column_key: b.column_key,
        bullet_key: b.bullet_key,
        score: b.score,
      }));
      await supabase.from('fv_scorecard_bullets' as any).insert(bulletRows);
    }
  }

  return { created, skipped: eligible.length - toCreate.length };
}

export interface CleanupResult {
  deleted: string[];
}

/**
 * Remove untouched replicated scorecards for a booking. Called when
 * the booking turns into a no-show / cancel / reschedule / soft-delete
 * so the coach isn't credited/debited for an intro that didn't happen.
 *
 * "Untouched" = replicated_from_scorecard_id IS NOT NULL AND
 * updated_at is within 5s of created_at (no manual edit since creation).
 */
export async function cleanupReplicasForBooking(bookingId: string): Promise<CleanupResult> {
  if (!bookingId) return { deleted: [] };
  const { data: replicas } = await supabase
    .from('fv_scorecards' as any)
    .select('id, created_at, updated_at')
    .eq('first_timer_id', bookingId)
    .not('replicated_from_scorecard_id', 'is', null);

  if (!replicas || replicas.length === 0) return { deleted: [] };

  const deleted: string[] = [];
  for (const r of replicas as any[]) {
    const created = new Date(r.created_at).getTime();
    const updated = new Date(r.updated_at).getTime();
    // Untouched if updated within 5s of creation
    if (Math.abs(updated - created) > 5000) continue;
    // Also check no bullet rows have been edited after creation (in case
    // bullets were tweaked but the parent row's updated_at didn't bump).
    const { data: editedBullets } = await supabase
      .from('fv_scorecard_bullets' as any)
      .select('id')
      .eq('scorecard_id', r.id)
      .gt('updated_at', new Date(created + 5000).toISOString())
      .limit(1);
    if (editedBullets && editedBullets.length > 0) continue;

    await supabase.from('fv_scorecard_bullets' as any).delete().eq('scorecard_id', r.id);
    await supabase.from('fv_scorecards' as any).delete().eq('id', r.id);
    deleted.push(r.id);
  }
  return { deleted };
}
