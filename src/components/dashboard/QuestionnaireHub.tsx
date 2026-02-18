import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  Search, Copy, Check, ClipboardList, Calendar, User, Phone, ChevronDown, ChevronRight,
  MessageSquare, Dumbbell, FileText, Loader2, Eye, EyeOff, Trash2, Link2, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { PrepDrawer } from './PrepDrawer';
import { CoachPrepCard } from './CoachPrepCard';
import { MessageGenerator } from '@/components/scripts/MessageGenerator';
import { useScriptTemplates } from '@/hooks/useScriptTemplates';
import { selectBestScript } from '@/hooks/useSmartScriptSelect';
import { isVipBooking } from '@/lib/vip/vipRules';

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
  archived_at?: string | null;
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

  // Archive dialog
  const [archiveTarget, setArchiveTarget] = useState<QRecord | null>(null);

  // Link to booking dialog
  const [linkTarget, setLinkTarget] = useState<QRecord | null>(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkBookingId, setLinkBookingId] = useState('');

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
          .select('id, booking_id, client_first_name, client_last_name, status, slug, created_at, submitted_at, last_opened_at, q1_fitness_goal, q2_fitness_level, q3_obstacle, q4_past_experience, q5_emotional_driver, q6_weekly_commitment, q6b_available_days, q7_coach_notes, scheduled_class_date, scheduled_class_time, archived_at' as any)
          .is('archived_at' as any, null)
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

      const allQ = (qRes.data || []) as unknown as QRecord[];
      const allBookings = (bRes.data || []) as BookingInfo[];
      const allRuns = (rRes.data || []) as RunInfo[];

      setBookings(allBookings);
      setRuns(allRuns);

      // Auto-link unlinked questionnaires to bookings by name
      const nameToBooking = new Map<string, string>();
      allBookings.forEach(b => {
        const key = b.member_name.toLowerCase().trim();
        if (!nameToBooking.has(key)) nameToBooking.set(key, b.id);
      });

      const toLink: { qId: string; bookingId: string }[] = [];
      const linkedQ = allQ.map(q => {
        if (q.booking_id) return q;
        const fullName = `${q.client_first_name} ${q.client_last_name}`.trim().toLowerCase();
        const matchedId = nameToBooking.get(fullName);
        if (matchedId) {
          toLink.push({ qId: q.id, bookingId: matchedId });
          return { ...q, booking_id: matchedId };
        }
        return q;
      });

      setQuestionnaires(linkedQ);

      // Fire-and-forget auto-link updates
      if (toLink.length > 0) {
        toLink.forEach(({ qId, bookingId }) => {
          supabase.from('intro_questionnaires').update({ booking_id: bookingId }).eq('id', qId).then(() => {});
        });
      }
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

  // Didn't Buy detection
  const didntBuyBookingIds = useMemo(() => {
    const s = new Set<string>();
    runs.forEach(r => {
      if (r.result === "Didn't Buy" && r.linked_intro_booked_id) s.add(r.linked_intro_booked_id);
    });
    return s;
  }, [runs]);

  const didntBuyNames = useMemo(() => {
    const s = new Set<string>();
    runs.forEach(r => {
      if (r.result === "Didn't Buy") s.add(r.member_name.toLowerCase().trim());
    });
    return s;
  }, [runs]);

  // Not interested detection
  const notInterestedBookingIds = useMemo(() => {
    const s = new Set<string>();
    bookings.forEach(b => {
      if (b.booking_status?.toLowerCase().includes('not interested')) s.add(b.id);
    });
    runs.forEach(r => {
      if (r.result === 'Not interested' && r.linked_intro_booked_id) s.add(r.linked_intro_booked_id);
    });
    return s;
  }, [bookings, runs]);

  const notInterestedNames = useMemo(() => {
    const s = new Set<string>();
    runs.forEach(r => {
      if (r.result === 'Not interested') s.add(r.member_name.toLowerCase().trim());
    });
    return s;
  }, [runs]);

  const getPersonStatus = (q: QRecord): string => {
    const booking = q.booking_id ? bookingMap.get(q.booking_id) : null;
    if (booking) {
      if (purchasedBookingIds.has(booking.id)) {
        const run = runs.find(r => r.linked_intro_booked_id === booking.id && ['premier', 'elite', 'basic'].some(k => r.result.toLowerCase().includes(k)));
        return `Purchased (${run?.result || 'Member'})`;
      }
      if (notInterestedBookingIds.has(booking.id)) return 'Not Interested';
      const noShowRun = runs.find(r => r.linked_intro_booked_id === booking.id && r.result === 'No-show');
      if (noShowRun) return 'No Show';
      const didntBuyRun = runs.find(r => r.linked_intro_booked_id === booking.id && r.result === "Didn't Buy");
      if (didntBuyRun) return "Didn't Buy";
      if (booking.booking_status === 'Active') return 'Active booking';
    }
    const fullName = `${q.client_first_name} ${q.client_last_name}`.trim().toLowerCase();
    if (purchasedNames.has(fullName)) return 'Purchased';
    if (notInterestedNames.has(fullName)) return 'Not Interested';
    return q.booking_id ? 'Booking linked' : 'No booking linked';
  };

  const getStatusColor = (status: string) => {
    if (status.startsWith('Purchased')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (status === 'Active booking') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (status === 'No Show') return 'bg-destructive/10 text-destructive border-destructive/20';
    if (status === "Didn't Buy") return 'bg-amber-100 text-amber-800 border-amber-200';
    if (status === 'Not Interested') return 'bg-slate-200 text-slate-700 border-slate-300';
    return 'bg-muted text-muted-foreground border-border';
  };

  // Get tab category for a Q record — closed outcomes always win
  const getQCategory = (q: QRecord): string => {
    const fullName = `${q.client_first_name} ${q.client_last_name}`.trim().toLowerCase();
    const isBought = (q.booking_id && purchasedBookingIds.has(q.booking_id)) || purchasedNames.has(fullName);
    const isNotInterested = (q.booking_id && notInterestedBookingIds.has(q.booking_id)) || notInterestedNames.has(fullName);
    const isDidntBuy = (q.booking_id && didntBuyBookingIds.has(q.booking_id)) || didntBuyNames.has(fullName);
    const isCompleted = q.status === 'completed' || q.status === 'submitted';

    if (isBought) return 'purchased';          // priority 1 — always wins
    if (isNotInterested) return 'not-interested'; // priority 2
    if (isDidntBuy) return 'didnt-buy';           // priority 3
    if (isCompleted) return 'completed';           // priority 4
    if (q.status === 'sent') return 'sent';        // priority 5
    return 'needs-sending';                         // default
  };

  // Filter by search and exclude VIP bookings
  const filtered = useMemo(() => {
    let result = questionnaires.filter(q => {
      // Exclude questionnaires linked to VIP bookings
      if (q.booking_id) {
        const booking = bookingMap.get(q.booking_id);
        if (booking && isVipBooking(booking as any)) return false;
      }
      return true;
    });
    if (!searchTerm.trim()) return result;
    const term = searchTerm.toLowerCase();
    return result.filter(q =>
      `${q.client_first_name} ${q.client_last_name}`.toLowerCase().includes(term)
    );
  }, [questionnaires, searchTerm, bookingMap]);

  // Tab categorization — computed after getQCategory is defined
  const needsSending = filtered.filter(q => getQCategory(q) === 'needs-sending');
  const sent = filtered.filter(q => getQCategory(q) === 'sent');
  const completed = filtered.filter(q => getQCategory(q) === 'completed');
  const didntBuy = filtered.filter(q => getQCategory(q) === 'didnt-buy');
  const notInterested = filtered.filter(q => getQCategory(q) === 'not-interested');
  const purchased = filtered.filter(q => getQCategory(q) === 'purchased');

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

  const handleArchive = async () => {
    if (!archiveTarget) return;
    try {
      await supabase.from('intro_questionnaires').update({ archived_at: new Date().toISOString() } as any).eq('id', archiveTarget.id);
      setQuestionnaires(prev => prev.filter(q => q.id !== archiveTarget.id));
      toast.success('Questionnaire archived');
    } catch {
      toast.error('Failed to archive');
    } finally {
      setArchiveTarget(null);
    }
  };

  const handleLinkBooking = async () => {
    if (!linkTarget || !linkBookingId) return;
    try {
      await supabase.from('intro_questionnaires').update({ booking_id: linkBookingId }).eq('id', linkTarget.id);
      setQuestionnaires(prev => prev.map(q => q.id === linkTarget.id ? { ...q, booking_id: linkBookingId } : q));
      toast.success('Linked to booking');
    } catch {
      toast.error('Failed to link');
    } finally {
      setLinkTarget(null);
      setLinkBookingId('');
      setLinkSearch('');
    }
  };

  const filteredLinkBookings = useMemo(() => {
    if (!linkSearch.trim()) return bookings.slice(0, 20);
    const term = linkSearch.toLowerCase();
    return bookings.filter(b => b.member_name.toLowerCase().includes(term)).slice(0, 20);
  }, [bookings, linkSearch]);

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
    } else {
      setPrepBooking({
        memberName: `${q.client_first_name} ${q.client_last_name}`.trim(),
        memberKey: `${q.client_first_name}${q.client_last_name}`.toLowerCase().replace(/\s+/g, ''),
        bookingId: q.id,
        classDate: q.scheduled_class_date,
        classTime: q.scheduled_class_time,
        coachName: 'TBD',
        leadSource: '',
        isSecondIntro: false,
        phone: null,
        email: null,
      });
    }
    setPrepOpen(true);
  };

  const openCoach = (q: QRecord) => setCoachQ(q.id);

  const openScript = (q: QRecord) => {
    const result = selectBestScript({ personType: 'booking', classDate: q.scheduled_class_date }, templates);
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

  const getCategoryBadge = (q: QRecord) => {
    const cat = getQCategory(q);
    const labels: Record<string, { label: string; cls: string }> = {
      'needs-sending': { label: 'Needs Sending', cls: 'bg-muted text-muted-foreground' },
      'sent': { label: 'Sent', cls: 'bg-blue-100 text-blue-700' },
      'completed': { label: 'Completed', cls: 'bg-emerald-100 text-emerald-700' },
      'didnt-buy': { label: "Didn't Buy", cls: 'bg-amber-100 text-amber-800' },
      'not-interested': { label: 'Not Interested', cls: 'bg-slate-200 text-slate-700' },
      'purchased': { label: 'Purchased', cls: 'bg-emerald-600 text-white' },
    };
    const info = labels[cat] || labels['needs-sending'];
    return <Badge className={cn('text-[9px] px-1 py-0 h-3.5 border-transparent', info.cls)}>{info.label}</Badge>;
  };

  const renderQCard = (q: QRecord, showAnswers = false, showCategoryBadge = false, readOnly = false) => {
    const booking = q.booking_id ? bookingMap.get(q.booking_id) : null;
    const fullName = `${q.client_first_name} ${q.client_last_name}`.trim();
    const status = getPersonStatus(q);
    const isExpanded = expandedQ === q.id;

    return (
      <div key={q.id} className="rounded-lg border bg-card p-3 space-y-2">
        {/* Row 1: Name + Status + Archive */}
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm">{fullName}</p>
          {showCategoryBadge && getCategoryBadge(q)}
          <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border', getStatusColor(status))}>
            {status}
          </Badge>
          {status === 'No booking linked' && (
            <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] gap-0.5 text-primary" onClick={() => { setLinkTarget(q); setLinkSearch(''); setLinkBookingId(''); }}>
              <Link2 className="w-3 h-3" /> Link
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 ml-auto text-muted-foreground hover:text-destructive"
            onClick={() => setArchiveTarget(q)}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
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

        {(q.status === 'completed' || q.status === 'submitted') && q.submitted_at && (
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
        <div className="flex items-center gap-1.5 pt-1 flex-wrap">
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
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px] gap-1 ml-auto"
              onClick={() => copyLink(q)}
            >
              {copiedId === q.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copiedId === q.id ? 'Copied!' : 'Copy Q Link'}
            </Button>
          )}
        </div>
      </div>
    );
  };

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  const isSearching = searchTerm.trim().length > 0;

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

      {/* When searching: flat list across all tabs */}
      {isSearching ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{filtered.length} result{filtered.length !== 1 ? 's' : ''} across all tabs</p>
          {filtered.length === 0 ? <EmptyState text="No results found" /> : filtered.map(q => renderQCard(q, q.status === 'completed' || q.status === 'submitted', true))}
        </div>
      ) : (
        /* Normal tabbed view — 6 tabs in 2 rows of 3 */
        <Tabs defaultValue="needs-sending">
          <TabsList className="w-full grid grid-cols-3 mb-1">
            <TabsTrigger value="needs-sending" className="text-xs">Needs Sending ({needsSending.length})</TabsTrigger>
            <TabsTrigger value="sent" className="text-xs">Sent ({sent.length})</TabsTrigger>
            <TabsTrigger value="completed" className="text-xs">Completed ({completed.length})</TabsTrigger>
          </TabsList>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="didnt-buy" className="text-xs">Didn't Buy ({didntBuy.length})</TabsTrigger>
            <TabsTrigger value="not-interested" className="text-xs">Not Int. ({notInterested.length})</TabsTrigger>
            <TabsTrigger value="purchased" className="text-xs">Purchased ({purchased.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="needs-sending" className="space-y-2 mt-2">
            {needsSending.length === 0 ? <EmptyState text="No questionnaires to send" /> : needsSending.map(q => renderQCard(q))}
          </TabsContent>

          <TabsContent value="sent" className="space-y-2 mt-2">
            {sent.length === 0 ? <EmptyState text="No sent questionnaires awaiting response" /> : sent.map(q => renderQCard(q))}
          </TabsContent>

          <TabsContent value="completed" className="space-y-2 mt-2">
            {completed.length === 0 ? <EmptyState text="No completed questionnaires" /> : completed.map(q => renderQCard(q, true))}
          </TabsContent>

          <TabsContent value="didnt-buy" className="space-y-2 mt-2">
            {didntBuy.length === 0 ? <EmptyState text="No 'didn't buy' questionnaires" /> : didntBuy.map(q => renderQCard(q, q.status === 'completed' || q.status === 'submitted', false, true))}
          </TabsContent>

          <TabsContent value="not-interested" className="space-y-2 mt-2">
            {notInterested.length === 0 ? <EmptyState text="No 'not interested' questionnaires" /> : notInterested.map(q => renderQCard(q, q.status === 'completed' || q.status === 'submitted', false, true))}
          </TabsContent>

          <TabsContent value="purchased" className="space-y-2 mt-2">
            {purchased.length === 0 ? <EmptyState text="No purchased members with questionnaires" /> : purchased.map(q => renderQCard(q, true, false, true))}
          </TabsContent>
        </Tabs>
      )}

      {/* Archive Confirmation Dialog */}
      <Dialog open={!!archiveTarget} onOpenChange={o => { if (!o) setArchiveTarget(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Archive Questionnaire</DialogTitle>
            <DialogDescription>
              Remove {archiveTarget ? `${archiveTarget.client_first_name} ${archiveTarget.client_last_name}` : ''}'s questionnaire from this list? The data will be archived, not permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setArchiveTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleArchive}>Archive</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link to Booking Dialog */}
      <Dialog open={!!linkTarget} onOpenChange={o => { if (!o) setLinkTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Link to Booking</DialogTitle>
            <DialogDescription>
              Search for a booking to link {linkTarget ? `${linkTarget.client_first_name} ${linkTarget.client_last_name}` : ''}'s questionnaire to.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Search by name..."
            value={linkSearch}
            onChange={e => setLinkSearch(e.target.value)}
            className="mb-2"
          />
          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredLinkBookings.map(b => (
              <div
                key={b.id}
                className={cn('px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-muted', linkBookingId === b.id && 'bg-primary/10 ring-1 ring-primary')}
                onClick={() => setLinkBookingId(b.id)}
              >
                <span className="font-medium">{b.member_name}</span>
                <span className="text-xs text-muted-foreground ml-2">{b.class_date} · {b.coach_name}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkTarget(null)}>Cancel</Button>
            <Button disabled={!linkBookingId} onClick={handleLinkBooking}>Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prep Drawer */}
      {prepBooking && (
        <PrepDrawer open={prepOpen} onOpenChange={setPrepOpen} {...prepBooking} />
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
