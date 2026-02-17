/**
 * Types for the offline write queue.
 */
export type QueueItemType = 'touch' | 'followup_complete' | 'rebook_draft';

export interface QueueItemBase {
  id: string;
  type: QueueItemType;
  createdAt: string;
  createdBy: string;
  syncStatus: 'pending' | 'syncing' | 'failed';
  retryCount: number;
  lastError?: string;
}

export interface TouchQueueItem extends QueueItemBase {
  type: 'touch';
  payload: {
    touchType: string;
    bookingId: string | null;
    leadId?: string | null;
    channel: string | null;
    notes: string | null;
  };
}

export interface FollowupCompleteQueueItem extends QueueItemBase {
  type: 'followup_complete';
  payload: {
    followUpId: string;
    sentBy: string;
  };
}

export interface RebookDraftQueueItem extends QueueItemBase {
  type: 'rebook_draft';
  payload: {
    personName: string;
    bookingId: string | null;
    classDate: string;
    introTime: string | null;
    coachName: string;
    reason: string;
    leadSource: string;
    fitnessGoal: string | null;
    saWorking: string;
  };
  /** Set after successful sync */
  createdBookingId?: string;
}

export type QueueItem = TouchQueueItem | FollowupCompleteQueueItem | RebookDraftQueueItem;
