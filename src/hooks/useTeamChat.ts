import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TeamChatMessage {
  id: string;
  author: string;
  content: string;
  created_at: string;
}

export function useTeamChat() {
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('team_chat_messages' as any)
      .select('*')
      .order('created_at', { ascending: true })
      .limit(500);
    setMessages((data as any as TeamChatMessage[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('team-chat-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_chat_messages' }, (payload) => {
        setMessages(prev => {
          const row = payload.new as TeamChatMessage;
          if (prev.some(m => m.id === row.id)) return prev;
          return [...prev, row];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const send = useCallback(async (author: string, content: string) => {
    const trimmed = content.trim();
    if (!trimmed || !author) return;
    await supabase.from('team_chat_messages' as any).insert({ author, content: trimmed });
  }, []);

  return { messages, loading, send };
}
