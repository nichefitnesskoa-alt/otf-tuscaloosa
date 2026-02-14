import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribe to realtime changes on key tables so multiple SAs
 * see live updates without manual refresh.
 */
export function useRealtimeMyDay(onUpdate: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel('myday-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'intros_booked' },
        () => onUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'intros_run' },
        () => onUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => onUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follow_up_queue' },
        () => onUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'script_actions' },
        () => onUpdate()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onUpdate]);
}
