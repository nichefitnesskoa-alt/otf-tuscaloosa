import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ObjectionPlaybookEntry {
  id: string;
  objection_name: string;
  sort_order: number;
  trigger_obstacles: string[];
  empathize_line: string;
  isolate_question: string;
  redirect_framework: string;
  redirect_discovery_question: string;
  suggestion_framework: string;
  ask_line: string;
  full_script: string;
  training_notes: string;
  expert_principles: string;
  is_active: boolean;
}

export function useObjectionPlaybooks() {
  return useQuery({
    queryKey: ['objection_playbooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('objection_playbooks')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return (data || []) as ObjectionPlaybookEntry[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Given a pipe-delimited obstacle string from the questionnaire, find matching playbooks */
export function matchObstaclesToPlaybooks(
  obstacles: string | null,
  playbooks: ObjectionPlaybookEntry[]
): ObjectionPlaybookEntry[] {
  if (!obstacles || playbooks.length === 0) return [];

  const obstacleList = obstacles.split(' | ').map(o => o.trim().toLowerCase()).filter(Boolean);

  return playbooks
    .filter(pb =>
      pb.trigger_obstacles.some(trigger =>
        obstacleList.some(o => o.includes(trigger.toLowerCase()) || trigger.toLowerCase().includes(o))
      )
    )
    .sort((a, b) => a.sort_order - b.sort_order);
}
