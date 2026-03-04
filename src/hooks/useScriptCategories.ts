import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ScriptCategory {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  created_by: string | null;
  created_at: string;
}

/** Hardcoded fallback — used only if DB query fails */
const FALLBACK_CATEGORIES: ScriptCategory[] = [
  { id: '1', name: 'Booking Confirmations', slug: 'booking_confirmation', sort_order: 1, created_by: null, created_at: '' },
  { id: '2', name: 'Pre-Class Reminders', slug: 'pre_class_reminder', sort_order: 2, created_by: null, created_at: '' },
  { id: '3', name: 'No-Show Follow-Up', slug: 'no_show', sort_order: 3, created_by: null, created_at: '' },
  { id: '4', name: 'Instagram DM', slug: 'ig_dm', sort_order: 4, created_by: null, created_at: '' },
  { id: '5', name: 'Web Lead Outreach', slug: 'web_lead', sort_order: 5, created_by: null, created_at: '' },
  { id: '6', name: 'Cold Lead Re-Engagement', slug: 'cold_lead', sort_order: 6, created_by: null, created_at: '' },
  { id: '7', name: 'Post-Class (Didn\'t Close)', slug: 'post_class_no_close', sort_order: 7, created_by: null, created_at: '' },
  { id: '8', name: 'Post-Class (Joined)', slug: 'post_class_joined', sort_order: 8, created_by: null, created_at: '' },
  { id: '9', name: 'Referral Ask', slug: 'referral_ask', sort_order: 9, created_by: null, created_at: '' },
  { id: '10', name: 'Cancel/Freeze Save', slug: 'cancel_freeze', sort_order: 10, created_by: null, created_at: '' },
  { id: '11', name: 'Promos', slug: 'promo', sort_order: 11, created_by: null, created_at: '' },
  { id: '12', name: 'Reschedule', slug: 'reschedule', sort_order: 12, created_by: null, created_at: '' },
];

export function useScriptCategories() {
  return useQuery({
    queryKey: ['script_categories'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('script_categories')
        .select('*')
        .order('sort_order');
      if (error) {
        console.warn('Failed to load script_categories, using fallback:', error);
        return FALLBACK_CATEGORIES;
      }
      return (data || FALLBACK_CATEGORIES) as ScriptCategory[];
    },
    staleTime: 60_000,
  });
}

/** Convenience: returns [{value, label}] format matching old SCRIPT_CATEGORIES shape */
export function useScriptCategoryOptions() {
  const { data: categories = FALLBACK_CATEGORIES, ...rest } = useScriptCategories();
  const options = categories.map(c => ({ value: c.slug, label: c.name }));
  return { options, categories, ...rest };
}

/** Find a category label by slug */
export function getCategoryLabel(categories: ScriptCategory[], slug: string): string {
  return categories.find(c => c.slug === slug)?.name || slug;
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; slug: string; sort_order: number; created_by?: string }) => {
      const { data, error } = await (supabase as any)
        .from('script_categories')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as ScriptCategory;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['script_categories'] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ScriptCategory> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('script_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ScriptCategory;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['script_categories'] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slug: string) => {
      // Delete all scripts in this category first
      await supabase
        .from('script_templates')
        .delete()
        .eq('category', slug);
      // Then delete the category
      const { error } = await (supabase as any)
        .from('script_categories')
        .delete()
        .eq('slug', slug);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['script_categories'] });
      qc.invalidateQueries({ queryKey: ['script_templates'] });
    },
  });
}
