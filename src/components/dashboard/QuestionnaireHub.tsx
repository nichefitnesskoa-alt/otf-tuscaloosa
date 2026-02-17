import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Search, Copy, Check, ClipboardList, Calendar, User, Phone, ChevronDown, ChevronRight,
  MessageSquare, Dumbbell, FileText, ExternalLink, Loader2, Eye, EyeOff, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInHours, differenceInDays, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { PrepDrawer } from './PrepDrawer';
import { CoachPrepCard } from './CoachPrepCard';
import { MessageGenerator } from '@/components/scripts/MessageGenerator';
import { useScriptTemplates } from '@/hooks/useScriptTemplates';
import { selectBestScript } from '@/hooks/useSmartScriptSelect';

const PUBLISHED_URL = 'https://otf-tuscaloosa.lovable.app';

interface QRecord {
  id: string;
  booking_id: string | null;
  client_first_name: string;
  client_last_name: string;
  status: string;
  slug: string | null;
  created_at: string;
  submitted_at: string | null;
  last_opened_at: string | null;
  q1_fitness_goal: string | null;
  q2_fitness_level: number | null;
  q3_obstacle: string | null;
  q4_past_experience: string | null;
  q5_emotional_driver: string | null;
  q6_weekly_commitment: string | null;
  q6b_available_days: string | null;
  q7_coach_notes: string | null;
  scheduled_class_date: string;
  scheduled_class_time: string | null;
}

interface BookingInfo {
  id: string;
  member_name: string;
  class_date: string;
  intro_time: string | null;
  coach_name: string;
  lead_source: string;
  phone: string | null;
  email: string | null;
  booking_status: string | null;
}

interface RunInfo {
  member_name: string;
  result: string;
  linked_intro_booked_id: string | null;
}

export function QuestionnaireHub() {
  const { user } = useAuth();
  const { data: templates = [] } = useScriptTemplates();
  const [questionnaires, setQuestionnaires] = useState<QRecord[]>([]);
  const [bookings, setBookings] = useState<BookingInfo[]>([]);
  const [runs, setRuns] = useState<RunInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedQ, setExpandedQ] = useState<string | null>(null);

  // Prep / Coach / Script state
  const [prepOpen, setPrepOpen] = useState(false);
  const [prepBooking, setPrepBooking] = useState<any>(null);
  const [coachQ, setCoachQ] = useState<string | null>(null);
  const [scriptQ, setScriptQ] = useState<QRecord | null>(null);
  const [scriptTemplate, setScriptTemplate] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [qRes, bRes, rRes] = await Promise.all([
        supabase
          .from('intro_questionnaires')
          .select('id, booking_id, client_first_name, client_last_name, status, slug, created_at, submitted_at, last_opened_at, q1_fitness_goal, q2_fitness_level, q3_obstacle, q4_past_experience, q5_emotional_driver, q6_weekly_commitment, q6b_available_days, q7_coach_notes, scheduled_class_date, scheduled_class_time' as any)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('intros_booked')
          .select('id, member_name, class_date, intro_time, coach_name, lead_source, phone, email, booking_status')
          .is('deleted_at', null),
        supabase
          .from('intros_run')
          .select('member_name, result, linked_intro_booked_id'),
      ]);

      setQuestionnaires((qRes.data || []) as unknown as QRecord[]);
      setBookings((bRes.data || []) as BookingInfo[]);
      setRuns((rRes.data || []) as RunInfo[]);
    } catch (err) {
      console.error('QuestionnaireHub fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Build lookup maps
  const bookingMap = useMemo(() => {
    const m = new Map<string, BookingInfo>();
    bookings.forEach(b => m.set(b.id, b));
    return m;
  }, [bookings]);

  const purchasedBookingIds = useMemo(() => {
    const s = new Set<string>();
    runs.forEach(r => {
      const res = (r.result || '').toLowerCase();
      if (['premier', 'elite', 'basic'].some(k => res.includes(k))) {
        if (r.linked_intro_booked_id) s.add(r.linked_intro_booked_id);
      }
    });
    return s;
  }, [runs]);

  const purchasedNames = useMemo(() => {
    const s = new Set<string>();
    runs.forEach(r => {
      const res = (r.result || '').toLowerCase();
      if (['premier', 'elite', 'basic'].some(k => res.includes(k))) {
        s.add(r.member_name.toLowerCase().trim());
      }
    });
    return s;
  }, [runs]);

  // Get person status
  const getPersonStatus = (q: QRecord): string => {
    const booking = q.booking_id ? bookingMap.get(q.booking_id) : null;
    if (booking) {
      if (purchasedBookingIds.has(booking.id)) {
        const run = runs.find(r => r.linked_intro_booked_id === booking.id && ['premier', 'elite', 'basic'].some(k => r.result.toLowerCase().includes(k)));
        return `Purchased (${run?.result || 'Member'})`;
      }
      const noShowRun = runs.find(r => r.linked_intro_booked_id === booking.id && r.result === 'No-show');
      if (noShowRun) return 'No Show';
      const didntBuyRun = runs.find(r => r.linked_intro_booked_id === booking.id && r.result === "Didn't Buy");
      if (didntBuyRun) return "Didn't Buy";
      if (booking.booking_status === 'Active') return 'Active booking';
    }
    const fullName = `${q.client_first_name} ${q.client_last_name}`.trim().toLowerCase();
    if (purchasedNames.has(fullName)) return 'Purchased';
    return q.booking_id ? 'Booking linked' : 'No booking linked';
  };

  const getStatusColor = (status: string) => {
    if (status.startsWith('Purchased')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (status === 'Active booking') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (status === 'No Show') return 'bg-destructive/10 text-destructive border-destructive/20';
    if (status === "Didn't Buy") return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-muted text-muted-foreground border-border';
  };

  // Filter by search
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return questionnaires;
    const term = searchTerm.toLowerCase();
    return questionnaires.filter(q =>
      `${q.client_first_name} ${q.client_last_name}`.toLowerCase().includes(term)
    );
  }, [questionnaires, searchTerm]);

  // Tab categorization
  const pending = filtered.filter(q => q.status === 'not_sent');
  const sent = filtered.filter(q => q.status === 'sent');
  const completed = filtered.filter(q => q.status === 'completed' || q.status === 'submitted');
  const bought = completed.filter(q => {
    if (q.booking_id && purchasedBookingIds.has(q.booking_id)) return true;
    const fullName = `${q.client_first_name} ${q.client_last_name}`.trim().toLowerCase();
    return purchasedNames.has(fullName);
  });

  // Stats
  const totalQs = questionnaires.length;
  const sentAndCompleted = questionnaires.filter(q => q.status === 'sent' || q.status === 'completed' || q.status === 'submitted');
  const completedAll = questionnaires.filter(q => q.status === 'completed' || q.status === 'submitted');
  const completionRate = sentAndCompleted.length > 0 ? Math.round((completedAll.length / sentAndCompleted.length) * 100) : 0;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const weekQs = questionnaires.filter(q => q.created_at >= sevenDaysAgo);
  const weekSentAndCompleted = weekQs.filter(q => q.status === 'sent' || q.status === 'completed' || q.status === 'submitted');
  const weekCompleted = weekQs.filter(q => q.status === 'completed' || q.status === 'submitted');
  const weekRate = weekSentAndCompleted.length > 0 ? Math.round((weekCompleted.length / weekSentAndCompleted.length) * 100) : 0;

  const openedNotCompleted = questionnaires.filter(q => q.status === 'sent' && q.last_opened_at).length;

  const copyLink = async (q: QRecord) => {
    const link = q.slug ? `${PUBLISHED_URL}/q/${q.slug}` : `${PUBLISHED_URL}/q/${q.id}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(q.id);
      setTimeout(() => setCopiedId(null), 2000);
      if (q.status === 'not_sent') {
        await supabase.from('intro_questionnaires').update({ status: 'sent' }).eq('id', q.id);
        setQuestionnaires(prev => prev.map(x => x.id === q.id ? { ...x, status: 'sent' } : x));
      }
      toast.success('Link copied!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const openPrep = (q: QRecord) => {
    const booking = q.booking_id ? bookingMap.get(q.booking_id) : null;
    if (booking) {
      setPrepBooking({
        memberName: booking.member_name,
        memberKey: booking.member_name.toLowerCase().replace(/\s+/g, ''),
        bookingId: booking.id,
        classDate: booking.class_date,
        classTime: booking.intro_time,
        coachName: booking.coach_name,
        leadSource: booking.lead_source,
        isSecondIntro: false,
        phone: booking.phone,
        email: booking.email,
      });
      setPrepOpen(true);
    } else {
      // No booking - still open prep with Q data
      setPrepBooking({
        memberName: `${q.client_first_name} ${q.client_last_name}`.trim(),
        memberKey: `${q.client_first_name}${q.client_last_name}`.toLowerCase().replace(/\s+/g, ''),
        bookingId: q.id, // Use Q id as fallback - prep will fetch by this
        classDate: q.scheduled_class_date,
        classTime: q.scheduled_class_time,
        coachName: 'TBD',
        leadSource: '',
        isSecondIntro: false,
        phone: null,
        email: null,
      });
      setPrepOpen(true);
    }
  };

  const openCoach = (q: QRecord) => {
    const booking = q.booking_id ? bookingMap.get(q.booking_id) : null;
    if (booking) {
      setCoachQ(q.id);
    } else {
      setCoachQ(q.id);
    }
  };

  const openScript = (q: QRecord) => {
    const firstName = q.client_first_name || '';
    const result = selectBestScript({
      personType: 'booking',
      classDate: q.scheduled_class_date,
    }, templates);
    if (result.template) {
      setScriptTemplate(result.template);
      setScriptQ(q);
    } else {
      toast.info('No matching script found');
    }
  };

  const copyPhone = (q: QRecord) => {
    const booking = q.booking_id ? bookingMap.get(q.booking_id) : null;
    if (booking?.phone) {
      navigator.clipboard.writeText(booking.phone);
      toast.success('Phone copied!');
    } else {
      toast.info('No phone on file');
    }
  };

  const renderQCard = (q: QRecord, showAnswers = false) => {
    const booking = q.booking_id ? bookingMap.get(q.booking_id) : null;
    const fullName = `${q.client_first_name} ${q.client_last_name}`.trim();
    const status = getPersonStatus(q);
    const isExpanded = expandedQ === q.id;

    return (
      <div key={q.id} className="rounded-lg border bg-card p-3 space-y-2">
        {/* Row 1: Name + Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm">{fullName}</p>
          <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border', getStatusColor(status))}>
            {status}
          </Badge>
        </div>

        {/* Row 2: Date/Time/Coach/Phone */}
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <Calendar className="w-3 h-3" />
            {q.scheduled_class_date}
          </span>
          {(booking?.intro_time || q.scheduled_class_time) && (
            <span>{(booking?.intro_time || q.scheduled_class_time)?.substring(0, 5)}</span>
          )}
          {booking?.coach_name && (
            <span className="flex items-center gap-0.5">
              <User className="w-3 h-3" />
              {booking.coach_name}
            </span>
          )}
          {booking?.phone && (
            <a href={`tel:${booking.phone}`} className="flex items-center gap-0.5 hover:text-primary" onClick={e => e.stopPropagation()}>
              <Phone className="w-3 h-3" />
              {booking.phone}
            </a>
          )}
        </div>

        {/* Q-specific info */}
        {q.status === 'sent' && (
          <div className="text-[11px] text-muted-foreground">
            {q.last_opened_at ? (
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3 text-amber-600" />
                Opened {formatDistanceToNow(new Date(q.last_opened_at), { addSuffix: true })} — not completed
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <EyeOff className="w-3 h-3" /> Not opened yet
              </span>
            )}
          </div>
        )}

        {q.status === 'completed' && q.submitted_at && (
          <div className="text-[11px] text-muted-foreground">
            Completed {format(new Date(q.submitted_at), 'MMM d, yyyy h:mm a')}
          </div>
        )}

        {/* Expandable Q Answers */}
        {showAnswers && (
          <Collapsible open={isExpanded} onOpenChange={() => setExpandedQ(isExpanded ? null : q.id)}>
            <CollapsibleTrigger className="flex items-center gap-1 text-[11px] text-primary font-medium cursor-pointer hover:underline">
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {isExpanded ? 'Hide Answers' : 'View Answers'}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="rounded-md border-l-4 border-l-primary bg-primary/5 p-2.5 text-xs space-y-1.5">
                {q.q1_fitness_goal && <QRow label="Fitness Goal" value={q.q1_fitness_goal} />}
                {q.q2_fitness_level && <QRow label="Fitness Level" value={`${q.q2_fitness_level}/5`} />}
                {q.q3_obstacle && <QRow label="Obstacle" value={q.q3_obstacle} />}
                {q.q4_past_experience && <QRow label="Past Experience" value={q.q4_past_experience} />}
                {q.q5_emotional_driver && <QRow label="Why This Matters" value={q.q5_emotional_driver} />}
                {q.q6_weekly_commitment && <QRow label="Weekly Commitment" value={q.q6_weekly_commitment} />}
                {q.q6b_available_days && <QRow label="Available Days" value={q.q6b_available_days} />}
                {q.q7_coach_notes && <QRow label="Coach Notes" value={q.q7_coach_notes} />}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 pt-1">
          <Button variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1" onClick={() => openPrep(q)}>
            <FileText className="w-3 h-3" /> Prep
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1" onClick={() => openScript(q)}>
            <MessageSquare className="w-3 h-3" /> Script
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1 text-blue-700 border-blue-200 hover:bg-blue-50" onClick={() => openCoach(q)}>
            <Dumbbell className="w-3 h-3" /> Coach
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1" onClick={() => copyPhone(q)}>
            <Phone className="w-3 h-3" /> Copy #
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px] gap-1 ml-auto"
            onClick={() => copyLink(q)}
          >
            {copiedId === q.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copiedId === q.id ? 'Copied' : 'Q Link'}
          </Button>
        </div>
      </div>
    );
  };

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      {/* Stats Banner */}
      <div className="grid grid-cols-4 gap-2">
        <StatBox label="Total Qs" value={totalQs} />
        <StatBox label="Completion" value={`${completionRate}%`} accent={completionRate >= 70 ? 'emerald' : completionRate >= 40 ? 'amber' : 'red'} />
        <StatBox label="This Week" value={`${weekRate}%`} accent={weekRate >= 70 ? 'emerald' : weekRate >= 40 ? 'amber' : 'red'} />
        <StatBox label="Opened, Not Done" value={openedNotCompleted} accent={openedNotCompleted > 0 ? 'amber' : undefined} />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="pending" className="text-xs">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="sent" className="text-xs">Sent ({sent.length})</TabsTrigger>
          <TabsTrigger value="completed" className="text-xs">Done ({completed.length})</TabsTrigger>
          <TabsTrigger value="bought" className="text-xs">Bought ({bought.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-2 mt-2">
          {pending.length === 0 ? <EmptyState text="No pending questionnaires" /> : pending.map(q => renderQCard(q))}
        </TabsContent>

        <TabsContent value="sent" className="space-y-2 mt-2">
          {sent.length === 0 ? <EmptyState text="No sent questionnaires" /> : sent.map(q => renderQCard(q))}
        </TabsContent>

        <TabsContent value="completed" className="space-y-2 mt-2">
          {completed.length === 0 ? <EmptyState text="No completed questionnaires" /> : completed.map(q => renderQCard(q, true))}
        </TabsContent>

        <TabsContent value="bought" className="space-y-2 mt-2">
          {bought.length === 0 ? <EmptyState text="No purchased members with questionnaires" /> : bought.map(q => renderQCard(q, true))}
        </TabsContent>
      </Tabs>

      {/* Prep Drawer */}
      {prepBooking && (
        <PrepDrawer
          open={prepOpen}
          onOpenChange={setPrepOpen}
          {...prepBooking}
        />
      )}

      {/* Coach Prep Dialog */}
      {coachQ && (() => {
        const q = questionnaires.find(x => x.id === coachQ);
        const booking = q?.booking_id ? bookingMap.get(q.booking_id) : null;
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setCoachQ(null)}>
            <div className="bg-background rounded-t-xl sm:rounded-xl w-full max-w-md max-h-[80vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
              <CoachPrepCard
                memberName={booking?.member_name || `${q?.client_first_name} ${q?.client_last_name}`.trim() || ''}
                classTime={booking?.intro_time || q?.scheduled_class_time || null}
                bookingId={booking?.id || q?.id || ''}
              />
              <Button variant="outline" className="w-full mt-3" onClick={() => setCoachQ(null)}>Close</Button>
            </div>
          </div>
        );
      })()}

      {/* Script Generator */}
      {scriptQ && scriptTemplate && (
        <MessageGenerator
          open={true}
          onOpenChange={o => { if (!o) { setScriptQ(null); setScriptTemplate(null); } }}
          template={scriptTemplate}
          mergeContext={{
            'first-name': scriptQ.client_first_name,
            'last-name': scriptQ.client_last_name,
            'sa-name': user?.name || '',
            'location-name': 'Tuscaloosa',
          }}
          bookingId={scriptQ.booking_id || undefined}
          onLogged={() => { setScriptQ(null); setScriptTemplate(null); fetchData(); }}
        />
      )}
    </div>
  );
}

function QRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <span className="font-semibold text-muted-foreground">{label}: </span>
      <span>{value}</span>
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string | number; accent?: 'emerald' | 'amber' | 'red' }) {
  const colorMap = {
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    amber: 'text-amber-700 bg-amber-50 border-amber-200',
    red: 'text-red-700 bg-red-50 border-red-200',
  };
  return (
    <div className={cn('rounded-md border p-2 text-center', accent ? colorMap[accent] : 'bg-muted/30')}>
      <div className="text-lg font-bold leading-tight">{value}</div>
      <div className="text-[10px] text-muted-foreground font-medium">{label}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground py-4 text-center">{text}</p>;
}
