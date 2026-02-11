import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ScriptSendLogEntry {
  id: string;
  template_id: string;
  lead_id: string | null;
  booking_id: string | null;
  sent_by: string;
  sent_at: string;
  message_body_sent: string;
  sequence_step_number: number | null;
}

export function useScriptSendLog(opts: { leadId?: string; bookingId?: string }) {
  return useQuery({
    queryKey: ['script_send_log', opts.leadId, opts.bookingId],
    enabled: !!(opts.leadId || opts.bookingId),
    queryFn: async () => {
      let query = supabase
        .from('script_send_log')
        .select('*')
        .order('sent_at', { ascending: true });

      if (opts.leadId) query = query.eq('lead_id', opts.leadId);
      if (opts.bookingId) query = query.eq('booking_id', opts.bookingId);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ScriptSendLogEntry[];
    },
  });
}

export function useLogScriptSent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: Omit<ScriptSendLogEntry, 'id' | 'sent_at'>) => {
      const { data, error } = await supabase
        .from('script_send_log')
        .insert(entry)
        .select()
        .single();
      if (error) throw error;
      return data as ScriptSendLogEntry;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['script_send_log'] }),
  });
}
