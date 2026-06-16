import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Trophy, Users, Search, Ticket, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  TOTAL_REQUIRED,
  TOTAL_LINES,
  formatCstDateTime,
  formatPhoneDisplay,
  raffleEntriesFor,
} from './bingoTasks';
import type { BingoPlayer } from './useBingoPlayer';

type SortKey = 'bingos' | 'entries' | 'name' | 'recent';

export function BingoAdminBoard() {
  const [players, setPlayers] = useState<BingoPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('bingos');

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

  const enriched = useMemo(() => players.map(p => ({
    ...p,
    entries: raffleEntriesFor(p.bingo_count || 0),
    hasLateCancel: (p.bingo_count || 0) >= 1,
    squaresDone: Array.isArray(p.marked_squares) ? p.marked_squares.filter(s => s !== 'free').length : 0,
  })), [players]);

  const rows = useMemo(() => {
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
    if (sort === 'bingos') sorted.sort((a, b) => b.bingo_count - a.bingo_count);
    if (sort === 'entries') sorted.sort((a, b) => b.entries - a.entries);
    if (sort === 'name') sorted.sort((a, b) => a.first_name.localeCompare(b.first_name));
    if (sort === 'recent') sorted.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return sorted;
  }, [enriched, search, sort]);

  const totalEntries = enriched.reduce((sum, p) => sum + p.entries, 0);
  const totalLateCancelsEarned = enriched.filter(p => p.hasLateCancel).length;
  const totalLateCancelsUsed = enriched.filter(p => p.late_cancel_used).length;
  const blackouts = enriched.filter(p => !!p.blackout_completed_at);

  const toggleLateCancelUsed = async (p: BingoPlayer, next: boolean) => {
    // Optimistic update
    setPlayers(prev => prev.map(x => x.id === p.id ? { ...x, late_cancel_used: next } : x));
    const { error } = await supabase.from('bingo_players' as any)
      .update({ late_cancel_used: next }).eq('id', p.id);
    if (error) {
      setPlayers(prev => prev.map(x => x.id === p.id ? { ...x, late_cancel_used: !next } : x));
      toast.error('Could not update late cancel.');
    } else {
      toast.success(next ? 'Late cancel marked used.' : 'Late cancel reset to available.');
    }
  };

  // Weighted raffle pool (one row per entry)
  const weightedPool = useMemo(() => {
    const rows: { player: BingoPlayer & { entries: number }; entryNum: number; overall: number }[] = [];
    let overall = 0;
    enriched
      .filter(p => p.entries > 0)
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
      .forEach(p => {
        for (let i = 1; i <= p.entries; i++) {
          overall += 1;
          rows.push({ player: p, entryNum: i, overall });
        }
      });
    return rows;
  }, [enriched]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile icon={<Users className="w-5 h-5 text-primary" />} label="Players" value={players.length} />
        <StatTile icon={<Sparkles className="w-5 h-5" style={{ color: '#FF6F0D' }} />} label="Late cancels earned" value={totalLateCancelsEarned} sub={`${totalLateCancelsUsed} used`} />
        <StatTile icon={<Ticket className="w-5 h-5" style={{ color: '#FF6F0D' }} />} label="Raffle entries (pool)" value={totalEntries} />
        <StatTile icon={<Trophy className="w-5 h-5" style={{ color: '#FF6F0D' }} />} label="Blackouts" value={blackouts.length} />
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
                <option value="bingos">Most bingos</option>
                <option value="entries">Most entries</option>
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
                  <div
                    key={p.id}
                    className={`rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isBlackout ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{p.first_name} {p.last_name}</span>
                        {isBlackout && <Badge style={{ background: '#FF6F0D', color: 'white' }} className="text-[10px]">Blackout</Badge>}
                        {p.hasLateCancel && (
                          <Badge variant={p.late_cancel_used ? 'secondary' : 'default'} className="text-[10px]">
                            {p.late_cancel_used ? 'Late cancel used' : 'Late cancel earned'}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        <span>{formatPhoneDisplay(p.phone_normalized)}</span>
                        <span>{p.email}</span>
                        {p.hasLateCancel && p.first_bingo_at && (
                          <span>1st bingo {formatCstDateTime(p.first_bingo_at)}</span>
                        )}
                        {isBlackout && <span className="text-primary">Blacked out {formatCstDateTime(p.blackout_completed_at)}</span>}
                      </div>
                      {p.share_slug && (
                        <button
                          onClick={async () => {
                            const url = `https://otf-tuscaloosa.lovable.app/bingo/s/${p.share_slug}`;
                            try { await navigator.clipboard.writeText(url); toast.success('Share link copied'); }
                            catch { toast.error('Copy failed'); }
                          }}
                          className="text-[11px] mt-1 underline text-primary hover:opacity-80"
                          title="Copy this player's share link"
                        >
                          /bingo/s/{p.share_slug}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-4 sm:gap-5 shrink-0">
                      <Metric label="Bingos" value={p.bingo_count} max={TOTAL_LINES} />
                      <Metric label="Entries" value={p.entries} />
                      <Metric label="Squares" value={p.squaresDone} max={TOTAL_REQUIRED} muted />
                      {p.hasLateCancel && (
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Used</span>
                          <Switch checked={p.late_cancel_used} onCheckedChange={(v) => toggleLateCancelUsed(p, v)} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {weightedPool.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Ticket className="w-4 h-4" style={{ color: '#FF6F0D' }} />
              Raffle pool — {weightedPool.length} {weightedPool.length === 1 ? 'entry' : 'entries'}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              One row per entry. A player with N bingos past the first appears N times. Pick a number 1–{weightedPool.length} by hand to draw.
            </p>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto rounded border">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 w-12">#</th>
                    <th className="text-left px-3 py-2">Player</th>
                    <th className="text-left px-3 py-2">Entry of player's</th>
                    <th className="text-left px-3 py-2">Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {weightedPool.map(({ player, entryNum, overall }) => (
                    <tr key={`${player.id}-${entryNum}`} className="border-t">
                      <td className="px-3 py-1.5 tabular-nums font-semibold">{overall}</td>
                      <td className="px-3 py-1.5">{player.first_name} {player.last_name}</td>
                      <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{entryNum} / {player.entries}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{formatPhoneDisplay(player.phone_normalized)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatTile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        {icon}
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, max, muted }: { label: string; value: number; max?: number; muted?: boolean }) {
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold tabular-nums leading-none ${muted ? 'opacity-60' : ''}`}>
        {value}{typeof max === 'number' && <span className="text-xs text-muted-foreground"> / {max}</span>}
      </p>
    </div>
  );
}

export default function BingoAdminPage() {
  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Summer Bingo — Admin</h1>
          <p className="text-sm text-muted-foreground">Live player roster, bingo counts, free late cancels, and the weighted raffle pool.</p>
        </div>
        <BingoAdminBoard />
      </div>
    </div>
  );
}
