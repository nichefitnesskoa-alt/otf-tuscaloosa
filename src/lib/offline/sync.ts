/**
 * Sync engine: flush the offline write queue FIFO.
 */
import { supabase } from '@/integrations/supabase/client';
import { getQueue, dequeue, updateItem } from './writeQueue';
import { QueueItem } from './types';

export interface SyncResult {
  synced: number;
  failed: number;
  errors: string[];
}

async function syncItem(item: QueueItem): Promise<boolean> {
  switch (item.type) {
    case 'touch': {
      // Check throttle key won't be needed here since we're replaying
      const row = {
        created_by: item.createdBy,
        touch_type: item.payload.touchType,
        booking_id: item.payload.bookingId || null,
        lead_id: item.payload.leadId || null,
        channel: item.payload.channel || null,
        notes: item.payload.notes || null,
      };
      const { error } = await supabase.from('followup_touches').insert(row);
      if (error) throw new Error(error.message);
      return true;
    }

    case 'followup_complete': {
      // Check current status first (idempotency)
      const { data: current } = await supabase
        .from('follow_up_queue')
        .select('status')
        .eq('id', item.payload.followUpId)
        .maybeSingle();

      if (current?.status === 'sent' || current?.status === 'completed') {
        // Already completed, treat as success
        return true;
      }

      const { error } = await supabase
        .from('follow_up_queue')
        .update({
          status: 'sent',
          sent_by: item.payload.sentBy,
          sent_at: item.createdAt,
        })
        .eq('id', item.payload.followUpId);

      if (error) throw new Error(error.message);
      return true;
    }

    case 'rebook_draft': {
      // Check if already created (idempotency via createdBookingId)
      if ((item as any).createdBookingId) return true;

      const { data, error } = await supabase
        .from('intros_booked')
        .insert({
          member_name: item.payload.personName,
          class_date: item.payload.classDate,
          intro_time: item.payload.introTime || null,
          coach_name: item.payload.coachName || 'TBD',
          sa_working_shift: item.payload.saWorking,
          lead_source: item.payload.leadSource,
          fitness_goal: item.payload.fitnessGoal || null,
          booking_status: 'Active',
          booking_status_canon: 'ACTIVE',
          booked_by: item.createdBy,
          originating_booking_id: item.payload.bookingId,
          rebooked_from_booking_id: item.payload.bookingId,
          rebook_reason: item.payload.reason,
          rebooked_at: item.createdAt,
        })
        .select('id')
        .single();

      if (error) throw new Error(error.message);

      // Mark follow_up_queue
      if (item.payload.bookingId) {
        await supabase
          .from('follow_up_queue')
          .update({ saved_to_rebook: true, saved_to_rebook_at: item.createdAt })
          .eq('booking_id', item.payload.bookingId)
          .eq('status', 'pending');
      }

      // Store created ID for idempotency
      if (data?.id) {
        updateItem(item.id, { createdBookingId: data.id } as any);
      }
      return true;
    }

    default:
      return false;
  }
}

export async function runSync(): Promise<SyncResult> {
  const queue = getQueue();
  const result: SyncResult = { synced: 0, failed: 0, errors: [] };

  for (const item of queue) {
    if (item.syncStatus === 'syncing') continue; // skip items currently being synced

    updateItem(item.id, { syncStatus: 'syncing' });

    try {
      const success = await syncItem(item);
      if (success) {
        dequeue(item.id);
        result.synced++;
      }
    } catch (err: any) {
      const msg = err?.message || 'Unknown sync error';
      updateItem(item.id, {
        syncStatus: 'failed',
        retryCount: (item.retryCount || 0) + 1,
        lastError: msg,
      });
      result.failed++;
      result.errors.push(`${item.type}: ${msg}`);
    }
  }

  return result;
}
