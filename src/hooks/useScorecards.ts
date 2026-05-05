import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ColumnKey, ClassType, EvalType } from '@/lib/scorecard/levels';

export interface FvScorecard {
  id: string;
  first_timer_id: string | null;
  is_practice: boolean;
  practice_name: string | null;
  evaluator_name: string;
  evaluatee_name: string;
  eval_type: EvalType;
  class_type: ClassType;
  class_date: string;
  member_count: number | null;
  tread_score: number;
  rower_score: number;
  floor_score: number;
  otbeat_score: number;
  handback_score: number;
  total_score: number;
  level: 1 | 2 | 3;
  interactions_notes: string | null;
  otbeat_notes: string | null;
  handback_notes: string | null;
  submitted_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FvBullet {
  id: string;
  scorecard_id: string;
  column_key: ColumnKey;
  bullet_key: string;
  score: 0 | 1 | 2;
}

export interface FvComment {
  id: string;
  scorecard_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

export function useScorecards(opts: { from?: string; to?: string; evaluatee?: string; firstTimerId?: string } = {}) {
  return useQuery({
    queryKey: ['fv_scorecards', opts],
    queryFn: async () => {
      let q = supabase.from('fv_scorecards' as any).select('*').order('class_date', { ascending: false });
      if (opts.from) q = q.gte('class_date', opts.from);
      if (opts.to) q = q.lte('class_date', opts.to);
      if (opts.evaluatee) q = q.eq('evaluatee_name', opts.evaluatee);
      if (opts.firstTimerId) q = q.eq('first_timer_id', opts.firstTimerId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as FvScorecard[];
    },
  });
}

export function useScorecard(id: string | null) {
  return useQuery({
    queryKey: ['fv_scorecard', id],
    enabled: !!id,
    queryFn: async () => {
      const [{ data: card }, { data: bullets }, { data: comments }] = await Promise.all([
        supabase.from('fv_scorecards' as any).select('*').eq('id', id).maybeSingle(),
        supabase.from('fv_scorecard_bullets' as any).select('*').eq('scorecard_id', id),
        supabase.from('fv_scorecard_comments' as any).select('*').eq('scorecard_id', id).order('created_at', { ascending: true }),
      ]);
      return {
        scorecard: card as unknown as FvScorecard | null,
        bullets: (bullets || []) as unknown as FvBullet[],
        comments: (comments || []) as unknown as FvComment[],
      };
    },
  });
}

export function useUpsertScorecard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<FvScorecard> & { id?: string }) => {
      if (input.id) {
        const { data, error } = await supabase.from('fv_scorecards' as any).update(input).eq('id', input.id).select().single();
        if (error) throw error;
        return data as unknown as FvScorecard;
      } else {
        const { data, error } = await supabase.from('fv_scorecards' as any).insert(input).select().single();
        if (error) throw error;
        return data as unknown as FvScorecard;
      }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['fv_scorecards'] });
      qc.invalidateQueries({ queryKey: ['fv_scorecard', data.id] });
    },
  });
}

export function useUpsertBullet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { scorecard_id: string; column_key: ColumnKey; bullet_key: string; score: 0 | 1 | 2 }) => {
      const { error } = await supabase.from('fv_scorecard_bullets' as any).upsert(input, { onConflict: 'scorecard_id,bullet_key' });
      if (error) throw error;
      return input;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['fv_scorecard', data.scorecard_id] });
    },
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { scorecard_id: string; author_name: string; body: string }) => {
      const { data, error } = await supabase.from('fv_scorecard_comments' as any).insert({ ...input, created_by: input.author_name }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['fv_scorecard', vars.scorecard_id] });
    },
  });
}
