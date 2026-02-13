import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ScriptTemplate {
  id: string;
  name: string;
  category: string;
  channel: string;
  sequence_order: number | null;
  body: string;
  timing_note: string | null;
  is_shared_step: boolean;
  shared_step_id: string | null;
  is_active: boolean;
  variant_label: string | null;
  created_at: string;
  updated_at: string;
}

export const SCRIPT_CATEGORIES = [
  { value: 'booking_confirmation', label: 'Booking Confirmations' },
  { value: 'pre_class_reminder', label: 'Pre-Class Reminders' },
  { value: 'no_show', label: 'No-Show Follow-Up' },
  { value: 'ig_dm', label: 'Instagram DM' },
  { value: 'web_lead', label: 'Web Lead Outreach' },
  { value: 'cold_lead', label: 'Cold Lead Re-Engagement' },
  { value: 'post_class_no_close', label: 'Post-Class (Didn\'t Close)' },
  { value: 'post_class_joined', label: 'Post-Class (Joined)' },
  { value: 'referral_ask', label: 'Referral Ask' },
  { value: 'cancel_freeze', label: 'Cancel/Freeze Save' },
  { value: 'promo', label: 'Promos' },
] as const;

export function useScriptTemplates(category?: string) {
  return useQuery({
    queryKey: ['script_templates', category],
    queryFn: async () => {
      let query = supabase
        .from('script_templates')
        .select('*')
        .order('category')
        .order('sequence_order', { nullsFirst: false })
        .order('name');

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ScriptTemplate[];
    },
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (template: Omit<ScriptTemplate, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('script_templates')
        .insert(template)
        .select()
        .single();
      if (error) throw error;
      return data as ScriptTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['script_templates'] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ScriptTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('script_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ScriptTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['script_templates'] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('script_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['script_templates'] }),
  });
}

export function useSharedStepUsage(templateId: string | undefined) {
  return useQuery({
    queryKey: ['shared_step_usage', templateId],
    enabled: !!templateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('script_templates')
        .select('id, name, category')
        .eq('shared_step_id', templateId!);
      if (error) throw error;
      return (data || []) as Pick<ScriptTemplate, 'id' | 'name' | 'category'>[];
    },
  });
}
