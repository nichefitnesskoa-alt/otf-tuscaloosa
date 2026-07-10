/**
 * useEventLookup — Map of event id → { name, event_date, activity_type }.
 * Thin cache-shared wrapper on useEvents() so any card/drawer can resolve
 * an intro's event_id without a per-render fetch.
 */
import { useMemo } from 'react';
import { useEvents } from '@/hooks/useEvents';
import { buildEventLookup, type EventLookupEntry } from '@/lib/leadSource/formatLeadSourceDetail';

export function useEventLookup(): Map<string, EventLookupEntry> {
  const { data } = useEvents();
  return useMemo(() => buildEventLookup(data ?? []), [data]);
}
