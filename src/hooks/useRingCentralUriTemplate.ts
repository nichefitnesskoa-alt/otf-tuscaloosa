/**
 * Read/write the admin-configured RingCentral SMS deep-link template.
 * Backed by studio_settings (single row keyed by RC_SMS_URI_SETTING_KEY).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  DEFAULT_RC_SMS_URI_TEMPLATE,
  RC_SMS_URI_SETTING_KEY,
} from '@/lib/ringcentral/smsUri';

export function useRingCentralUriTemplate() {
  return useQuery({
    queryKey: ['studio_settings', RC_SMS_URI_SETTING_KEY],
    queryFn: async () => {
      const { data } = await supabase
        .from('studio_settings')
        .select('setting_value')
        .eq('setting_key', RC_SMS_URI_SETTING_KEY)
        .maybeSingle();
      const val = (data as any)?.setting_value as string | undefined;
      return (val && val.trim()) || DEFAULT_RC_SMS_URI_TEMPLATE;
    },
    staleTime: 60_000,
  });
}

export function useSaveRingCentralUriTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ value, updatedBy }: { value: string; updatedBy: string }) => {
      const { error } = await supabase
        .from('studio_settings')
        .upsert(
          {
            setting_key: RC_SMS_URI_SETTING_KEY,
            setting_value: value,
            updated_by: updatedBy,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: 'setting_key' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['studio_settings', RC_SMS_URI_SETTING_KEY] });
    },
  });
}
