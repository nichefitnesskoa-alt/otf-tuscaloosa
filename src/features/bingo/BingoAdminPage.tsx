import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Trophy, Users, Search } from 'lucide-react';
import { REQUIRED_TASK_IDS, TOTAL_REQUIRED, formatCstDateTime, formatPhoneDisplay } from './bingoTasks';
import type { BingoPlayer } from './useBingoPlayer';

type SortKey = 'progress' | 'name' | 'recent';

/**
 * BingoAdminBoard — the embeddable roster + raffle pool.
 * Used by both the standalone /bingo-admin page and the Admin > Bingo tab.
 * Self-contained data fetch + realtime subscription on bingo_players.
 */
export function BingoAdminBoard() {
  const [players, setPlayers] = useState<BingoPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('progress');

  const refresh = async () => {
    const { data } = await supabase.from('bingo_players' as any).select('*').order('created_at', { ascending: false });
    setPlayers((data as any as BingoPlayer[]) || []);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    const ch = supabase
      .channel('bingo-players-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bingo_players' }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const rows = useMemo(() => {
    const enriched = players.map(p => {
      const done = REQUIRED_TASK_IDS.filter(id => p.marked_squares?.includes(id)).length;
      return { ...p, done };
    });
    const filtered = search.trim()
      ? enriched.filter(p => {
          const q = search.toLowerCase();
          return (
            p.first_name.toLowerCase().includes(q) ||
            p.last_name.toLowerCase().includes(q) ||
            p.phone_normalized.includes(q.replace(/\D/g, '')) ||
            p.email.toLowerCase().includes(q)
          );
        })
      : enriched;
    const sorted = [...filtered];
    if (sort === 'progress') sorted.sort((a, b) => b.done - a.done);
    if (sort === 'name') sorted.sort((a, b) => a.first_name.localeCompare(b.first_name));
    if (sort === 'recent') sorted.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return sorted;
  }, [players, search, sort]);

  const blackouts = players.filter(p => !!p.blackout_completed_at);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Players</p>
              <p className="text-2xl font-bold tabular-nums">{players.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Trophy className="w-5 h-5" style={{ color: '#FF6F0D' }} />
            <div>
              <p className="text-xs text-muted-foreground">Blackouts (raffle pool)</p>
              <p className="text-2xl font-bold tabular-nums">{blackouts.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">All players</CardTitle>
            <div className="flex gap-2 items-center">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-7 h-8 w-48" placeholder="Search name / phone / email" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="text-xs border rounded h-8 px-2 bg-background" value={sort} onChange={e => setSort(e.target.value as SortKey)}>
                <option value="progress">Most progress</option>
                <option value="recent">Newest</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No players yet.</p>
          ) : (
            <div className="space-y-1.5">
              {rows.map(p => {
                const isBlackout = !!p.blackout_completed_at;
                return (
                  <div key={p.id} className={`rounded-lg border p-3 flex items-center justify-between gap-3 ${isBlackout ? 'border-primary bg-primary/5' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{p.first_name} {p.last_name}</span>
                        {isBlackout && <Badge style={{ background: '#FF6F0D', color: 'white' }} className="text-[10px]">Blackout</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        <span>{formatPhoneDisplay(p.phone_normalized)}</span>
                        <span>{p.email}</span>
                        {isBlackout && <span className="text-primary">Blacked out {formatCstDateTime(p.blackout_completed_at)}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold tabular-nums">{p.done}<span className="text-xs text-muted-foreground"> / {TOTAL_REQUIRED}</span></p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {blackouts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="w-4 h-4" style={{ color: '#FF6F0D' }} />
              Raffle pool
            </CardTitle>
            <p className="text-xs text-muted-foreground">Blackout completers, in order finished. Draw one by hand.</p>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1 text-sm list-decimal list-inside">
              {[...blackouts].sort((a, b) => (a.blackout_completed_at! < b.blackout_completed_at! ? -1 : 1)).map(p => (
                <li key={p.id}>
                  <span className="font-medium">{p.first_name} {p.last_name}</span>
                  <span className="text-muted-foreground"> — {formatPhoneDisplay(p.phone_normalized)} · {formatCstDateTime(p.blackout_completed_at)}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function BingoAdminPage() {
  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Summer Bingo — Admin</h1>
          <p className="text-sm text-muted-foreground">Live roster of players, progress, and blackout completers (your raffle pool).</p>
        </div>
        <BingoAdminBoard />
      </div>
    </div>
  );
}
