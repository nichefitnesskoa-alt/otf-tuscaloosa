import { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { format, startOfWeek } from 'date-fns';
import { ArrowDownUp } from 'lucide-react';
import { useAllReferralAsks } from './useReferralAsks';
import { useJourneyCard } from '@/components/person/useJourneyCard';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReferralAskHistorySheet({ open, onOpenChange }: Props) {
  const { asks, loading } = useAllReferralAsks();
  const [search, setSearch] = useState('');
  const [sortDesc, setSortDesc] = useState(true);
  const journey = useJourneyCard('Referral · History');

  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    let rows = asks;
    if (needle) {
      rows = rows.filter(a =>
        a.member_name.toLowerCase().includes(needle) ||
        (a.friend_name ?? '').toLowerCase().includes(needle),
      );
    }
    return [...rows].sort((a, b) =>
      sortDesc
        ? new Date(b.asked_at).getTime() - new Date(a.asked_at).getTime()
        : new Date(a.asked_at).getTime() - new Date(b.asked_at).getTime(),
    );
  }, [asks, search, sortDesc]);

  const thisWeek = useMemo(
    () => asks.filter(a => new Date(a.asked_at) >= weekStart),
    [asks, weekStart],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-xl">
        <SheetHeader className="mb-3">
          <SheetTitle>Referral asks</SheetTitle>
        </SheetHeader>

        <div className="text-xs text-muted-foreground mb-3">
          {thisWeek.length} this week · {asks.length} all-time
        </div>

        <div className="flex items-center gap-2 mb-3">
          <Input
            placeholder="Search by member or friend name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 text-sm"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortDesc(s => !s)}
            className="h-9 text-xs gap-1 shrink-0"
          >
            <ArrowDownUp className="w-3 h-3" />
            {sortDesc ? 'Newest' : 'Oldest'}
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No asks logged yet.</p>
        ) : (
          <div className="divide-y divide-border border border-border rounded-md">
            {filtered.map(a => (
              <div key={a.id} className="p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => journey.open({ name: a.member_name })}
                    className="font-medium hover:underline cursor-pointer text-left"
                  >
                    {a.member_name}
                  </button>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(a.asked_at), 'MMM d · h:mma')}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Friend: {a.friend_name || '—'} · by {a.sa_name}
                  {a.shift_type ? ` · ${a.shift_type}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
      {journey.element}
    </Sheet>
  );
}
