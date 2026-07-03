import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { capitalizeName, parseLocalDate } from '@/lib/utils';
import { formatPhoneDisplay } from '@/lib/parsing/phone';
import { isMembershipSale } from '@/lib/sales-detection';
import { getCurrentPayPeriod, formatDate as fmtDate } from '@/lib/pay-period';
import {
  User, Calendar, Target, ClipboardList, DollarSign, Phone, Mail,
  MessageSquare, FileText, Copy, History, Link2, Printer, Zap,
  Megaphone, Dumbbell, TrendingUp, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { HumanizedEirma } from './HumanizedEirma';
import { IntroTypeBadge, LeadSourceTag } from './IntroTypeBadge';
import { useObjectionPlaybooks, matchObstaclesToPlaybooks } from '@/hooks/useObjectionPlaybooks';
import { FollowUpStatusBadge } from './FollowUpStatusBadge';
import { LinkQuestionnaireDialog } from './LinkQuestionnaireDialog';
import { Separator } from '@/components/ui/separator';

interface QuestionnaireData {
  q1_fitness_goal: string | null;
  q2_fitness_level: number | null;
  q3_obstacle: string | null;
  q4_past_experience: string | null;
  q5_emotional_driver: string | null;
  q6_weekly_commitment: string | null;
  q6b_available_days: string | null;
  q7_coach_notes: string | null;
  status: string;
  last_opened_at: string | null;
}

interface SendLogEntry {
  id: string;
  sent_at: string;
  sent_by: string;
  message_body_sent: string;
}

interface PrepDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  memberKey: string;
  bookingId: string;
  classDate: string;
  classTime: string | null;
  coachName: string;
  leadSource: string;
  isSecondIntro: boolean;
  originatingBookingId?: string | null;
  phone?: string | null;
  email?: string | null;
  bookings?: Array<{
    id: string;
    class_date: string;
    intro_time: string | null;
    coach_name: string;
    lead_source: string;
    booking_status: string | null;
    booked_by: string | null;
    fitness_goal: string | null;
  }>;
  runs?: Array<{
    id: string;
    run_date: string | null;
    class_time: string;
    result: string;
    intro_owner: string | null;
    ran_by: string | null;
    commission_amount: number | null;
    notes: string | null;
    primary_objection?: string | null;
  }>;
  onGenerateScript?: () => void;
  onSendQ?: () => void;
  autoPrint?: boolean;
}

// ── Objection detection ─────────────────────────────────────────────────────
function detectObjection(obstacle: string | null): 'price' | 'time' | 'spouse' | 'commitment' {
  if (!obstacle) return 'price';
  const low = obstacle.toLowerCase();
  if (/money|cost|price|expensive|afford|budget/i.test(low)) return 'price';
  if (/time|busy|schedule|work|hour/i.test(low)) return 'time';
  if (/spouse|partner|husband|wife|significant|family/i.test(low)) return 'spouse';
  return 'commitment';
}

const OBJECTION_TIPS: Record<string, string> = {
  Price: 'Lead with the risk-free guarantee — 12 classes in 30 days or money back.',
  Timing: 'Acknowledge the timing, redirect to their why — what changes if they wait?',
  'Spouse/partner': 'Invite them both in — "Bring them to your second visit, on us."',
  'Think about it': '"What would need to be true for this to feel like the right move?"',
};

function getEirma(
  objectionType: 'price' | 'time' | 'spouse' | 'commitment',
  goal: string | null,
  commitment: string | null,
  oneLiner: string
) {
  const tierSuggestion = (() => {
    const days = parseInt(commitment || '3');
    if (days >= 5) return 'Premier';
    if (days >= 3) return 'Elite';
    return 'Basic';
  })();
  const objectionLabels = { price: 'Pricing', time: 'Time', spouse: 'Partner Buy-In', commitment: 'Consistency' };
  const scripts = {
    price: {
      e: `"I completely understand — it's a real investment, and I'd feel the same way before I knew what I was getting."`,
      i: `"Is the cost the only thing holding you back from getting started?"`,
      r: `"Here's what I know: ${oneLiner} The question is whether the cost of not doing it is higher than the cost of membership."`,
      m: `Based on ${commitment || '3 days'}/week, ${tierSuggestion} is the perfect fit — it's built for that frequency.`,
      a: `"Based on everything you told me, ${tierSuggestion} makes the most sense for your goals — want to get you started today?"`,
    },
    time: {
      e: `"Time is honestly the #1 thing I hear from people, and it's totally valid — life is busy."`,
      i: `"Is scheduling the only thing that would get in the way of you starting?"`,
      r: `"Here's the thing: ${oneLiner} Classes are 60 minutes. If you block it like a meeting, it happens."`,
      m: `With ${commitment || '3 days'}/week, ${tierSuggestion} gives you exactly that flexibility without overpaying.`,
      a: `"${tierSuggestion} gives you the flexibility to fit this into your schedule — let's get you set up today."`,
    },
    spouse: {
      e: `"That makes total sense — big decisions should involve your partner."`,
      i: `"Is your partner the only thing standing between you and getting started?"`,
      r: `"Here's what I'd say to bring home: ${oneLiner} That's the real conversation."`,
      m: `${tierSuggestion} is the right tier for ${commitment || '3 days'}/week — worth showing them the breakdown.`,
      a: `"What if we get you started and you bring them in for a free class so they can see it for themselves?"`,
    },
    commitment: {
      e: `"I hear that — most people who walk in here have tried things before that didn't stick."`,
      i: `"Is staying consistent the main thing you're worried about?"`,
      r: `"That's actually why this works: ${oneLiner} The structure and the coaches make consistency happen for you."`,
      m: `${tierSuggestion} at ${commitment || '3 days'}/week is the sweet spot — enough to build the habit, not overwhelming.`,
      a: `"Most people feel that way before they start — within 3 weeks it's automatic. Want to find out? Let's get you in ${tierSuggestion}."`,
    },
  };
  return { label: objectionLabels[objectionType], ...scripts[objectionType] };
}

export function PrepDrawer({
  open, onOpenChange, memberName, memberKey, bookingId, classDate, classTime,
  coachName, leadSource, isSecondIntro, originatingBookingId, phone, email, bookings, runs,
  onGenerateScript, onSendQ, autoPrint,
}: PrepDrawerProps) {
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireData | null>(null);
  const [sendLogs, setSendLogs] = useState<SendLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkQOpen, setLinkQOpen] = useState(false);
  const [studioTrend, setStudioTrend] = useState<{ objection: string; percent: number } | null>(null);
  const [prevVisitData, setPrevVisitData] = useState<{ objection: string | null; notes: string | null; goal: string | null; why: string | null; coachName: string | null; classDate: string | null; introTime: string | null; leadSource: string | null; result: string | null; obstacle: string | null } | null>(null);
  const [buyingCriteria, setBuyingCriteria] = useState('');
  const [saObjection, setSaObjection] = useState('');
  const [savingBrief, setSavingBrief] = useState(false);
  const [coachNotesOnBooking, setCoachNotesOnBooking] = useState<string | null>(null);
  const [coachBriefHumanDetail, setCoachBriefHumanDetail] = useState<string | null>(null);
  const [coachBriefFiveVision, setCoachBriefFiveVision] = useState<string | null>(null);
  const [saConv5of5, setSaConv5of5] = useState<string | null>(null);
  const [saConvMeaning, setSaConvMeaning] = useState<string | null>(null);
  const [saConvObstacle, setSaConvObstacle] = useState<string | null>(null);
  const { data: objectionPlaybooks = [] } = useObjectionPlaybooks();

  const defaultBookings = bookings || [{
    id: bookingId, class_date: classDate, intro_time: classTime, coach_name: coachName,
    lead_source: leadSource, booking_status: 'Active', booked_by: null, fitness_goal: null,
  }];
  const defaultRuns = runs || [];

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const bookingIds = defaultBookings.map(b => b.id);

    Promise.all([
      supabase
        .from('intro_questionnaires')
        .select('q1_fitness_goal, q2_fitness_level, q3_obstacle, q4_past_experience, q5_emotional_driver, q6_weekly_commitment, q6b_available_days, q7_coach_notes, status, last_opened_at' as any)
        .in('booking_id', bookingIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('script_send_log')
        .select('id, sent_at, sent_by, message_body_sent')
        .in('booking_id', bookingIds)
        .order('sent_at', { ascending: false })
        .limit(20),
      supabase
        .from('intros_booked')
        .select('sa_buying_criteria, sa_objection, coach_notes, coach_brief_human_detail, coach_brief_five_vision, sa_conversation_5_of_5, sa_conversation_meaning, sa_conversation_obstacle' as any)
        .eq('id', bookingId)
        .single(),
    ]).then(([qRes, logRes, consentRes]) => {
      const allQ = (qRes.data || []) as unknown as QuestionnaireData[];
      const completed = allQ.find(q => q.status === 'completed' || q.status === 'submitted');
      setQuestionnaire(completed || allQ[0] || null);
      setSendLogs((logRes.data || []) as SendLogEntry[]);
      const bookingData = consentRes.data as any;
      setBuyingCriteria(bookingData?.sa_buying_criteria || '');
      setSaObjection(bookingData?.sa_objection || '');
      setCoachNotesOnBooking(bookingData?.coach_notes || null);
      setCoachBriefHumanDetail(bookingData?.coach_brief_human_detail || null);
      setCoachBriefFiveVision(bookingData?.coach_brief_five_vision || null);
      setSaConv5of5(bookingData?.sa_conversation_5_of_5 || null);
      setSaConvMeaning(bookingData?.sa_conversation_meaning || null);
      setSaConvObstacle(bookingData?.sa_conversation_obstacle || null);
      setLoading(false);
    });

    // Studio trend (1st intros only)
    if (!isSecondIntro) {
      const pp = getCurrentPayPeriod();
      supabase
        .from('intros_run')
        .select('primary_objection')
        .gte('run_date', fmtDate(pp.start))
        .lte('run_date', fmtDate(pp.end))
        .not('primary_objection', 'is', null)
        .then(({ data: rows }) => {
          if (!rows || rows.length === 0) { setStudioTrend(null); return; }
          const counts: Record<string, number> = {};
          rows.forEach((r: any) => { const o = r.primary_objection; if (o) counts[o] = (counts[o] || 0) + 1; });
          const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
          if (top) setStudioTrend({ objection: top[0], percent: Math.round((top[1] / rows.length) * 100) });
        });
    }

    // 2nd intro: load previous visit data (rich version)
    if (isSecondIntro) {
      const origId = originatingBookingId || defaultBookings.find(b => b.id !== bookingId)?.id || bookingId;
      Promise.all([
        supabase.from('intros_booked').select('class_date, intro_time, coach_name, lead_source, fitness_goal').eq('id', origId).maybeSingle(),
        supabase.from('intros_run').select('result, primary_objection, notes, coach_name, run_date').eq('linked_intro_booked_id', origId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('intro_questionnaires').select('q1_fitness_goal, q3_obstacle, q5_emotional_driver').eq('booking_id', origId).limit(1).maybeSingle(),
      ]).then(([{ data: booking }, { data: run }, { data: q }]) => {
        const b = booking as any;
        const r = run as any;
        const qd = q as any;
        setPrevVisitData({
          objection: r?.primary_objection || null,
          notes: r?.notes || null,
          goal: qd?.q1_fitness_goal || b?.fitness_goal || null,
          why: qd?.q5_emotional_driver || null,
          coachName: r?.coach_name || b?.coach_name || null,
          classDate: b?.class_date || null,
          introTime: b?.intro_time || null,
          leadSource: b?.lead_source || null,
          result: r?.result || null,
          obstacle: qd?.q3_obstacle || null,
        });
      });
    }
  }, [open, bookingId]);

  const handleSaveBrief = useCallback(async (field: string, value: string) => {
    setSavingBrief(true);
    await supabase.from('intros_booked').update({ [field]: value } as any).eq('id', bookingId);
    setSavingBrief(false);
    toast.success('Brief saved ✓');
  }, [bookingId]);

  const hasSale = defaultRuns.some(r => isMembershipSale(r.result));
  const totalCommission = defaultRuns.reduce((sum, r) => sum + (r.commission_amount || 0), 0);
  const formatDate = (dateStr: string) =>
    parseLocalDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const handleCopyPhone = () => {
    if (phone) { navigator.clipboard.writeText(phone); toast.success('Phone copied!'); }
    else toast.info('No phone number on file');
  };

  const firstName = memberName.split(' ')[0];
  const hasQ = questionnaire?.status === 'completed' || questionnaire?.status === 'submitted';
  const goal = questionnaire?.q1_fitness_goal;
  const obstacle = questionnaire?.q3_obstacle;
  const emotionalDriver: string | null = questionnaire?.q5_emotional_driver ?? null;
  const commitment = questionnaire?.q6_weekly_commitment;
  const pastExp = questionnaire?.q4_past_experience;
  const fitnessLevel = questionnaire?.q2_fitness_level ?? null;

  const oneLiner = hasQ && goal && commitment
    ? `If you work out with us ${commitment} a week, I can clearly see you ${goal.toLowerCase()}.`
    : null;
  const walkInOneLiner = `Ask their goal before class — then build this one-liner in your head before the sit-down.`;

  const objectionType = detectObjection(obstacle);
  const eirma = getEirma(objectionType, goal, commitment, oneLiner || 'achieving your goal');

  const handlePrint = () => window.print();

  // Auto-print when opened from the "Print Questionnaire" button — fires once per open.
  useEffect(() => {
    if (open && autoPrint && !loading) {
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [open, autoPrint, loading]);


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0">
        <SheetHeader className="p-4 pb-3 border-b print:hidden">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <User className="w-5 h-5" />
            {memberName}
          </SheetTitle>
          <SheetDescription className="sr-only">Client preparation details</SheetDescription>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <IntroTypeBadge isSecondIntro={isSecondIntro} isVipClassIntro={(leadSource || '').startsWith('VIP Class')} />
            <LeadSourceTag source={leadSource} />
            {hasSale && <Badge className="bg-success text-success-foreground text-[10px]">Purchased</Badge>}
            {totalCommission > 0 && (
              <Badge variant="outline" className="text-success text-[10px]">
                <DollarSign className="w-3 h-3 mr-0.5" />${totalCommission.toFixed(0)}
              </Badge>
            )}
            <FollowUpStatusBadge personName={memberName} bookingId={bookingId} />
            <Button variant="outline" size="sm" className="h-5 text-[10px] px-2 gap-1 ml-auto" onClick={handlePrint}>
              <Printer className="w-3 h-3" /> Print Card
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] print:hidden">
          <div className="p-4 space-y-4 prep-card-content">
            {/* Quick Info */}
            <div className="rounded-lg bg-muted/30 p-3 text-sm space-y-1.5">
              <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label="Date" value={`${classDate}${classTime ? ` @ ${classTime.substring(0, 5)}` : ''}`} />
              <InfoRow icon={<User className="w-3.5 h-3.5" />} label="Coach" value={coachName} />
              <InfoRow icon={<Target className="w-3.5 h-3.5" />} label="Source" value={leadSource} />
              {phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground text-xs w-16">Phone</span>
                  <a
                    href={`sms:+1${(phone || '').replace(/\D/g, '').replace(/^1/, '').slice(-10)}`}
                    className="text-primary underline text-xs font-medium"
                  >
                    {formatPhoneDisplay(phone) || phone}
                  </a>
                </div>
              )}
              {email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground text-xs w-16">Email</span>
                  <button onClick={() => window.open(`mailto:${email}`)} className="text-primary underline text-xs font-medium">{email}</button>
                </div>
              )}
            </div>

            {loading ? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            ) : (
              <>
                {/* ══════════ SA CARD ══════════ */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> SA PREP
                  </h3>

                  {/* Section 1 — Transformative one-liner */}
                  <div className={`rounded-xl p-4 border-2 ${hasQ && oneLiner ? 'border-primary bg-primary/5' : 'border-muted bg-muted/30'}`}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Your North Star</p>
                    {hasQ && oneLiner ? (
                      <p className="text-base font-bold leading-snug text-primary">"{oneLiner}"</p>
                    ) : (
                      <p className="text-sm font-semibold text-muted-foreground italic leading-snug">{walkInOneLiner}</p>
                    )}
                  </div>

                  {/* Section 2 — Shoutout Consent removed (superseded by FV Scorecard) */}

                  {/* Section 2.5 — What They Told Us */}
                  <div className="rounded-lg border overflow-hidden">
                    <div className="px-3 py-2 bg-muted/40">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <ClipboardList className="w-3.5 h-3.5" /> WHAT THEY TOLD US
                      </p>
                    </div>
                    <div className="p-3 space-y-1.5 text-xs">
                      {hasQ ? (
                        <>
                          {fitnessLevel != null && (
                            <div><span className="text-muted-foreground">Fitness level:</span> <span className="font-semibold">{fitnessLevel}/5</span></div>
                          )}
                          {goal && (
                            <div><span className="text-muted-foreground">Goal:</span> <span className="font-semibold">"{goal}"</span></div>
                          )}
                          {emotionalDriver && (
                            <div><span className="text-muted-foreground">Why:</span> <span className="font-semibold">"{emotionalDriver}"</span></div>
                          )}
                          {obstacle && (
                            <div><span className="text-muted-foreground">Potential Objection:</span> <span className="font-semibold">"{obstacle}"</span></div>
                          )}
                          {pastExp && (
                            <div><span className="text-muted-foreground">Past experience:</span> <span className="font-semibold">"{pastExp}"</span></div>
                          )}
                          {commitment && (
                            <div><span className="text-muted-foreground">Commitment:</span> <span className="font-semibold">{commitment} days/week</span></div>
                          )}
                          {questionnaire?.q6b_available_days && (
                            <div><span className="text-muted-foreground">Available days:</span> <span className="font-semibold">{questionnaire.q6b_available_days}</span></div>
                          )}
                          {questionnaire?.q7_coach_notes && (
                            <div><span className="text-muted-foreground">Notes:</span> <span className="font-semibold">"{questionnaire.q7_coach_notes}"</span></div>
                          )}
                        </>
                      ) : (
                        <p className="text-muted-foreground italic">No questionnaire answers yet</p>
                      )}
                    </div>
                  </div>

                  {/* THE BRIEF — 2-column conversation fields (matches intro card) */}
                  <div className="rounded-lg border-2 border-blue-300 dark:border-blue-700 overflow-hidden">
                    <div className="px-3 py-2 bg-blue-50/60 dark:bg-blue-950/30">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-blue-800 dark:text-blue-300">THE CONVERSATION</p>
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">Fill in during dig deeper — these are the SA conversation fields</p>
                    </div>
                    <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold" style={{ color: '#E8540A' }}>What would a 5/5 look like for you?</Label>
                        {fitnessLevel != null && (
                          <p className="text-[10px] text-muted-foreground italic">They rated their current fitness {fitnessLevel}/5</p>
                        )}
                        <Textarea
                          value={saConv5of5 || ''}
                          onChange={e => setSaConv5of5(e.target.value)}
                          onBlur={() => handleSaveBrief('sa_conversation_5_of_5', saConv5of5 || '')}
                          placeholder="Paint me a picture. What does your life actually look like when you get there?"
                          className="min-h-[80px] text-xs resize-none border border-input"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold" style={{ color: '#E8540A' }}>What's been holding you back?</Label>
                        {obstacle && (
                          <p className="text-[10px] text-muted-foreground italic">They mentioned: {obstacle.length > 50 ? obstacle.slice(0, 50) + '…' : obstacle}</p>
                        )}
                        <Textarea
                          value={saConvObstacle || ''}
                          onChange={e => setSaConvObstacle(e.target.value)}
                          onBlur={() => handleSaveBrief('sa_conversation_obstacle', saConvObstacle || '')}
                          placeholder="Don't fix it. Just listen. Their answer is your close."
                          className="min-h-[80px] text-xs resize-none border border-input"
                        />
                      </div>
                    </div>
                  </div>


                  {/* Coach Notes (if coach added notes) */}
                  {coachNotesOnBooking && (
                    <div className="rounded-lg border-2 border-green-300 dark:border-green-700 overflow-hidden">
                      <div className="px-3 py-2 bg-green-50/60 dark:bg-green-950/30">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-green-800 dark:text-green-300">COACH NOTES</p>
                      </div>
                      <div className="p-3 text-xs">
                        <p className="font-medium">{coachNotesOnBooking}</p>
                      </div>
                    </div>
                  )}

                  {/* Section 3 — Dig Deeper (3 waypoints only) */}
                  <div className="rounded-lg border overflow-hidden">
                    <div className="px-3 py-2 bg-muted/40">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Dig Deeper</p>
                    </div>
                    <div className="p-3 space-y-4 text-xs">
                      <p className="text-muted-foreground italic text-[11px]">
                        "Looking at your questionnaire — I'd love to get the coach a few more details I was curious about."
                      </p>

                      {/* Waypoint 1: Fitness Level */}
                      <div className="border-l-2 border-primary pl-3 space-y-1">
                        <p className="font-bold text-foreground">FITNESS LEVEL {fitnessLevel ? `${fitnessLevel}/5` : '[X]/5'}</p>
                        <p className="text-muted-foreground">→ "Why did you give yourself that rating?"</p>
                        <p className="text-muted-foreground">→ "What would you being at a 5 look like to you?"</p>
                        <p className="text-[10px] text-muted-foreground/60 italic">↓ let it flow naturally — they're already telling you the goal and the why</p>
                      </div>

                      {/* Waypoint 2: What are you looking for */}
                      <div className="border-l-2 border-primary pl-3 space-y-1">
                        <p className="font-bold text-foreground">WHAT ARE YOU LOOKING FOR</p>
                        <p className="text-muted-foreground">→ "What are you looking for in a gym membership?"</p>
                        <p className="text-[10px] text-muted-foreground/60 italic">↓ their answer = their close criteria. use their exact words in your close.</p>
                      </div>

                      {/* Waypoint 3: What would it come down to */}
                      <div className="border-l-2 border-primary pl-3 space-y-1">
                        <p className="font-bold text-foreground">POTENTIAL OBJECTION</p>
                        <p className="text-muted-foreground">→ "If you ended up not joining after today — what do you think it would come down to?"</p>
                        <p className="text-[10px] text-muted-foreground/60 italic">↓ don't reassure them yet. just listen. nod. say "that makes sense."</p>
                        <p className="text-[10px] text-muted-foreground/60 italic">↓ you have the whole class to prepare for it.</p>
                      </div>
                    </div>
                  </div>

                  {/* Q link / send actions for no-Q */}
                  {!hasQ && (
                    <div className="flex gap-2 flex-wrap">
                      {onSendQ && (!questionnaire || questionnaire.status === 'not_sent') && (
                        <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={onSendQ}>
                          <FileText className="w-3 h-3 mr-1" /> Copy Q Link
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => setLinkQOpen(true)}>
                        <Link2 className="w-3 h-3 mr-1" /> Link Existing Q
                      </Button>
                    </div>
                  )}

                  {/* THE CLOSE, Studio Trend, COACH CARD, and After Class EIRMA
                      sections removed per SA request — the drawer now stops at the
                      Dig Deeper section. Keep Activity Timeline + Action Buttons. */}
                </div>


                {/* Activity Timeline */}
                {(sendLogs.length > 0 || defaultRuns.length > 0 || defaultBookings.length > 1) && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold flex items-center gap-1.5 uppercase tracking-wide text-muted-foreground">
                      <History className="w-3.5 h-3.5 text-primary" /> Activity Timeline
                    </h3>
                    <div className="space-y-1.5">
                      {defaultBookings.map(b => (
                        <TimelineItem key={b.id} icon={<Calendar className="w-3 h-3" />}
                          label={`Booked: ${formatDate(b.class_date)}${b.intro_time ? ` @ ${b.intro_time.substring(0, 5)}` : ''}`}
                          detail={`${b.coach_name} · ${b.booking_status || 'Active'}${b.booked_by ? ` · By ${capitalizeName(b.booked_by)}` : ''}`} />
                      ))}
                      {defaultRuns.map(r => (
                        <TimelineItem key={r.id} icon={<Target className="w-3 h-3" />}
                          label={`Ran: ${r.run_date ? formatDate(r.run_date) : 'No date'} → ${r.result}`}
                          detail={r.notes || undefined} highlight={isMembershipSale(r.result)} />
                      ))}
                      {sendLogs.map(l => (
                        <TimelineItem key={l.id} icon={<MessageSquare className="w-3 h-3" />}
                          label={`Script sent by ${capitalizeName(l.sent_by)}`}
                          detail={new Date(l.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                  {onGenerateScript && (
                    <Button variant="default" size="sm" className="text-xs" onClick={onGenerateScript}>
                      <MessageSquare className="w-3.5 h-3.5 mr-1" /> Generate Script
                    </Button>
                  )}
                  {onSendQ && !isSecondIntro && (
                    <Button variant="outline" size="sm" className="text-xs" onClick={onSendQ}>
                      <FileText className="w-3.5 h-3.5 mr-1" /> Copy Q Link
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="text-xs" onClick={handleCopyPhone}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copy Phone
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs" onClick={handlePrint}>
                    <Printer className="w-3.5 h-3.5 mr-1" /> Print Card
                  </Button>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {/* ══════════ PRINT LAYOUT — full-page 2-question sheet ══════════ */}
        {(() => {
          const answerStyle = { fontSize: '18px', lineHeight: 1.6, color: '#111', whiteSpace: 'pre-wrap' as const };
          const blankLines = (
            <div style={{ marginTop: '8mm' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  style={{ borderBottom: '1px solid #333', height: '10mm' }}
                />
              ))}
            </div>
          );

          return (
            <div
              data-print-card
              className="hidden print:block fixed inset-0 bg-white text-black"
              style={{
                zIndex: 9999,
                fontFamily: 'Arial, Helvetica, sans-serif',
                minHeight: '100vh',
                padding: '15mm 18mm',
                color: '#111',
              }}
            >
              {/* Header */}
              <div style={{ borderBottom: '2px solid #111', paddingBottom: '6mm', marginBottom: '10mm', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontSize: '26px', fontWeight: 'bold' }}>{memberName}</div>
                <div style={{ fontSize: '14px', color: '#333' }}>
                  {classDate}{classTime ? ` @ ${classTime.substring(0, 5)}` : ''}{coachName ? `  ·  Coach: ${coachName}` : ''}
                </div>
              </div>

              {/* Q1 — What a 5/5 looks like */}
              <div style={{ marginBottom: '15mm' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5mm' }}>
                  What would a 5/5 fitness level look like for you?
                </div>
                {goal ? (
                  <div style={answerStyle}>{goal}</div>
                ) : (
                  blankLines
                )}
              </div>

              {/* Q2 — What's been holding you back */}
              <div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5mm' }}>
                  What's been holding you back?
                </div>
                {obstacle ? (
                  <div style={answerStyle}>{obstacle}</div>
                ) : (
                  blankLines
                )}
              </div>
            </div>
          );
        })()}

      </SheetContent>

      <LinkQuestionnaireDialog
        open={linkQOpen}
        onOpenChange={setLinkQOpen}
        bookingId={bookingId}
        memberName={memberName}
        onLinked={() => {
          const bookingIds = defaultBookings.map(b => b.id);
          supabase
            .from('intro_questionnaires')
            .select('q1_fitness_goal, q2_fitness_level, q3_obstacle, q4_past_experience, q5_emotional_driver, q6_weekly_commitment, q6b_available_days, q7_coach_notes, status' as any)
            .in('booking_id', bookingIds)
            .order('created_at', { ascending: false })
            .then(({ data: rows }) => {
              const allQ = (rows || []) as unknown as QuestionnaireData[];
              const completed = allQ.find(q => q.status === 'completed' || q.status === 'submitted');
              setQuestionnaire(completed || allQ[0] || null);
            });
        }}
      />
    </Sheet>
  );
}

/* ---- Sub-components ---- */

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground w-16">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function TimelineItem({ icon, label, detail, highlight }: { icon: React.ReactNode; label: string; detail?: string; highlight?: boolean }) {
  return (
    <div className={`flex items-start gap-2 text-xs p-1.5 rounded ${highlight ? 'bg-success/10' : ''}`}>
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div>
        <p className={`font-medium ${highlight ? 'text-success' : ''}`}>{label}</p>
        {detail && <p className="text-muted-foreground">{detail}</p>}
      </div>
    </div>
  );
}
