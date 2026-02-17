import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { CalendarDays, ChevronDown, ChevronRight, TrendingUp, Copy, Check, FileText, MessageSquare, Dumbbell, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, startOfWeek, endOfWeek, parseISO, isBefore, isAfter } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { generateUniqueSlug } from '@/lib/utils';
import { PrepDrawer } from './PrepDrawer';
import { useScriptTemplates } from '@/hooks/useScriptTemplates';
import { selectBestScript } from '@/hooks/useSmartScriptSelect';
import { MessageGenerator } from '@/components/scripts/MessageGenerator';

const PUBLISHED_URL = 'https://otf-tuscaloosa.lovable.app';

interface WeekBooking {
  id: string;
  member_name: string;
  class_date: string;
  intro_time: string | null;
  coach_name: string;
  lead_source: string;
  phone: string | null;
  email: string | null;
  qStatus: string | null;
  qSlug: string | null;
  qId: string | null;
}

interface WeeklySnapshot {
  introsBooked: number;
  introsCompleted: number;
  purchases: number;
  noShows: number;
}

export function SoonLayer() {
  const { user } = useAuth();
  const { data: templates = [] } = useScriptTemplates();
  const [weekBookings, setWeekBookings] = useState<WeekBooking[]>([]);
  const [weeklySnapshot, setWeeklySnapshot] = useState<WeeklySnapshot | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [prepOpen, setPrepOpen] = useState(false);
  const [prepBooking, setPrepBooking] = useState<any>(null);
  const [scriptBooking, setScriptBooking] = useState<WeekBooking | null>(null);
  const [scriptTemplate, setScriptTemplate] = useState<any>(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const today = new Date();
    const tomorrow = addDays(today, 1);
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
    const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');

    const [bookingsRes, runsRes, salesRes, noShowRes] = await Promise.all([
      supabase
        .from('intros_booked')
        .select('id, member_name, class_date, intro_time, coach_name, lead_source, phone, email')
        .gte('class_date', tomorrowStr)
        .lte('class_date', weekEndStr)
        .is('deleted_at', null)
        .is('vip_class_name', null)
        .neq('booking_status', 'Closed – Bought')
        .order('class_date', { ascending: true })
        .order('intro_time', { ascending: true }),
      supabase.from('intros_run').select('id', { count: 'exact' }).gte('run_date', weekStart).lte('run_date', weekEndStr),
      supabase.from('intros_run').select('id', { count: 'exact' }).gte('run_date', weekStart).lte('run_date', weekEndStr).not('result', 'in', '("Didn\'t Buy","No-show","Follow-up needed","Booked 2nd intro")'),
      supabase.from('intros_run').select('id', { count: 'exact' }).gte('run_date', weekStart).lte('run_date', weekEndStr).eq('result', 'No-show'),
    ]);

    const bkgs = bookingsRes.data || [];
    const ids = bkgs.map(b => b.id);

    // Fetch Q status
    let qMap = new Map<string, { status: string; slug: string | null; id: string }>();
    if (ids.length > 0) {
      const { data: qs } = await supabase.from('intro_questionnaires').select('booking_id, status, slug, id').in('booking_id', ids);
      for (const q of (qs || [])) {
        const existing = qMap.get(q.booking_id);
        if (!existing || q.status === 'completed' || q.status === 'submitted') {
          qMap.set(q.booking_id, { status: q.status, slug: (q as any).slug, id: q.id });
        }
      }
    }

    setWeekBookings(bkgs.map(b => ({
      ...b,
      phone: (b as any).phone || null,
      email: (b as any).email || null,
      qStatus: qMap.get(b.id)?.status || null,
      qSlug: qMap.get(b.id)?.slug || null,
      qId: qMap.get(b.id)?.id || null,
    })));

    const weekIntros = await supabase.from('intros_booked').select('id', { count: 'exact' }).gte('class_date', weekStart).lte('class_date', weekEndStr).is('deleted_at', null).is('vip_class_name', null);

    setWeeklySnapshot({
      introsBooked: weekIntros.count || 0,
      introsCompleted: runsRes.count || 0,
      purchases: salesRes.count || 0,
      noShows: noShowRes.count || 0,
    });
  };

  const toggleDay = (day: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day); else next.add(day);
      return next;
    });
  };

  // Group bookings by day
  const dayGroups = useMemo(() => {
    const groups = new Map<string, WeekBooking[]>();
    weekBookings.forEach(b => {
      const day = b.class_date;
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day)!.push(b);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [weekBookings]);

  // Q stats
  const totalWeekIntros = weekBookings.length;
  const qSentCount = weekBookings.filter(b => b.qStatus && b.qStatus !== 'not_sent').length;
  const qSentPct = totalWeekIntros > 0 ? Math.round((qSentCount / totalWeekIntros) * 100) : 0;

  const getQBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline" className="text-[9px] h-3.5 px-1 text-muted-foreground">No Q</Badge>;
    if (status === 'completed' || status === 'submitted') return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[9px] h-3.5 px-1 border">Q Done</Badge>;
    if (status === 'sent') return <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[9px] h-3.5 px-1 border">Q Sent</Badge>;
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] h-3.5 px-1 border">Q Pending</Badge>;
  };

  const handleSendQ = async (b: WeekBooking) => {
    let slug = b.qSlug;
    let qId = b.qId;

    // Auto-create Q if none exists
    if (!qId) {
      const nameParts = b.member_name.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      slug = await generateUniqueSlug(firstName, lastName, supabase);
      const newId = crypto.randomUUID();
      await supabase.from('intro_questionnaires').insert({
        id: newId,
        booking_id: b.id,
        client_first_name: firstName,
        client_last_name: lastName,
        scheduled_class_date: b.class_date,
        scheduled_class_time: b.intro_time || null,
        status: 'not_sent',
        slug,
      } as any);
      qId = newId;
    }

    const link = slug ? `${PUBLISHED_URL}/q/${slug}` : `${PUBLISHED_URL}/q/${qId}`;
    await navigator.clipboard.writeText(link);

    // Mark as sent
    if (qId) {
      await supabase.from('intro_questionnaires').update({ status: 'sent' }).eq('id', qId);
    }

    setCopiedId(b.id);
    setTimeout(() => setCopiedId(null), 2000);

    setWeekBookings(prev => prev.map(wb => wb.id === b.id ? { ...wb, qStatus: 'sent', qSlug: slug, qId } : wb));
    toast.success(`Q link copied for ${b.member_name}!`);
  };

  const handlePrep = (b: WeekBooking) => {
    setPrepBooking({
      memberName: b.member_name,
      memberKey: b.member_name.toLowerCase().replace(/\s+/g, ''),
      bookingId: b.id,
      classDate: b.class_date,
      classTime: b.intro_time,
      coachName: b.coach_name,
      leadSource: b.lead_source,
      isSecondIntro: false,
      phone: b.phone,
      email: b.email,
    });
    setPrepOpen(true);
  };

  const handleScript = (b: WeekBooking) => {
    const result = selectBestScript({ personType: 'booking', classDate: b.class_date }, templates);
    if (result.template) {
      setScriptTemplate(result.template);
      setScriptBooking(b);
    } else {
      toast.info('No matching script found');
    }
  };

  const handleCopyPhone = (b: WeekBooking) => {
    if (b.phone) {
      navigator.clipboard.writeText(b.phone);
      toast.success('Phone copied!');
    } else {
      toast.info('No phone on file');
    }
  };

  return (
    <div className="space-y-3">
      {/* Q Progress Bar */}
      {totalWeekIntros > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Qs sent: {qSentCount}/{totalWeekIntros}</span>
            <span className="font-medium">{qSentPct}%</span>
          </div>
          <Progress value={qSentPct} className="h-2" />
        </div>
      )}

      {/* Day-by-day view */}
      {dayGroups.map(([day, bkgs]) => {
        const isExpanded = expandedDays.has(day);
        const dayLabel = format(parseISO(day), 'EEEE MMM d');
        const dayQSent = bkgs.filter(b => b.qStatus && b.qStatus !== 'not_sent').length;

        return (
          <Collapsible key={day} open={isExpanded} onOpenChange={() => toggleDay(day)}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-2 cursor-pointer">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <CalendarDays className="w-4 h-4 text-purple-600" />
                    {dayLabel}
                    <Badge variant="secondary" className="text-[10px] ml-auto">
                      {bkgs.length} intro{bkgs.length !== 1 ? 's' : ''}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{dayQSent}/{bkgs.length} Q</span>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-3 space-y-2">
                  {bkgs.map(b => (
                    <div key={b.id} className="rounded-lg border bg-card p-2.5 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{b.member_name}</span>
                        {getQBadge(b.qStatus)}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{b.intro_time ? format(parseISO(`2000-01-01T${b.intro_time}`), 'h:mm a') : 'TBD'}</span>
                        <span>·</span>
                        <span>{b.coach_name}</span>
                        {b.phone && (
                          <a href={`tel:${b.phone}`} className="hover:text-primary" onClick={e => e.stopPropagation()}>
                            <Phone className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[10px] gap-1"
                          onClick={() => handleSendQ(b)}
                        >
                          {copiedId === b.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedId === b.id ? 'Copied!' : 'Send Q'}
                        </Button>
                        <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={() => handlePrep(b)}>
                          <FileText className="w-3 h-3" /> Prep
                        </Button>
                        <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={() => handleScript(b)}>
                          <MessageSquare className="w-3 h-3" /> Script
                        </Button>
                        <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={() => handleCopyPhone(b)}>
                          <Phone className="w-3 h-3" /> Copy #
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}

      {dayGroups.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No intros scheduled for the rest of this week</p>
      )}

      {/* Weekly Snapshot */}
      {weeklySnapshot && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Intros</span>
                <span className="font-medium">{weeklySnapshot.introsCompleted}/{weeklySnapshot.introsBooked}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Purchases</span>
                <span className="font-medium text-emerald-700">{weeklySnapshot.purchases}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">No-shows</span>
                <span className="font-medium text-destructive">{weeklySnapshot.noShows}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Remaining</span>
                <span className="font-medium">{Math.max(0, weeklySnapshot.introsBooked - weeklySnapshot.introsCompleted)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prep Drawer */}
      {prepBooking && <PrepDrawer open={prepOpen} onOpenChange={setPrepOpen} {...prepBooking} />}

      {/* Script Generator */}
      {scriptBooking && scriptTemplate && (
        <MessageGenerator
          open={true}
          onOpenChange={o => { if (!o) { setScriptBooking(null); setScriptTemplate(null); } }}
          template={scriptTemplate}
          mergeContext={{
            'first-name': scriptBooking.member_name.split(' ')[0],
            'last-name': scriptBooking.member_name.split(' ').slice(1).join(' '),
            'sa-name': user?.name || '',
            'location-name': 'Tuscaloosa',
          }}
          bookingId={scriptBooking.id}
          onLogged={() => { setScriptBooking(null); setScriptTemplate(null); fetchAll(); }}
        />
      )}
    </div>
  );
}
