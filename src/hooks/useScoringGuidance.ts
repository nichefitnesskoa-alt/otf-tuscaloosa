import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BulletGuidance {
  bullet_key: string;
  score_0: string;
  score_1: string;
  score_2: string;
}
export interface ColumnGuidance {
  column_key: string;
  is_starred: boolean;
  why_matters: string | null;
}
export interface GlobalGuidance {
  surface_test: string;
  awareness_test: string;
  scale_meaning: string;
  bottom_line: string | null;
}

export function useScoringGuidance() {
  return useQuery({
    queryKey: ['fv_scoring_guidance'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [bullets, cols, global] = await Promise.all([
        supabase.from('fv_scoring_guidance' as any).select('*'),
        supabase.from('fv_scoring_columns' as any).select('*'),
        supabase.from('fv_scoring_global' as any).select('*').eq('id', 'default').maybeSingle(),
      ]);
      const bulletMap: Record<string, BulletGuidance> = {};
      ((bullets.data || []) as any[]).forEach(b => { bulletMap[b.bullet_key] = b; });
      const columnMap: Record<string, ColumnGuidance> = {};
      ((cols.data || []) as any[]).forEach(c => { columnMap[c.column_key] = c; });
      return {
        bullets: bulletMap,
        columns: columnMap,
        global: (global.data || null) as GlobalGuidance | null,
      };
    },
  });
}
