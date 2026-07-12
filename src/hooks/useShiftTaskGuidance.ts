/**
 * Data-driven how-to playbooks for shift checklist tasks.
 *
 * Mirrors the shape of `useScoringGuidance` (fv_scoring_*) so the shift-task
 * tooltip on My Day reuses the same interaction pattern proven on the coach
 * scorecard. Content is stored in `shift_task_guidance` and edited as data,
 * not hardcoded in components.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface GuidanceLane {
  id: string;
  task_name: string;
  lane_order: number;
  lane_title: string;
  why_line: string | null;
  steps: string[];
  is_safety_note: boolean;
  is_unmapped: boolean;
}

export function useShiftTaskGuidance(taskName: string | null | undefined) {
  return useQuery({
    queryKey: ['shift_task_guidance', taskName],
    enabled: !!taskName,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<GuidanceLane[]> => {
      if (!taskName) return [];
      const { data } = await supabase
        .from('shift_task_guidance' as any)
        .select('*')
        .eq('task_name', taskName)
        .order('lane_order');
      return ((data || []) as any[]).map(r => ({
        id: r.id,
        task_name: r.task_name,
        lane_order: r.lane_order,
        lane_title: r.lane_title,
        why_line: r.why_line,
        steps: Array.isArray(r.steps) ? r.steps : [],
        is_safety_note: !!r.is_safety_note,
        is_unmapped: !!r.is_unmapped,
      }));
    },
  });
}
