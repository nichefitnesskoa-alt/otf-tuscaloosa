/**
 * Offline write queue: enqueue, dequeue, list, clear.
 * Stored in localStorage so it survives page reloads.
 */
import { getItem, setItem } from './storage';
import { QueueItem } from './types';

const QUEUE_KEY = 'write_queue';

export function getQueue(): QueueItem[] {
  return getItem<QueueItem[]>(QUEUE_KEY) || [];
}

function saveQueue(queue: QueueItem[]): void {
  setItem(QUEUE_KEY, queue);
}

export function enqueue(item: QueueItem): void {
  const queue = getQueue();
  // Dedup by id
  if (queue.some(q => q.id === item.id)) return;
  queue.push(item);
  saveQueue(queue);
}

export function dequeue(id: string): void {
  const queue = getQueue().filter(q => q.id !== id);
  saveQueue(queue);
}

export function updateItem(id: string, updates: Record<string, unknown>): void {
  const queue = getQueue().map(q => q.id === id ? { ...q, ...updates } as QueueItem : q);
  saveQueue(queue);
}

export function clearQueue(): void {
  saveQueue([]);
}

export function getQueueLength(): number {
  return getQueue().length;
}

export function getPendingCount(): number {
  return getQueue().filter(q => q.syncStatus === 'pending' || q.syncStatus === 'failed').length;
}
