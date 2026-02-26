import { useState, useEffect, useCallback } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { capitalizeName, parseLocalDate } from '@/lib/utils';
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
}

// ── Goal category detection ─────────────────────────────────────────────────
type GoalCategory = 'fat_loss' | 'build_muscle' | 'energy' | 'confidence' | 'wedding' | 'getting_back';

function detectGoalCategory(goal: string | null): GoalCategory {
  if (!goal) return 'energy';
  const g = goal.toLowerCase();
  if (/weight|lose|fat|burn|slim|lean|shed/i.test(g)) return 'fat_loss';
  if (/muscle|tone|strength|strong|build|tighten/i.test(g)) return 'build_muscle';
  if (/energy|stress|mental|anxiety|sleep|mood/i.test(g)) return 'energy';
  if (/confiden|self|feel better about|self-esteem/i.test(g)) return 'confidence';
  if (/wedding|event|reunion|vacation|trip|honeymoon/i.test(g)) return 'wedding';
  if (/back|restart|again|used to|returning|haven't worked out/i.test(g)) return 'getting_back';
  return 'energy';
}

const GOAL_IN_CLASS_ACTIONS: Record<GoalCategory, string[]> = {
  fat_loss: [
    'Really hype them on the treadmill — this is their moment',
    'Push pace and all-out encouragement — this is where fat burns',
    'During tread block: "This is exactly what you came in for"',
  ],
  build_muscle: [
    'Focus energy on the floor — form corrections and hype',
    'Call out good form publicly — makes them feel coached not just encouraged',
    'During floor block: "This is where you build what you\'re looking for"',
  ],
  energy: [
    'Mid-class check in: "Notice how different you feel already?"',
    'Keep the vibe high — they came to change how they feel',
    'End of tread block: "That right there is why people keep coming back"',
  ],
  confidence: [
    'Call them out when they push through something hard',
    'Name what you see: "That\'s what showing up for yourself looks like"',
    'Make them feel capable, not just welcome',
  ],
  wedding: [
    'They\'re on a timeline — keep urgency and energy high',
    'Tread and floor both matter — full body focus',
    'Mid-class: "You\'re going to be exactly where you want to be"',
  ],
  getting_back: [
    'Meet them where they are — encourage consistency not intensity',
    'Celebrate every rep: "This is what getting back looks like"',
    'Don\'t push too hard — the win today is that they showed up',
  ],
};

function getInClassActions(goalCat: GoalCategory, level: number | null): string[] {
  const actions = [...GOAL_IN_CLASS_ACTIONS[goalCat]];
  if (level !== null && level <= 2) {
    actions.push('Keep them at base pace on treads until they ask for more');
  } else if (level !== null && level >= 4) {
    actions.push('Challenge them — they can handle push pace and all-outs');
  }
  return actions.slice(0, 4);
}

const PEAK_MOMENT_LINES: Record<GoalCategory, (name: string) => string> = {
  fat_loss: (n) => `${n} is on that tread right now burning exactly what they came in to burn — let them hear it.`,
  build_muscle: (n) => `${n} on the floor right now — first class, already putting in the work to build something. Give them some energy.`,
  energy: (n) => `${n} came in today to change how they feel — room, let them know they're in the right place. Let's hear it.`,
  confidence: (n) => `Look at ${n} right now — this is what showing up for yourself looks like. Room, give them some energy.`,
  wedding: (n) => `${n} is on a mission right now — room, let's give them some energy. They're going to get there.`,
  getting_back: (n) => `${n} is back — and they're showing up. Room, let them feel that. Give them some energy.`,
};

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
  Price: 'Lead with the risk-free guarantee — they can\'t lose money trying this.',
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
  coachName, leadSource, isSecondIntro, phone, email, bookings, runs,
  onGenerateScript, onSendQ,
}: PrepDrawerProps) {
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireData | null>(null);
  const [sendLogs, setSendLogs] = useState<SendLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkQOpen, setLinkQOpen] = useState(false);
  const [shoutoutConsent, setShoutoutConsent] = useState<boolean | null>(null);
  const [savingConsent, setSavingConsent] = useState(false);
  const [studioTrend, setStudioTrend] = useState<{ objection: string; percent: number } | null>(null);
  const [prevVisitData, setPrevVisitData] = useState<{ objection: string | null; notes: string | null; goal: string | null; why: string | null } | null>(null);

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
        .select('shoutout_consent')
        .eq('id', bookingId)
        .single(),
    ]).then(([qRes, logRes, consentRes]) => {
      const allQ = (qRes.data || []) as unknown as QuestionnaireData[];
      const completed = allQ.find(q => q.status === 'completed' || q.status === 'submitted');
      setQuestionnaire(completed || allQ[0] || null);
      setSendLogs((logRes.data || []) as SendLogEntry[]);
      setShoutoutConsent((consentRes.data as any)?.shoutout_consent ?? null);
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

    // 2nd intro: load previous visit data
    if (isSecondIntro) {
      const origBooking = defaultBookings.find(b => b.id !== bookingId) || defaultBookings[0];
      supabase
        .from('intros_run')
        .select('primary_objection, notes, linked_intro_booked_id')
        .eq('linked_intro_booked_id', origBooking?.id || bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .then(({ data: runRows }) => {
          const run = (runRows || [])[0] as any;
          setPrevVisitData({
            objection: run?.primary_objection || null,
            notes: run?.notes || null,
            goal: null,
            why: null,
          });
        });
    }
  }, [open, bookingId]);

  const handleSaveConsent = useCallback(async (val: boolean) => {
    setSavingConsent(true);
    setShoutoutConsent(val);
    await supabase.from('intros_booked').update({ shoutout_consent: val } as any).eq('id', bookingId);
    setSavingConsent(false);
    toast.success(val ? 'Shoutout consent saved ✓' : 'Low-key preference saved ✓');
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
  const emotionalDriver = questionnaire?.q5_emotional_driver;
  const commitment = questionnaire?.q6_weekly_commitment;
  const pastExp = questionnaire?.q4_past_experience;
  const fitnessLevel = questionnaire?.q2_fitness_level ?? null;
  const goalCategory = detectGoalCategory(goal);

  const oneLiner = hasQ && goal && commitment
    ? `If you work out with us ${commitment} a week, I can clearly see you ${goal.toLowerCase()}.`
    : null;
  const walkInOneLiner = `Ask their goal before class — then build this one-liner in your head before the sit-down.`;

  const objectionType = detectObjection(obstacle);
  const eirma = getEirma(objectionType, goal, commitment, oneLiner || 'achieving your goal');
  const inClassActions = getInClassActions(goalCategory, fitnessLevel);

  const handlePrint = () => window.print();

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
            <IntroTypeBadge isSecondIntro={isSecondIntro} />
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
                  <button onClick={() => window.open(`tel:${phone}`)} className="text-primary underline text-xs font-medium">{phone}</button>
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

                  {/* Section 2 — Shoutout Consent */}
                  <div className="rounded-lg border-2 border-amber-400 bg-amber-50/60 dark:bg-amber-950/20 p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300 mb-2">BEFORE YOU START</p>
                    <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed mb-3">
                      "One thing about our coaches — they're going to hype you up out there. Would you be against the coach shouting you out and getting the room hyped for you?"
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveConsent(true)}
                        disabled={savingConsent}
                        className={`flex-1 rounded-lg border-2 px-3 py-2 text-xs font-bold transition-all ${shoutoutConsent === true ? 'border-green-500 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'border-muted bg-background hover:border-green-300'}`}
                      >
                        ✓ Yes — good to go
                      </button>
                      <button
                        onClick={() => handleSaveConsent(false)}
                        disabled={savingConsent}
                        className={`flex-1 rounded-lg border-2 px-3 py-2 text-xs font-bold transition-all ${shoutoutConsent === false ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' : 'border-muted bg-background hover:border-blue-300'}`}
                      >
                        ✗ No — keep it low key
                      </button>
                    </div>
                  </div>

                  {/* Section 3 — Dig Deeper */}
                  <div className="rounded-lg border overflow-hidden">
                    <div className="px-3 py-2 bg-muted/40">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Dig Deeper</p>
                    </div>
                    <div className="p-3 space-y-4 text-xs">
                      <p className="text-muted-foreground italic text-[11px]">
                        "Looking at your questionnaire — I'd love to get the coach a few more details I was curious about."
                      </p>

                      {/* Fitness Level */}
                      <div className="border-l-2 border-primary pl-3 space-y-1">
                        <p className="font-bold text-foreground">FITNESS LEVEL {fitnessLevel ? `${fitnessLevel}/5` : '—'}</p>
                        <p className="text-muted-foreground">→ "Why did you give yourself that rating?"</p>
                        <p className="text-muted-foreground">→ "What would you being at a 5 look like to you?"</p>
                        <p className="text-[10px] text-muted-foreground/60 italic">↓ let it flow naturally into goal</p>
                      </div>

                      {/* Goal + Why */}
                      <div className="border-l-2 border-primary pl-3 space-y-1">
                        <p className="font-bold text-foreground">GOAL + WHY</p>
                        <p className="text-muted-foreground">→ "So that's the version of you you want to get to?"</p>
                        <p className="text-muted-foreground/60 ml-3">or "So that's the goal right — feeling like that?"</p>
                        <p className="text-muted-foreground">→ "How different does that feel from where you're at now?"</p>
                        <p className="text-muted-foreground/60 ml-3">or "Like what does life look like if you get there?"</p>
                      </div>

                      {/* Obstacle */}
                      <div className="border-l-2 border-primary pl-3 space-y-1">
                        <p className="font-bold text-foreground">OBSTACLE</p>
                        <p className="text-muted-foreground">→ "What's gotten in the way before?"</p>
                        <p className="text-muted-foreground">→ "Like what clicked for you?"</p>
                        <p className="text-muted-foreground/60 ml-3">or "So something shifted that's causing you to take action — what was it?"</p>
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

                  {/* Section 4 — Risk Free Guarantee */}
                  <div className="rounded-xl border-2 border-primary bg-primary/5 p-3.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Zap className="w-4 h-4 text-primary" />
                      <p className="text-xs font-bold uppercase tracking-wide text-primary">Risk Free Guarantee</p>
                    </div>
                    <p className="text-sm font-semibold text-foreground leading-relaxed">
                      "If you come consistently for 30 days and don't love it, we'll give you your money back. So there is no downside to just trying us out for a month."
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      Use this when they hesitate on price or commitment.
                    </p>
                  </div>

                  {/* Section 5 — Studio Trend (1st intros only) */}
                  {!isSecondIntro && studioTrend && (
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Studio Trend This Pay Period</p>
                      </div>
                      <p className="text-xs font-medium">Most common objection: <span className="font-bold">{studioTrend.objection}</span> ({studioTrend.percent}% of follow-ups)</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Be ready with: {OBJECTION_TIPS[studioTrend.objection] || OBJECTION_TIPS['Think about it']}
                      </p>
                    </div>
                  )}
                </div>

                <Separator className="my-2" />

                {/* ══════════ COACH CARD ══════════ */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-600 flex items-center gap-1.5">
                    <Dumbbell className="w-3.5 h-3.5" /> COACH HANDOFF
                  </h3>

                  {/* 2nd Intro: Previous Visit Data */}
                  {isSecondIntro && prevVisitData && (
                    <div className="rounded-xl p-4 border-2 border-primary bg-primary/5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">FROM THEIR FIRST VISIT</p>
                      {prevVisitData.objection && (
                        <p className="text-base font-bold text-primary mb-1">Previous objection: {prevVisitData.objection}</p>
                      )}
                      {prevVisitData.notes && (
                        <p className="text-xs text-foreground mb-1">What they said: {prevVisitData.notes}</p>
                      )}
                      {goal && <p className="text-xs text-foreground">Goal: {goal}</p>}
                      {emotionalDriver && <p className="text-xs text-foreground">Why: {emotionalDriver}</p>}
                    </div>
                  )}

                  {/* Quick Snapshot */}
                  <div className="rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3 text-xs">
                    <p className="font-bold">{memberName} | {classTime ? classTime.substring(0, 5) : '—'} | Level {fitnessLevel ? `${fitnessLevel}/5` : '—'}</p>
                    <p className="text-muted-foreground">Goal: {goal || 'Ask before class'} | Coach: {coachName}</p>
                  </div>

                  {/* Pre-entry announcement */}
                  <div className="rounded-lg border overflow-hidden">
                    <div className="px-3 py-2 bg-blue-100/50 dark:bg-blue-950/30">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-blue-800 dark:text-blue-300">Pre-Entry</p>
                    </div>
                    <div className="p-3 text-xs">
                      <p className="italic text-foreground leading-relaxed">
                        "Before we head in — {firstName} is doing their first class with us today. This is what we do — let's make them feel a part of the OTF Family."
                      </p>
                    </div>
                  </div>

                  {/* In-class actions */}
                  <div className="rounded-lg border overflow-hidden">
                    <div className="px-3 py-2 bg-blue-100/50 dark:bg-blue-950/30">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-blue-800 dark:text-blue-300">In-Class Actions</p>
                    </div>
                    <div className="p-3 space-y-2">
                      {inClassActions.map((action, i) => (
                        <div key={i} className="flex gap-2 text-xs">
                          <span className="text-blue-600 mt-0.5">•</span>
                          <span>{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Peak Moment — only when consent = true */}
                  {shoutoutConsent === true && (
                    <div className="rounded-lg border-2 border-primary overflow-hidden">
                      <div className="px-3 py-2 bg-primary/10">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-primary flex items-center gap-1">
                          <Megaphone className="w-3 h-3" /> Peak Moment — On the Mic
                        </p>
                      </div>
                      <div className="p-3 text-xs">
                        <p className="italic text-foreground leading-relaxed">
                          "{PEAK_MOMENT_LINES[goalCategory](firstName)}"
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Closing — only when consent = true */}
                  {shoutoutConsent === true && (
                    <div className="rounded-lg border overflow-hidden">
                      <div className="px-3 py-2 bg-emerald-100/50 dark:bg-emerald-950/30">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">Closing</p>
                      </div>
                      <div className="p-3 text-xs">
                        <p className="italic text-foreground leading-relaxed">
                          "Shout out to {firstName} for crushing their first class! You did amazing!"
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Performance Summary */}
                  <div className="rounded-lg border overflow-hidden">
                    <div className="px-3 py-2 bg-muted/40">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Performance Summary (SA is present)</p>
                    </div>
                    <div className="p-3 space-y-2 text-xs">
                      <p className="italic text-foreground leading-relaxed">
                        "Based on what I saw today and what you're going for — if you're in here {commitment || '[X]'} days a week you're going to get there. Like genuinely."
                      </p>
                      <p className="text-muted-foreground text-[10px]">or</p>
                      <p className="italic text-foreground leading-relaxed">
                        "Based on today — {commitment || '[X]'} days a week gets you to {goal ? goal.toLowerCase() : '[goal]'}. That's not a sales pitch, that's just what I saw."
                      </p>
                    </div>
                  </div>
                </div>

                <Separator className="my-2" />

                {/* After Class EIRMA */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    AFTER CLASS — EIRMA
                  </h3>
                  <Badge variant="outline" className="text-xs px-2">
                    Most likely objection: {eirma.label}
                  </Badge>
                  <div className="space-y-2">
                    {[
                      { step: 'E', label: 'Empathize', line: eirma.e, color: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' },
                      { step: 'I', label: 'Isolate', line: eirma.i, color: 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800' },
                      { step: 'R', label: 'Redirect', line: eirma.r, color: 'bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800' },
                      { step: 'M', label: 'Membership', line: eirma.m, color: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' },
                      { step: 'A', label: 'Ask', line: eirma.a, color: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800' },
                    ].map(({ step, label, line, color }) => (
                      <div key={step} className={`rounded-lg border p-2.5 ${color}`}>
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-black text-sm w-4">{step}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
                        </div>
                        <p className="text-xs leading-relaxed pl-6">{line}</p>
                      </div>
                    ))}
                  </div>
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

        {/* ══════════ PRINT LAYOUT ══════════ */}
        <div className="hidden print:block fixed inset-0 bg-white p-4 text-black" style={{ zIndex: 9999, fontSize: '11px', fontFamily: 'system-ui, sans-serif' }}>
          {/* SA HALF */}
          <div className="font-bold text-sm border-b pb-1 mb-2">
            {memberName} | {classDate}{classTime ? ` | ${classTime.substring(0, 5)}` : ''}
          </div>

          {oneLiner && (
            <div className="mb-2 p-1.5 border-2 border-black">
              <div className="font-bold">"{oneLiner}"</div>
            </div>
          )}

          <div className="mb-2 p-1.5 border border-gray-400">
            <div className="font-bold mb-0.5">SHOUTOUT CONSENT</div>
            <div style={{ fontSize: '10px' }}>"One thing about our coaches — they're going to hype you up out there.</div>
            <div style={{ fontSize: '10px' }}>Would you be against the coach shouting you out and getting the room hyped for you?"</div>
            <div className="mt-1">□ Yes — good to go &nbsp;&nbsp;&nbsp; □ No — keep it low key</div>
          </div>

          <div className="mb-2">
            <div className="font-bold mb-0.5">DIG DEEPER</div>
            <div style={{ fontSize: '10px' }} className="italic mb-1">Opener: "Looking at your questionnaire — I'd love to get the coach a few more details I was curious about."</div>
            <div className="ml-1 space-y-0.5" style={{ fontSize: '10px' }}>
              <div className="font-bold">LEVEL {fitnessLevel ? `${fitnessLevel}/5` : '—'}</div>
              <div>→ "Why did you give yourself that rating?"</div>
              <div>→ "What would you being at a 5 look like to you?"</div>
              <div className="font-bold mt-1">GOAL + WHY</div>
              <div>→ "So that's the version of you you want to get to?"</div>
              <div className="ml-3">or "So that's the goal right — feeling like that?"</div>
              <div>→ "How different does that feel from where you're at now?"</div>
              <div className="ml-3">or "Like what does life look like if you get there?"</div>
              <div className="font-bold mt-1">OBSTACLE</div>
              <div>→ "What's gotten in the way before?"</div>
              <div>→ "Like what clicked for you?"</div>
              <div className="ml-3">or "So something shifted that's causing you to take action — what was it?"</div>
            </div>
          </div>

          <div className="mb-2 p-1.5 border-2 border-black">
            <div className="font-bold">⚡ RISK FREE GUARANTEE</div>
            <div style={{ fontSize: '10px' }}>"If you come consistently for 30 days and don't love it, we'll give you your money back.</div>
            <div style={{ fontSize: '10px' }}>So there is no downside to just trying us out for a month."</div>
          </div>

          {/* CUT LINE */}
          <div className="my-2 text-center" style={{ fontSize: '10px', letterSpacing: '2px' }}>
            ✂ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
          </div>
          <div className="font-bold text-sm mb-2">
            COACH COPY — {memberName} | {classTime ? classTime.substring(0, 5) : '—'} | Level {fitnessLevel ? `${fitnessLevel}/5` : '—'}
          </div>

          {/* COACH HALF */}
          <div style={{ fontSize: '10px' }}>
            <div className="mb-1">Goal: {goal || 'Ask before class'} | Coach: {coachName}</div>

            <div className="mb-1.5">
              <div className="font-bold">PRE-ENTRY</div>
              <div>"Before we head in — {firstName} is doing their first class with us today.</div>
              <div>This is what we do — let's make them feel a part of the OTF Family."</div>
            </div>

            <div className="mb-1.5">
              <div className="font-bold">IN-CLASS ACTIONS</div>
              {inClassActions.map((a, i) => <div key={i}>• {a}</div>)}
            </div>

            {shoutoutConsent === true && (
              <>
                <div className="mb-1.5">
                  <div className="font-bold">PEAK MOMENT — ON THE MIC</div>
                  <div>"{PEAK_MOMENT_LINES[goalCategory](firstName)}"</div>
                </div>
                <div className="mb-1.5">
                  <div className="font-bold">CLOSING</div>
                  <div>"Shout out to {firstName} for crushing their first class! You did amazing!"</div>
                </div>
              </>
            )}

            <div>
              <div className="font-bold">PERFORMANCE SUMMARY</div>
              <div>"Based on what I saw today and what you're going for — if you're in here {commitment || '[X]'} days a week</div>
              <div>you're going to get there. Like genuinely."</div>
              <div className="mt-0.5">or</div>
              <div>"Based on today — {commitment || '[X]'} days a week gets you to {goal ? goal.toLowerCase() : '[goal]'}. That's not a sales pitch, that's just what I saw."</div>
            </div>
          </div>
        </div>
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
