/**
 * useEvents — single source of truth for the events table.
 *
 * Events are studio outreach activities we tag bookings to so we can
 * track a cohort against what the event cost. Two flavors:
 *   - activity_type = 'event'            → has a specific event_date
 *   - activity_type = 'general_outreach' → no date required
 *
 * "Event / Self Generated Lead" as a lead_source does NOT change SGL
 * definition (it's not in EXCLUDED_LEAD_SOURCES), so these bookings
 * continue to count as self-generated automatically. The "(Friend)"
 * variant additionally counts as a referral via isReferralLikeSource.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export type OutreachActivityType = 'event' | 'general_outreach';

export interface EventRow {
  id: string;
  name: string;
  event_date: string | null; // null for general_outreach
  cost_cents: number | null;
  is_active: boolean;
  activity_type: OutreachActivityType;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const EVENTS_KEY = ['events'] as const;
const EVENTS_ACTIVE_KEY = ['events', 'active'] as const;

export function useEvents() {
  return useQuery<EventRow[]>({
    queryKey: EVENTS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events' as any)
        .select('*')
        .order('event_date', { ascending: false, nullsFirst: false } as any);
      if (error) throw error;
      return (data as any as EventRow[]) || [];
    },
  });
}

export function useActiveEvents(activityType?: OutreachActivityType) {
  return useQuery<EventRow[]>({
    queryKey: [...EVENTS_ACTIVE_KEY, activityType ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('events' as any)
        .select('*')
        .eq('is_active', true);
      if (activityType) q = q.eq('activity_type', activityType);
      const { data, error } = await q.order('event_date', { ascending: false, nullsFirst: false } as any);
      if (error) throw error;
      return (data as any as EventRow[]) || [];
    },
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      event_date?: string | null;
      activity_type?: OutreachActivityType;
    }) => {
      const activity_type: OutreachActivityType = input.activity_type ?? 'event';
      const { data, error } = await supabase
        .from('events' as any)
        .insert({
          name: input.name.trim(),
          event_date: activity_type === 'event' ? (input.event_date ?? null) : null,
          activity_type,
          is_active: true,
          created_by: user?.name || null,
        } as any)
        .select('*')
        .single();
      if (error) throw error;
      return data as any as EventRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EVENTS_KEY });
      qc.invalidateQueries({ queryKey: EVENTS_ACTIVE_KEY });
    },
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      event_date?: string | null;
      cost_cents?: number | null;
      is_active?: boolean;
      activity_type?: OutreachActivityType;
    }) => {
      const { id, ...rest } = input;
      const { data, error } = await supabase
        .from('events' as any)
        .update(rest as any)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data as any as EventRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EVENTS_KEY });
      qc.invalidateQueries({ queryKey: EVENTS_ACTIVE_KEY });
    },
  });
}

export function formatEventDateLocal(ymd: string | null | undefined): string {
  if (!ymd) return 'No date';
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function centsToDollarsInput(cents: number | null | undefined): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2);
}

export function dollarsInputToCents(v: string): number | null {
  const trimmed = v.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}
