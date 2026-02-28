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
  const [buyingCriteria, setBuyingCriteria] = useState('');
  const [saObjection, setSaObjection] = useState('');
  const [savingBrief, setSavingBrief] = useState(false);

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
        .select('shoutout_consent, sa_buying_criteria, sa_objection' as any)
        .eq('id', bookingId)
        .single(),
    ]).then(([qRes, logRes, consentRes]) => {
      const allQ = (qRes.data || []) as unknown as QuestionnaireData[];
      const completed = allQ.find(q => q.status === 'completed' || q.status === 'submitted');
      setQuestionnaire(completed || allQ[0] || null);
      setSendLogs((logRes.data || []) as SendLogEntry[]);
      const bookingData = consentRes.data as any;
      setShoutoutConsent(bookingData?.shoutout_consent ?? null);
      setBuyingCriteria(bookingData?.sa_buying_criteria || '');
      setSaObjection(bookingData?.sa_objection || '');
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

  const handleSaveBrief = useCallback(async (field: 'sa_buying_criteria' | 'sa_objection', value: string) => {
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
  const emotionalDriver = questionnaire?.q5_emotional_driver;
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
                  <button onClick={() => window.open(`tel:${phone}`)} className="text-primary underline text-xs font-medium">{formatPhoneDisplay(phone) || phone}</button>
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
                            <div><span className="text-muted-foreground">Obstacle:</span> <span className="font-semibold">"{obstacle}"</span></div>
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

                  {/* THE BRIEF — SA fills in after dig deeper */}
                  <div className="rounded-lg border-2 border-blue-300 dark:border-blue-700 overflow-hidden">
                    <div className="px-3 py-2 bg-blue-50/60 dark:bg-blue-950/30">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-blue-800 dark:text-blue-300">THE BRIEF</p>
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">Fill in after dig deeper — handed to coach on print card</p>
                    </div>
                    <div className="p-3 space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">What they're looking for</Label>
                        <Textarea
                          value={buyingCriteria}
                          onChange={e => setBuyingCriteria(e.target.value)}
                          onBlur={() => handleSaveBrief('sa_buying_criteria', buyingCriteria)}
                          placeholder="Use their exact words…"
                          className="min-h-[48px] text-xs resize-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">What it would come down to</Label>
                        <Textarea
                          value={saObjection}
                          onChange={e => setSaObjection(e.target.value)}
                          onBlur={() => handleSaveBrief('sa_objection', saObjection)}
                          placeholder="Use their exact words…"
                          className="min-h-[48px] text-xs resize-none"
                        />
                      </div>
                    </div>
                  </div>

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
                        <p className="font-bold text-foreground">WHAT WOULD IT COME DOWN TO</p>
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
                    <Dumbbell className="w-3.5 h-3.5" /> COACH CARD
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

                  {/* THE SPINE */}
                  <div className="rounded-xl p-4 border-2 border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-blue-800 dark:text-blue-300 mb-2">THE SPINE</p>
                    <p className="text-sm font-bold leading-snug text-blue-900 dark:text-blue-100">
                      "By the end of this class {firstName} should have a story worth telling about themselves."
                    </p>
                  </div>

                  {/* THE BRIEF (read-only view for coach) */}
                  <div className="rounded-lg border border-blue-200 dark:border-blue-800 overflow-hidden">
                    <div className="px-3 py-2 bg-blue-50/50 dark:bg-blue-950/30">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-blue-800 dark:text-blue-300">THE BRIEF</p>
                      <p className="text-[10px] text-blue-600 dark:text-blue-400">SA fills this in after dig deeper — handed to coach on print card during intro</p>
                    </div>
                    <div className="p-3 space-y-1.5 text-xs">
                      <div><span className="font-bold text-blue-800 dark:text-blue-300">What they're looking for:</span> <span>{buyingCriteria || '—'}</span></div>
                      <div><span className="font-bold text-blue-800 dark:text-blue-300">What it would come down to:</span> <span>{saObjection || '—'}</span></div>
                      <p className="text-[10px] text-muted-foreground italic mt-1">Use their exact words. Not paraphrases. These two lines build your mirror drop and your performance summary.</p>
                    </div>
                  </div>

                  <Separator />

                  {/* THE ARC */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-blue-800 dark:text-blue-300">THE ARC</p>

                    {/* PRE-ENTRY */}
                    <div className="rounded-lg border overflow-hidden">
                      <div className="px-3 py-1.5 bg-blue-100/50 dark:bg-blue-950/30">
                        <p className="text-[10px] font-bold uppercase text-blue-800 dark:text-blue-300">PRE-ENTRY — The Initiation</p>
                      </div>
                      <div className="p-3 text-xs space-y-1.5">
                        <p>While the intro is on their tour Koa or SA briefs the room.</p>
                        <p className="italic">"We have a first-timer today. When they hit their all-out — make some noise. Make them feel like they belong here."</p>
                        <p className="text-muted-foreground">Raffle is live from this moment.</p>
                      </div>
                    </div>

                    {/* ACT 1 */}
                    <div className="rounded-lg border overflow-hidden">
                      <div className="px-3 py-1.5 bg-blue-100/50 dark:bg-blue-950/30">
                        <p className="text-[10px] font-bold uppercase text-blue-800 dark:text-blue-300">ACT 1 — The Threshold + Tiny Win</p>
                      </div>
                      <div className="p-3 text-xs space-y-1.5">
                        <p>When they step on the treadmill for the first time mark it.</p>
                        <p className="italic">"This is it. Everything starts here."</p>
                        <p>First treadmill block — call their base pace then quietly say <span className="italic">"you can go one higher."</span></p>
                        <p>Let them do it. Don't celebrate loudly. Just nod. This is theirs alone.</p>
                        <p className="text-muted-foreground">They bank a private win before the difficulty hits.</p>
                      </div>
                    </div>

                    {/* ACT 2 */}
                    <div className="rounded-lg border overflow-hidden">
                      <div className="px-3 py-1.5 bg-blue-100/50 dark:bg-blue-950/30">
                        <p className="text-[10px] font-bold uppercase text-blue-800 dark:text-blue-300">ACT 2 — The Struggle Hold + Mirror Drop</p>
                      </div>
                      <div className="p-3 text-xs space-y-1.5">
                        <p>Block two — hold back encouragement deliberately. No rescue. No coaching in.</p>
                        <p>Let them feel the difficulty. This is the valley. The all-out needs a valley to land.</p>
                        <p>Once during this block appear next to them.</p>
                        <p>Drop one sentence using their exact words from the brief:</p>
                        <p className="italic font-semibold">"That's what {buyingCriteria ? `${buyingCriteria}` : '[their buying criteria]'} looks like right now."</p>
                        <p className="text-muted-foreground">Say it quietly. Move on. It should feel like coincidence. It isn't.</p>
                      </div>
                    </div>

                    {/* ACT 3 */}
                    <div className="rounded-lg border-2 border-primary overflow-hidden">
                      <div className="px-3 py-1.5 bg-primary/10">
                        <p className="text-[10px] font-bold uppercase text-primary">ACT 3 — The All-Out Sequence (non-negotiable)</p>
                      </div>
                      <div className="p-3 text-xs space-y-3">
                        <p className="font-bold text-foreground">If class has a traditional all-out:</p>
                        <div className="space-y-2 ml-1">
                          <div>
                            <p className="font-bold text-primary">DRUMROLL</p>
                            <p>One sentence on the mic as the all-out starts:</p>
                            <p className="italic">"First-timer in the house — {firstName} let's go."</p>
                            <p className="text-muted-foreground">Keep it fuel not spotlight. Slot it into your natural callout flow.</p>
                          </div>
                          <div>
                            <p className="font-bold text-primary">DURING</p>
                            <p>Weave their name and goal language into your normal encouragement:</p>
                            <p className="italic">"{firstName} — this is what {buyingCriteria ? `${buyingCriteria}` : '[their words]'} looks like. Don't stop."</p>
                          </div>
                          <div>
                            <p className="font-bold text-primary">CALLOUT</p>
                            <p>The moment the timer hits zero. Full stop.</p>
                            <p className="italic">"Everybody — {firstName} just hit their first all-out. Let's go."</p>
                            <p className="text-muted-foreground">Hold the mic. Let the room respond. Don't rush past this moment.</p>
                          </div>
                          <div>
                            <p className="font-bold text-primary">AFTERGLOW</p>
                            <p>10 seconds after the room settles. Quietly on mic:</p>
                            <p className="italic">"Lock in what you just felt. That's yours now."</p>
                          </div>
                        </div>

                        <Separator />

                        <div>
                          <p className="font-bold text-foreground">If class has no traditional all-out:</p>
                          <p className="mt-1">Identify the hardest push in the final 30-60 seconds of the last treadmill block.</p>
                          <p>That moment is the all-out. Run the exact same four-beat sequence.</p>
                          <p className="text-muted-foreground">DRUMROLL → DURING → CALLOUT → AFTERGLOW</p>
                          <p className="text-muted-foreground">Same words. Same energy. Same non-negotiable.</p>
                        </div>
                      </div>
                    </div>

                    {/* VETERAN TORCH PASS */}
                    <div className="rounded-lg border overflow-hidden">
                      <div className="px-3 py-1.5 bg-blue-100/50 dark:bg-blue-950/30">
                        <p className="text-[10px] font-bold uppercase text-blue-800 dark:text-blue-300">VETERAN TORCH PASS</p>
                      </div>
                      <div className="p-3 text-xs space-y-1.5">
                        <p>Before class — coach or Koa pulls one member aside.</p>
                        <p>Ask them: <span className="italic">"Would you be willing to say one thing to our first-timer at the end? Just: I remember my first. Welcome."</span></p>
                        <p className="text-muted-foreground">That's it.</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* THE PERFORMANCE SUMMARY */}
                  <div className="rounded-lg border overflow-hidden">
                    <div className="px-3 py-2 bg-emerald-100/50 dark:bg-emerald-950/30">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">THE PERFORMANCE SUMMARY</p>
                    </div>
                    <div className="p-3 text-xs space-y-1.5">
                      <p className="text-muted-foreground">At the TV screen. Intro and SA both present.</p>
                      <p className="text-muted-foreground">One sentence. Built from the brief. Their exact words.</p>
                      <p className="italic font-semibold text-foreground leading-relaxed">
                        "You came in looking for {buyingCriteria || '[their words]'}. You found it in that {'{all-out / final push}'}. That's you."
                      </p>
                      <p className="text-muted-foreground font-semibold">Stop. Let it land.</p>
                    </div>
                  </div>

                  <Separator />

                  {/* STANDOUT MEMBER */}
                  <div className="rounded-lg border overflow-hidden">
                    <div className="px-3 py-2 bg-muted/40">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">STANDOUT MEMBER</p>
                    </div>
                    <div className="p-3 text-xs space-y-1.5">
                      <p>After the intro leaves SA asks:</p>
                      <p className="italic">"Was there a member who made you feel especially welcome today?"</p>
                      <p>If they name someone SA texts that member:</p>
                      <p className="italic">"hey — {firstName.toLowerCase()} just left and before they walked out they asked me who made them feel the most welcome today. they said you. I just wanted you to know that."</p>
                      <p className="text-muted-foreground">Name goes on the Member of the Moment board for the week.</p>
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
        <div data-print-card className="hidden print:block fixed inset-0 bg-white p-4 text-black" style={{ zIndex: 9999, fontSize: '11px', fontFamily: 'system-ui, sans-serif', maxHeight: '100vh', overflow: 'hidden' }}>
          {/* SA HALF */}
          <div className="font-bold text-sm border-b pb-1 mb-2">
            {memberName} | {classDate}{classTime ? ` | ${classTime.substring(0, 5)}` : ''}
          </div>

          {oneLiner && (
            <div className="mb-2 p-1.5 border-2 border-black">
              <div className="font-bold">"{oneLiner}"</div>
            </div>
          )}

          {/* WHAT THEY TOLD US — Print */}
          {hasQ && (
            <div className="mb-2" style={{ fontSize: '10px' }}>
              <div className="font-bold mb-0.5">WHAT THEY TOLD US</div>
              {fitnessLevel != null && <div>Level: {fitnessLevel}/5</div>}
              {goal && <div>Goal: "{goal}"</div>}
              {emotionalDriver && <div>Why: "{emotionalDriver}"</div>}
              {obstacle && <div>Obstacle: "{obstacle}"</div>}
              {(commitment || questionnaire?.q6b_available_days) && (
                <div>
                  {commitment ? `Commit: ${commitment} days/week` : ''}
                  {commitment && questionnaire?.q6b_available_days ? ' | ' : ''}
                  {questionnaire?.q6b_available_days ? `Days: ${questionnaire.q6b_available_days}` : ''}
                </div>
              )}
              {questionnaire?.q7_coach_notes && <div>Notes: "{questionnaire.q7_coach_notes}"</div>}
            </div>
          )}

          <div className="mb-2 p-1.5 border border-gray-400">
            <div className="font-bold mb-0.5">SHOUTOUT CONSENT</div>
            <div style={{ fontSize: '10px' }}>"One thing about our coaches — they're going to hype you up out there.</div>
            <div style={{ fontSize: '10px' }}>Would you be against the coach shouting you out and getting the room hyped for you?"</div>
            <div className="mt-1">□ Yes — good to go &nbsp;&nbsp;&nbsp; □ No — keep it low key</div>
          </div>

          {/* DIG DEEPER — Print (3 waypoints only) */}
          <div className="mb-2">
            <div className="font-bold mb-0.5">DIG DEEPER</div>
            <div style={{ fontSize: '10px' }} className="italic mb-1">Opener: "Looking at your questionnaire — I'd love to get the coach a few more details I was curious about."</div>
            <div className="ml-1 space-y-0.5" style={{ fontSize: '10px' }}>
              <div className="font-bold">FITNESS LEVEL {fitnessLevel ? `${fitnessLevel}/5` : '[X]/5'}</div>
              <div>→ "Why did you give yourself that rating?"</div>
              <div>→ "What would you being at a 5 look like to you?"</div>
              <div className="font-bold mt-1">WHAT ARE YOU LOOKING FOR</div>
              <div>→ "What are you looking for in a gym membership?"</div>
              <div className="ml-3 italic">Note: use their exact words in your close.</div>
              <div className="font-bold mt-1">WHAT WOULD IT COME DOWN TO</div>
              <div>→ "If you ended up not joining after today — what do you think it would come down to?"</div>
              <div className="ml-3 italic">Note: don't reassure. just listen. you have the whole class to prepare.</div>
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

          {/* COACH HALF — Print */}
          <div className="font-bold text-sm mb-1">
            COACH COPY — {memberName} | {classTime ? classTime.substring(0, 5) : '—'}
          </div>

          <div style={{ fontSize: '10px' }}>
            <div className="mb-1.5 p-1 border border-gray-400">
              <div className="font-bold">THE SPINE</div>
              <div>"{firstName} leaves with a story worth telling about themselves."</div>
            </div>

            <div className="mb-1.5 p-1 border border-gray-400">
              <div className="font-bold">THE BRIEF (SA fills in after dig deeper)</div>
              <div>Looking for: {buyingCriteria || '___________________________'}</div>
              <div>Would come down to: {saObjection || '____________________'}</div>
            </div>

            <div className="mb-1">
              <div className="font-bold">PRE-ENTRY</div>
              <div>While intro is on tour — Koa or SA briefs the room:</div>
              <div>"First-timer today. When they hit their all-out — make some noise. Make them feel like they belong."</div>
              <div>Raffle is live.</div>
            </div>

            <div className="mb-1">
              <div className="font-bold">ACT 1 — THRESHOLD + TINY WIN</div>
              <div>Step on tread: "This is it. Everything starts here." (quiet — just them)</div>
              <div>Block 1: "You can go one higher." Let them. Just nod.</div>
            </div>

            <div className="mb-1">
              <div className="font-bold">ACT 2 — STRUGGLE HOLD + MIRROR DROP</div>
              <div>Block 2: Hold back. No rescue. Let them feel the valley.</div>
              <div>Once — appear next to them:</div>
              <div>"That's what {buyingCriteria ? `${buyingCriteria}` : '[their words]'} looks like right now."</div>
            </div>

            <div className="mb-1">
              <div className="font-bold">ACT 3 — ALL-OUT (non-negotiable)</div>
              <div>DRUMROLL: "First-timer in the house — {firstName} let's go."</div>
              <div>DURING: "{firstName} — this is what {buyingCriteria ? `${buyingCriteria}` : '[their words]'} looks like. Don't stop."</div>
              <div>CALLOUT: "Everybody — {firstName} just hit their first all-out. Let's go." Hold it.</div>
              <div>AFTERGLOW: "Lock in what you just felt. That's yours now."</div>
              <div className="mt-0.5 italic">No traditional all-out → final 30-60 sec of last tread block. Same sequence.</div>
            </div>

            <div className="mb-1">
              <div className="font-bold">VETERAN TORCH PASS</div>
              <div>Pull one member aside before class:</div>
              <div>"Would you say one thing to our first-timer at the end? Just: I remember my first. Welcome."</div>
            </div>

            <div className="mb-1">
              <div className="font-bold">PERFORMANCE SUMMARY (TV screen — intro + SA present)</div>
              <div>"You came in looking for {buyingCriteria || '[their words]'}. You found it in that [moment]. That's you."</div>
              <div>Stop. Let it land.</div>
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
