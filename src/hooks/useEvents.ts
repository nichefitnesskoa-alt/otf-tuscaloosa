/**
 * useEvents — single source of truth for the events table.
 *
 * Events are studio outreach events we tag bookings to so we can
 * track a cohort against what the event cost. Adding "Event" as a
 * lead_source does NOT change SGL definition (Event is not in
 * EXCLUDED_LEAD_SOURCES in src/lib/sa/leadsBooked.ts), so Event
 * bookings continue to count as self-generated automatically.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface EventRow {
  id: string;
  name: string;
  event_date: string; // YYYY-MM-DD
  cost_cents: number | null;
  is_active: boolean;
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
        .order('event_date', { ascending: false });
      if (error) throw error;
      return (data as any as EventRow[]) || [];
    },
  });
}

export function useActiveEvents() {
  return useQuery<EventRow[]>({
    queryKey: EVENTS_ACTIVE_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events' as any)
        .select('*')
        .eq('is_active', true)
        .order('event_date', { ascending: false });
      if (error) throw error;
      return (data as any as EventRow[]) || [];
    },
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { name: string; event_date: string }) => {
      const { data, error } = await supabase
        .from('events' as any)
        .insert({
          name: input.name.trim(),
          event_date: input.event_date,
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
      event_date?: string;
      cost_cents?: number | null;
      is_active?: boolean;
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

export function formatEventDateLocal(ymd: string): string {
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
