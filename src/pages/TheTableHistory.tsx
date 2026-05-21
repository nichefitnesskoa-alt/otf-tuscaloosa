import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function TheTableHistory() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: meetings = [] } = useQuery({
    queryKey: ['table-history'],
    queryFn: async () => {
      // Show every prior week, not just ones manually marked complete.
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from('table_meetings').select('*')
        .lt('meeting_date', today)
        .order('meeting_date', { ascending: false });
      return data || [];
    },
  });

  const { data: detail } = useQuery({
    queryKey: ['table-history-detail', selected],
    enabled: !!selected,
    queryFn: async () => {
      const [m, e, r, a, c] = await Promise.all([
        supabase.from('table_meetings').select('*').eq('id', selected!).single(),
        supabase.from('table_owner_entries').select('*, table_owners(display_name, lane_name, is_architect)').eq('meeting_id', selected!),
        supabase.from('table_responses').select('*').eq('meeting_id', selected!),
        supabase.from('table_action_items').select('*').eq('meeting_id', selected!),
        supabase.from('table_closes').select('*').eq('meeting_id', selected!).maybeSingle(),
      ]);
      return { meeting: m.data, entries: e.data || [], responses: r.data || [], actions: a.data || [], close: c.data };
    },
  });

  return (
    <div className="p-4 max-w-3xl mx-auto pb-24">
      <Button variant="ghost" size="sm" onClick={() => navigate('/the-table')} className="mb-3">
        <ChevronLeft className="w-4 h-4 mr-1" /> Own It
      </Button>
      <h1 className="text-2xl font-bold mb-4">Past Meetings</h1>

      {!selected && (
        <div className="space-y-2">
          {meetings.map((m: any) => (
            <Card key={m.id} className="p-3 cursor-pointer hover:border-brand" onClick={() => setSelected(m.id)}>
              <div className="font-semibold">Own It — {format(new Date(m.meeting_date + 'T12:00:00'), 'MMM d, yyyy')}</div>
            </Card>
          ))}
          {meetings.length === 0 && <div className="text-muted-foreground text-center py-8">No completed meetings yet.</div>}
        </div>
      )}

      {selected && detail?.meeting && (
        <>
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="mb-3">← All meetings</Button>
          <h2 className="text-xl font-bold mb-3">Own It — {format(new Date(detail.meeting.meeting_date + 'T12:00:00'), 'MMM d, yyyy')}</h2>
          {detail.meeting.koa_open_note && <Card className="p-3 mb-3 border-2 border-brand/40 bg-brand/5"><div className="text-xs font-semibold uppercase mb-1 text-brand">Studio Leader Open</div>{detail.meeting.koa_open_note}</Card>}
          <div className="space-y-3">
            {detail.entries.filter((e: any) => !e.table_owners?.is_architect).map((e: any) => (
              <Card key={e.id} className="p-3">
                <div className="font-semibold">{e.table_owners?.display_name} · {e.table_owners?.lane_name || '—'}</div>
                <div className="text-xs space-y-1 mt-2">
                  {e.last_week_update && <div><b>Last week:</b> {e.last_week_update}</div>}
                  {e.this_week_focus && <div><b>This week:</b> {e.this_week_focus}</div>}
                  {e.ideas && <div><b>Ideas:</b> {e.ideas}</div>}
                  {e.ask && <div><b>Ask:</b> {e.ask}</div>}
                </div>
                <div className="mt-2">
                  {detail.responses.filter((r: any) => r.owner_entry_id === e.id).map((r: any) => (
                    <div key={r.id} className="text-xs border-l-2 pl-2 mt-1"><b>{r.responder_name}</b> ({r.mode}): {r.content}</div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
          {detail.actions.length > 0 && (
            <Card className="p-3 mt-3">
              <div className="font-semibold mb-2">Action items</div>
              {detail.actions.map((a: any) => (
                <div key={a.id} className="text-sm border-b last:border-0 py-1">{a.owner_name}: {a.description} — {a.status}</div>
              ))}
            </Card>
          )}
          {detail.close && (
            <Card className="p-3 mt-3 border-2 border-brand/40 bg-brand/5">
              <div className="text-xs font-semibold uppercase mb-1 text-brand">Studio Leader Close</div>
              {detail.close.koa_close_note && <p className="text-sm">{detail.close.koa_close_note}</p>}
              {detail.close.energy_word && <div className="mt-2 text-xs"><b>Energy word:</b> {detail.close.energy_word}</div>}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
