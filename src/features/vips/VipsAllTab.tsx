import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Star, ArrowUpDown } from 'lucide-react';
import { format, parseISO, differenceInDays, isWithinInterval, addDays } from 'date-fns';
import { useVipsData } from './useVipsData';

type Sort = 'name' | 'last_interaction' | 'lifetime' | 'referrals';

export function VipsAllTab() {
  const navigate = useNavigate();
  const { members, lifetimeVisitsFor, registrations, bookings } = useVipsData();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('name');
  const [filter, setFilter] = useState<'all' | 'today' | 'overdue' | 'birthday'>('all');

  const todayBookingMembers = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayBookingIds = new Set(bookings.filter(b => b.class_date === today).map(b => b.id));
    const ids = new Set<string>();
    registrations.forEach(r => { if (r.booking_id && todayBookingIds.has(r.booking_id) && r.vip_member_id) ids.add(r.vip_member_id); });
    return ids;
  }, [bookings, registrations]);

  const filtered = useMemo(() => {
    let list = members.slice();
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter(m =>
        `${m.first_name} ${m.last_name || ''}`.toLowerCase().includes(needle) ||
        (m.phone || '').includes(needle) ||
        (m.email || '').toLowerCase().includes(needle)
      );
    }
    if (filter === 'today') list = list.filter(m => todayBookingMembers.has(m.id));
    if (filter === 'overdue') {
      list = list.filter(m => {
        const last = m.vip_last_interaction_at ? parseISO(m.vip_last_interaction_at) : null;
        return !last || differenceInDays(new Date(), last) > 14;
      });
    }
    if (filter === 'birthday') {
      const now = new Date();
      const end = addDays(now, 7);
      list = list.filter(m => {
        if (!m.birthday) return false;
        const b = parseISO(m.birthday);
        const ty = new Date(now.getFullYear(), b.getMonth(), b.getDate());
        return isWithinInterval(ty, { start: now, end });
      });
    }

    list.sort((a, b) => {
      switch (sort) {
        case 'name': return `${a.first_name} ${a.last_name || ''}`.localeCompare(`${b.first_name} ${b.last_name || ''}`);
        case 'last_interaction': return (b.vip_last_interaction_at || '').localeCompare(a.vip_last_interaction_at || '');
        case 'lifetime': return lifetimeVisitsFor(b) - lifetimeVisitsFor(a);
        case 'referrals': return b.vip_referral_count - a.vip_referral_count;
      }
    });
    return list;
  }, [members, q, sort, filter, todayBookingMembers, lifetimeVisitsFor]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search VIPs" className="pl-8 h-10" />
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          const order: Sort[] = ['name', 'last_interaction', 'lifetime', 'referrals'];
          setSort(order[(order.indexOf(sort) + 1) % order.length]);
        }}>
          <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
          {sort === 'name' ? 'Name' : sort === 'last_interaction' ? 'Recent' : sort === 'lifetime' ? 'Visits' : 'Referrals'}
        </Button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {([
          ['all', 'All'],
          ['today', 'Class today'],
          ['overdue', 'Overdue touch'],
          ['birthday', 'Birthday this week'],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`text-xs px-3 h-8 rounded-full border ${filter === k ? 'bg-[#E8540A] text-white border-[#E8540A]' : 'bg-background hover:bg-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-2 space-y-1">
          {filtered.length === 0 && <p className="text-xs text-muted-foreground p-3">No VIPs match.</p>}
          {filtered.map(m => (
            <button
              key={m.id}
              onClick={() => navigate(`/vips/${m.id}`)}
              className="w-full text-left p-3 rounded-md border hover:bg-muted/40 flex items-center justify-between min-h-[44px]"
            >
              <div className="flex items-center gap-2">
                <Star className="w-3.5 h-3.5 text-[#E8540A]" />
                <div>
                  <div className="text-sm font-medium">{m.first_name} {m.last_name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {m.vip_last_interaction_at ? `Last touch ${format(parseISO(m.vip_last_interaction_at), 'MMM d')}` : 'No touch yet'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-[10px]">{lifetimeVisitsFor(m)} visits</Badge>
                {m.vip_referral_count > 0 && <Badge variant="outline" className="text-[10px]">{m.vip_referral_count} refs</Badge>}
              </div>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
