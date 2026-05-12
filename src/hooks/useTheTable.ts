import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { computeLaneHealth, sundayCutoffISO, type LaneHealthStatus } from '@/lib/table/laneHealth';

// Returns the Monday (America/Chicago) of the CURRENT week, as YYYY-MM-DD.
// Mon-Sun all resolve to that week's Monday. Only flips on the next Monday.
export function nextMondayCT(now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  });
  const parts = fmt.formatToParts(now);
  const day = parts.find(p => p.type === 'weekday')!.value;
  const y = +parts.find(p => p.type === 'year')!.value;
  const m = +parts.find(p => p.type === 'month')!.value;
  const d = +parts.find(p => p.type === 'day')!.value;
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = dayMap[day];
  // Days back to this week's Monday (Sun=-6 so Sunday still belongs to the week that just ended).
  const back = dow === 0 ? -6 : 1 - dow;
  const dt = new Date(Date.UTC(y, m - 1, d + back));
  return dt.toISOString().slice(0, 10);
}

export interface TableOwner {
  id: string; staff_id: string; display_name: string;
  lane_name: string | null; category: string | null; is_active: boolean;
  is_architect?: boolean;
}
export interface TableMeeting {
  id: string; meeting_date: string; meeting_time: string;
  status: 'upcoming' | 'live' | 'complete'; koa_open_note: string | null;
}
export interface OwnerEntry {
  id: string; meeting_id: string; owner_id: string;
  last_week_update: string | null; this_week_focus: string | null;
  ideas: string | null; ask: string | null; submitted_at: string | null;
}
export interface TableResponse {
  id: string; meeting_id: string; owner_entry_id: string;
  responder_name: string; mode: 'build' | 'flag' | 'offer'; content: string; created_at: string;
}
export interface TableActionItem {
  id: string; meeting_id: string; source_response_id: string | null;
  owner_staff_id: string; owner_name: string; description: string;
  due_date: string; status: 'open' | 'in_progress' | 'done';
  created_at: string; updated_at: string;
}
export interface TableWin {
  id: string; owner_id: string | null; owner_name: string;
  content: string; meeting_week: string; included_in_close: boolean; created_at: string;
}

// If meetingId is provided, load that specific meeting (deep-link). Otherwise
// resolve by weekDate (Monday in CT). Auto-creates the row for current/future
// weeks; returns null for past weeks with no record.
// Auto-flips past meetings to 'complete' so nothing gets lost.
export function useCurrentMeeting(opts?: { meetingId?: string; weekDate?: string }) {
  const meetingId = opts?.meetingId;
  const currentMonday = nextMondayCT();
  const targetDate = opts?.weekDate ?? currentMonday;
  return useQuery({
    queryKey: ['table-meeting', meetingId ?? targetDate],
    queryFn: async () => {
      let row: TableMeeting | null = null;
      if (meetingId) {
        const { data } = await supabase
          .from('table_meetings').select('*').eq('id', meetingId).maybeSingle();
        row = (data ?? null) as TableMeeting | null;
      } else {
        const { data } = await supabase
          .from('table_meetings').select('*').eq('meeting_date', targetDate).maybeSingle();
        row = (data ?? null) as TableMeeting | null;
        if (!row && targetDate >= currentMonday) {
          const { data: created } = await supabase
            .from('table_meetings')
            .insert({ meeting_date: targetDate, meeting_time: '13:30', status: 'upcoming', created_by: 'system' })
            .select().single();
          row = created as TableMeeting;
        }
      }
      // Auto-complete: if the meeting's week has already passed and it was
      // never closed out, flip it now so wins/actions surface in history.
      if (row && row.meeting_date < currentMonday && row.status !== 'complete') {
        const { data: updated } = await supabase
          .from('table_meetings').update({ status: 'complete' }).eq('id', row.id).select().single();
        if (updated) row = updated as TableMeeting;
      }
      return row;
    },
  });
}

// Returns ONLY non-architect owners (for grids, carousel, submission status).
export function useActiveOwners() {
  return useQuery({
    queryKey: ['table-owners'],
    queryFn: async () => {
      const { data } = await supabase
        .from('table_owners').select('*')
        .eq('is_active', true).eq('is_architect', false)
        .order('display_name').order('lane_name');
      return (data || []) as TableOwner[];
    },
  });
}

// Returns the single architect (Studio Leader) record, or null.
export function useArchitect() {
  return useQuery({
    queryKey: ['table-architect'],
    queryFn: async () => {
      const { data } = await supabase
        .from('table_owners').select('*')
        .eq('is_active', true).eq('is_architect', true)
        .maybeSingle();
      return (data ?? null) as TableOwner | null;
    },
  });
}

// All active owners INCLUDING the architect — for action-item ownership pickers
// where Koa can still own work, even though he's not an Owner in the round.
export function useAllOwnersIncludingArchitect() {
  return useQuery({
    queryKey: ['table-owners-all'],
    queryFn: async () => {
      const { data } = await supabase
        .from('table_owners').select('*').eq('is_active', true).order('display_name');
      return (data || []) as TableOwner[];
    },
  });
}

export function useOwnerEntries(meetingId?: string) {
  return useQuery({
    queryKey: ['table-entries', meetingId],
    enabled: !!meetingId,
    queryFn: async () => {
      const { data } = await supabase.from('table_owner_entries').select('*').eq('meeting_id', meetingId);
      return (data || []) as OwnerEntry[];
    },
  });
}

export function useResponses(meetingId?: string) {
  return useQuery({
    queryKey: ['table-responses', meetingId],
    enabled: !!meetingId,
    queryFn: async () => {
      const { data } = await supabase.from('table_responses').select('*').eq('meeting_id', meetingId).order('created_at');
      return (data || []) as TableResponse[];
    },
  });
}

export function useActionItems(meetingId?: string) {
  return useQuery({
    queryKey: ['table-actions', meetingId ?? 'all'],
    queryFn: async () => {
      let q = supabase.from('table_action_items').select('*').order('due_date');
      if (meetingId) q = q.eq('meeting_id', meetingId);
      const { data } = await q;
      return (data || []) as TableActionItem[];
    },
  });
}

export function useOpenCarryForward(currentMeetingId?: string) {
  return useQuery({
    queryKey: ['table-actions-open', currentMeetingId],
    queryFn: async () => {
      let q = supabase.from('table_action_items').select('*').in('status', ['open', 'in_progress']).order('due_date');
      if (currentMeetingId) q = q.neq('meeting_id', currentMeetingId);
      const { data } = await q;
      return (data || []) as TableActionItem[];
    },
  });
}

export function useCurrentWeekWins(weekDate?: string) {
  return useQuery({
    queryKey: ['table-wins', weekDate],
    enabled: !!weekDate,
    queryFn: async () => {
      const { data } = await supabase.from('table_wins').select('*').eq('meeting_week', weekDate).order('created_at');
      return (data || []) as TableWin[];
    },
  });
}

export function useTableClose(meetingId?: string) {
  return useQuery({
    queryKey: ['table-close', meetingId],
    enabled: !!meetingId,
    queryFn: async () => {
      const { data } = await supabase.from('table_closes').select('*').eq('meeting_id', meetingId).maybeSingle();
      return data;
    },
  });
}

// Compute Lane Health for each owner against the current meeting + previous meeting.
export function useLaneHealth(meetingId?: string, meetingDate?: string) {
  const { data: owners = [] } = useActiveOwners();
  const { data: entries = [] } = useOwnerEntries(meetingId);
  const { data: responses = [] } = useResponses(meetingId);
  const { data: allActions = [] } = useActionItems();

  const cutoff = useMemo(() => meetingDate ? sundayCutoffISO(meetingDate) : null, [meetingDate]);

  return useMemo(() => {
    const map: Record<string, { status: LaneHealthStatus; submittedOnTime: boolean; receivedResponse: boolean; actionItemProgressed: boolean }> = {};
    for (const o of owners) {
      const entry = entries.find(e => e.owner_id === o.id);
      const submittedOnTime = !!entry?.submitted_at && (!cutoff || entry.submitted_at <= cutoff);
      const myEntryIds = entries.filter(e => e.owner_id === o.id).map(e => e.id);
      const receivedResponse = responses.some(r => myEntryIds.includes(r.owner_entry_id));
      // action item progressed since prior meeting: any action owned by this staff_id with status != open updated since their last completed meeting
      const actionItemProgressed = allActions.some(a =>
        a.owner_staff_id === o.staff_id && a.status !== 'open'
      );
      const inputs = { submittedOnTime, receivedResponse, actionItemProgressed };
      map[o.id] = { ...inputs, status: computeLaneHealth(inputs) };
    }
    return map;
  }, [owners, entries, responses, allActions, cutoff]);
}

// Realtime subscriptions for live meeting feed
export function useTableRealtime(meetingId?: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!meetingId) return;
    const ch = supabase.channel(`table-${meetingId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_responses', filter: `meeting_id=eq.${meetingId}` },
        () => qc.invalidateQueries({ queryKey: ['table-responses', meetingId] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_owner_entries', filter: `meeting_id=eq.${meetingId}` },
        () => qc.invalidateQueries({ queryKey: ['table-entries', meetingId] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_meetings', filter: `id=eq.${meetingId}` },
        () => qc.invalidateQueries({ queryKey: ['table-meeting'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_action_items', filter: `meeting_id=eq.${meetingId}` },
        () => qc.invalidateQueries({ queryKey: ['table-actions'] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [meetingId, qc]);
}
