import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Cake, Star, Clock, Users } from 'lucide-react';
import { format, differenceInDays, parseISO, addDays, isWithinInterval } from 'date-fns';
import { getTodayYMD } from '@/lib/dateUtils';
import { useVipsData, type VipMember } from './useVipsData';
import { LogTouchpointDialog } from './LogTouchpointDialog';

const OVERDUE_DAYS = 14;

function Section({ title, count, color, children, defaultOpen = true }: any) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 border-b cursor-pointer hover:bg-muted/40">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{title}</h3>
              <Badge variant="secondary" className={color}>{count}</Badge>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-2 space-y-1.5">
            {count === 0 ? <p className="text-xs text-muted-foreground p-2">Nothing here.</p> : children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function VipsTodayTab() {
  const navigate = useNavigate();
  const { members, registrations, bookings, isCoach } = useVipsData();
  const [touchTarget, setTouchTarget] = useState<VipMember | null>(null);

  const today = getTodayYMD();

  // Class today: VIP bookings whose class_date = today
  const classToday = useMemo(() => {
    const todayBookings = bookings.filter(b => b.class_date === today);
    const memberById = new Map(members.map(m => [m.id, m]));
    const regByBooking = new Map(registrations.filter(r => r.booking_id).map(r => [r.booking_id!, r]));
    return todayBookings
      .map(b => {
        const reg = regByBooking.get(b.id);
        const member = reg?.vip_member_id ? memberById.get(reg.vip_member_id) : undefined;
        return { booking: b, member };
      })
      .filter(x => !isCoach || !!x.member) // coach scope already filtered
      .sort((a, b) => (a.booking.intro_time || '').localeCompare(b.booking.intro_time || ''));
  }, [bookings, members, registrations, today, isCoach]);

  // Overdue touch
  const overdue = useMemo(() => {
    const now = new Date();
    return members
      .map(m => {
        const last = m.vip_last_interaction_at ? parseISO(m.vip_last_interaction_at) : null;
        const days = last ? differenceInDays(now, last) : 999;
        return { m, days };
      })
      .filter(x => x.days > OVERDUE_DAYS)
      .sort((a, b) => b.days - a.days);
  }, [members]);

  // This week: birthdays + milestone dates in next 7 days
  const thisWeek = useMemo(() => {
    const now = new Date();
    const end = addDays(now, 7);
    const items: { m: VipMember; label: string; date: Date }[] = [];
    members.forEach(m => {
      if (!m.birthday) return;
      const bday = parseISO(m.birthday);
      const thisYearBday = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
      if (isWithinInterval(thisYearBday, { start: now, end })) {
        items.push({ m, label: `Birthday ${format(thisYearBday, 'EEE MMM d')}`, date: thisYearBday });
      }
    });
    return items.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [members]);

  return (
    <div className="space-y-3">
      <Section title="Class today" count={classToday.length} color="bg-[#E8540A]/15 text-[#E8540A]">
        {classToday.map(({ booking, member }) => (
          <button
            key={booking.id}
            onClick={() => member && navigate(`/vips/${member.id}`)}
            className="w-full text-left p-3 rounded-md border hover:bg-muted/40 flex items-center justify-between min-h-[44px]"
          >
            <div>
              <div className="text-sm font-medium flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-[#E8540A]" />
                {booking.member_name}
              </div>
              <div className="text-xs text-muted-foreground">
                {booking.intro_time?.slice(0, 5)} · {booking.coach_name}
              </div>
            </div>
            {member?.vip_last_interaction_at && (
              <div className="text-[10px] text-muted-foreground">
                Last touch {format(parseISO(member.vip_last_interaction_at), 'MMM d')}
              </div>
            )}
          </button>
        ))}
      </Section>

      <Section title="Overdue touch (>14 days)" count={overdue.length} color="bg-amber-500/15 text-amber-700">
        {overdue.map(({ m, days }) => (
          <div key={m.id} className="p-3 rounded-md border flex items-center justify-between gap-2 min-h-[44px]">
            <button onClick={() => navigate(`/vips/${m.id}`)} className="flex-1 text-left">
              <div className="text-sm font-medium">{m.first_name} {m.last_name}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {days >= 999 ? 'No interaction logged' : `${days} days ago`}
              </div>
            </button>
            {!isCoach && (
              <Button size="sm" variant="outline" className="h-9" onClick={() => setTouchTarget(m)}>
                Log touch
              </Button>
            )}
          </div>
        ))}
      </Section>

      <Section title="This week" count={thisWeek.length} color="bg-pink-500/15 text-pink-700">
        {thisWeek.map(({ m, label }) => (
          <button
            key={m.id + label}
            onClick={() => navigate(`/vips/${m.id}`)}
            className="w-full text-left p-3 rounded-md border hover:bg-muted/40 flex items-center justify-between min-h-[44px]"
          >
            <div>
              <div className="text-sm font-medium">{m.first_name} {m.last_name}</div>
              <div className="text-xs text-pink-700 flex items-center gap-1">
                <Cake className="w-3 h-3" /> {label}
              </div>
            </div>
          </button>
        ))}
      </Section>

      <LogTouchpointDialog
        vipMemberId={touchTarget?.id || null}
        memberName={touchTarget ? `${touchTarget.first_name} ${touchTarget.last_name || ''}`.trim() : undefined}
        open={!!touchTarget}
        onOpenChange={o => !o && setTouchTarget(null)}
      />
    </div>
  );
}
