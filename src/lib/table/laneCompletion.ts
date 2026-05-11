// Derive whether a staff member's existing lanes are caught up enough
// to be allowed to claim another lane on Own It.
//
// Rule: if ANY of the staff's current lanes had an "incomplete" entry in
// BOTH of the two most recent past meetings, the gate is closed.
//
// "Incomplete" for a meeting = no entry row, OR submitted_at is null,
// OR any of the four fields (last_week_update, this_week_focus, ideas, ask)
// is null/blank.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface OwnerEntryLite {
  owner_id: string;
  meeting_id: string;
  submitted_at: string | null;
  last_week_update: string | null;
  this_week_focus: string | null;
  ideas: string | null;
  ask: string | null;
}

function isIncomplete(e?: OwnerEntryLite): boolean {
  if (!e) return true;
  if (!e.submitted_at) return true;
  const fields = [e.last_week_update, e.this_week_focus, e.ideas, e.ask];
  return fields.some(v => !v || !v.trim());
}

export function useRecentLaneCompleteness(staffId: string | undefined) {
  return useQuery({
    queryKey: ['table-recent-lane-completeness', staffId],
    enabled: !!staffId,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);

      // Last 2 past meetings (strictly before today).
      const { data: pastMeetings } = await supabase
        .from('table_meetings')
        .select('id, meeting_date')
        .lt('meeting_date', today)
        .order('meeting_date', { ascending: false })
        .limit(2);

      const meetings = pastMeetings ?? [];
      // Need at least 2 prior meetings to gate; otherwise allow.
      if (meetings.length < 2) return { blocked: false, reason: 'not-enough-history' as const };

      // All of this staff's lanes (active only — soft-removed lanes don't count).
      const { data: myOwners } = await supabase
        .from('table_owners')
        .select('id')
        .eq('staff_id', staffId!)
        .eq('is_active', true);

      const ownerIds = (myOwners ?? []).map(o => o.id);
      if (ownerIds.length === 0) return { blocked: false, reason: 'no-existing-lanes' as const };

      const meetingIds = meetings.map(m => m.id);
      const { data: entries } = await supabase
        .from('table_owner_entries')
        .select('owner_id, meeting_id, submitted_at, last_week_update, this_week_focus, ideas, ask')
        .in('owner_id', ownerIds)
        .in('meeting_id', meetingIds);

      const rows = (entries ?? []) as OwnerEntryLite[];

      // For each lane, check both meetings.
      const anyLaneIncompleteBoth = ownerIds.some(ownerId => {
        return meetings.every(m => {
          const e = rows.find(r => r.owner_id === ownerId && r.meeting_id === m.id);
          return isIncomplete(e);
        });
      });

      return {
        blocked: anyLaneIncompleteBoth,
        reason: anyLaneIncompleteBoth ? ('two-week-incomplete' as const) : ('clear' as const),
      };
    },
  });
}
