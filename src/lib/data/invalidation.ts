/**
 * Global data-invalidation bus.
 *
 * Single source of truth for "something on the server changed, every consumer
 * should refetch." Bridges DataContext (event-listener based) and React Query
 * (query-key based) so a single call from any write path refreshes BOTH layers.
 *
 * Usage:
 *   import { notifyDataChanged } from '@/lib/data/invalidation';
 *   await supabase.from('...').update(...);
 *   notifyDataChanged();           // refresh everything
 *   notifyDataChanged(['intros_booked', 'intros_run']); // targeted hint
 *
 * Per Core: "Delete = 5 things" — step 2 (invalidate every related key) and
 * step 3 (notify parents) collapse into this one call.
 */
import type { QueryClient } from '@tanstack/react-query';

export const DATA_CHANGED_EVENT = 'app:data-changed';

export interface DataChangedDetail {
  /** Optional table/scope hints. Empty = invalidate everything. */
  scopes?: string[];
  /** Optional originating action label, for debugging. */
  reason?: string;
}

let _queryClient: QueryClient | null = null;

/** Called once at app bootstrap so the bus can reach React Query. */
export function registerQueryClient(qc: QueryClient): void {
  _queryClient = qc;
}

export function getQueryClient(): QueryClient | null {
  return _queryClient;
}

/**
 * Broadcast a data change. Triggers:
 *  - window 'app:data-changed' event (DataContext + any custom listeners)
 *  - React Query invalidateQueries (all by default, or scoped by key prefix)
 *  - legacy 'myday:walk-in-added' event for back-compat with older listeners
 */
export function notifyDataChanged(scopes?: string[], reason?: string): void {
  if (typeof window === 'undefined') return;

  const detail: DataChangedDetail = { scopes, reason };

  try {
    window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT, { detail }));
    // Back-compat: existing DataContext listener keys off this event.
    window.dispatchEvent(new CustomEvent('myday:walk-in-added', { detail }));
  } catch {
    // ignore — non-browser env
  }

  if (_queryClient) {
    if (scopes && scopes.length > 0) {
      for (const scope of scopes) {
        _queryClient.invalidateQueries({ queryKey: [scope] });
      }
    } else {
      _queryClient.invalidateQueries();
    }
  }
}
