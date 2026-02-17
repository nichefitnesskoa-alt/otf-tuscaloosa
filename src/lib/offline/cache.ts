/**
 * Offline read cache: stale-while-revalidate for DataContext datasets.
 */
import { getItem, setItem } from './storage';

export interface CachedDataset<T> {
  data: T;
  cachedAt: string;
}

const CACHE_KEYS = {
  intros_booked: 'cache_intros_booked',
  intros_run: 'cache_intros_run',
  follow_up_queue: 'cache_follow_up_queue',
  followup_touches: 'cache_followup_touches',
  shift_recaps: 'cache_shift_recaps',
  sales: 'cache_sales',
} as const;

export type CacheKey = keyof typeof CACHE_KEYS;

export function writeCache<T>(key: CacheKey, data: T): void {
  const entry: CachedDataset<T> = {
    data,
    cachedAt: new Date().toISOString(),
  };
  setItem(CACHE_KEYS[key], entry);
}

export function readCache<T>(key: CacheKey): CachedDataset<T> | null {
  return getItem<CachedDataset<T>>(CACHE_KEYS[key]);
}

export function getLastCacheTime(): string | null {
  // Return the most recent cachedAt across all datasets
  let latest: string | null = null;
  for (const storageKey of Object.values(CACHE_KEYS)) {
    const entry = getItem<CachedDataset<unknown>>(storageKey);
    if (entry?.cachedAt) {
      if (!latest || entry.cachedAt > latest) {
        latest = entry.cachedAt;
      }
    }
  }
  return latest;
}
