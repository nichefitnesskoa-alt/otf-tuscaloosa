import { useState, useEffect } from 'react';
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
import {
  User, Calendar, Target, ClipboardList, DollarSign, Phone, Mail,
  MessageSquare, FileText, Copy, History, Link2, Printer, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { HumanizedEirma } from './HumanizedEirma';
import { IntroTypeBadge, LeadSourceTag } from './IntroTypeBadge';
import { FollowUpStatusBadge } from './FollowUpStatusBadge';
import { LinkQuestionnaireDialog } from './LinkQuestionnaireDialog';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
  }>;
  onGenerateScript?: () => void;
  onSendQ?: () => void;
}

/** Detect most likely objection from obstacle text */
function detectObjection(obstacle: string | null): 'price' | 'time' | 'spouse' | 'commitment' {
  if (!obstacle) return 'price';
  const low = obstacle.toLowerCase();
  if (/money|cost|price|expensive|afford|budget/i.test(low)) return 'price';
  if (/time|busy|schedule|work|hour/i.test(low)) return 'time';
  if (/spouse|partner|husband|wife|significant|family/i.test(low)) return 'spouse';
  if (/commit|consistent|stick|start|stop|motivation/i.test(low)) return 'commitment';
  return 'price';
}

/** Get EIRMA lines based on detected objection + member data */
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

  const objectionLabels = {
    price: 'Pricing',
    time: 'Time',
    spouse: 'Partner Buy-In',
    commitment: 'Consistency',
  };

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

  const defaultBookings = bookings || [{
    id: bookingId,
    class_date: classDate,
    intro_time: classTime,
    coach_name: coachName,
    lead_source: leadSource,
    booking_status: 'Active',
    booked_by: null,
    fitness_goal: null,
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
    ]).then(([qRes, logRes]) => {
      const allQ = (qRes.data || []) as unknown as QuestionnaireData[];
      const completed = allQ.find(q => q.status === 'completed' || q.status === 'submitted');
      setQuestionnaire(completed || allQ[0] || null);
      setSendLogs((logRes.data || []) as SendLogEntry[]);
      setLoading(false);
    });
  }, [open, bookingId]);

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

  // ── Transformative one-liner ──────────────────────────────────────────────
  const oneLiner = hasQ && goal && commitment
    ? `If you work out with us ${commitment} a week, I can clearly see you ${goal.toLowerCase()}.`
    : null;

  const walkInOneLiner = `Ask their goal before class — then build this one-liner in your head before the sit-down.`;

  // ── EIRMA auto-detection ──────────────────────────────────────────────────
  const objectionType = detectObjection(obstacle);
  const eirma = getEirma(objectionType, goal, commitment, oneLiner || `achieving your goal`);

  // ── Print function ────────────────────────────────────────────────────────
  const handlePrint = () => {
    window.print();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0">
        <SheetHeader className="p-4 pb-3 border-b">
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
            <Button
              variant="outline"
              size="sm"
              className="h-5 text-[10px] px-2 gap-1 ml-auto"
              onClick={handlePrint}
            >
              <Printer className="w-3 h-3" /> Print Card
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="p-4 space-y-4 prep-card-content">
            {/* Quick Info */}
            <div className="rounded-lg bg-muted/30 p-3 text-sm space-y-1.5 print:hidden">
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

            {/* Print header (only visible when printing) */}
            <div className="hidden print:block border-b pb-2 mb-2">
              <div className="font-bold text-lg">{memberName} | {classDate}{classTime ? ` | ${classTime.substring(0,5)}` : ''} | {coachName}</div>
            </div>

            {loading ? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            ) : (
              <>
                {/* ── TRANSFORMATIVE ONE-LINER ── */}
                <div className={`rounded-xl p-4 border-2 ${hasQ && oneLiner ? 'border-primary bg-primary/5' : 'border-muted bg-muted/30'}`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Your North Star</p>
                  {hasQ && oneLiner ? (
                    <p className="text-base font-bold leading-snug text-foreground">
                      "{oneLiner}"
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-muted-foreground italic leading-snug">
                      {walkInOneLiner}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1.5">Anchor every conversation here. Reference this in class, in the sit-down, in EIRMA.</p>
                </div>

                {/* Tabbed Prep Content */}
                <Tabs defaultValue="before" className="w-full">
                  <TabsList className="w-full grid grid-cols-2 print:hidden">
                    <TabsTrigger value="before" className="text-xs">Before Class</TabsTrigger>
                    <TabsTrigger value="after" className="text-xs">After Class</TabsTrigger>
                  </TabsList>

                  {/* ===== TAB 1: BEFORE CLASS ===== */}
                  <TabsContent value="before" className="space-y-3 mt-3">
                    {/* SNAPSHOT */}
                    <div className="rounded-lg border bg-muted/20 overflow-hidden">
                      <div className="px-3 py-2 bg-muted/40 flex items-center gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Snapshot</p>
                      </div>
                      <div className="p-3 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs">
                        <span className="font-bold text-muted-foreground">Goal</span>
                        <span>{hasQ ? (goal || '—') : <span className="italic text-muted-foreground">Ask before class</span>}</span>
                        <span className="font-bold text-muted-foreground">Why</span>
                        <span>{hasQ ? (emotionalDriver || '—') : <span className="italic text-muted-foreground">Ask before class</span>}</span>
                        <span className="font-bold text-muted-foreground">Obstacle</span>
                        <span>{hasQ ? (obstacle || '—') : <span className="italic text-muted-foreground">Ask before class</span>}</span>
                        <span className="font-bold text-muted-foreground">Commit</span>
                        <span>{hasQ ? (commitment || '—') : <span className="italic text-muted-foreground">Ask before class</span>}</span>
                        <span className="font-bold text-muted-foreground">Fitness Level</span>
                        <span>{hasQ && fitnessLevel ? `${fitnessLevel} / 5` : <span className="italic text-muted-foreground">{hasQ ? '—' : 'Ask before class'}</span>}</span>
                      </div>
                    </div>

                    {/* DIG DEEPER */}
                    <div className="rounded-lg border overflow-hidden">
                      <div className="px-3 py-2 bg-muted/40">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Dig Deeper — Before Class</p>
                        <p className="text-[10px] text-muted-foreground">Questions to ask. Not statements.</p>
                      </div>
                      <div className="p-3 space-y-3 text-xs">
                        {hasQ ? (
                          <>
                            {/* Goal questions */}
                            <div>
                              <p className="font-bold text-foreground mb-1">Goal{goal ? `: "${goal}"` : ''}</p>
                              <ul className="space-y-0.5 text-muted-foreground pl-2">
                                <li>• Certain weight or size in mind? Or more about how you feel?</li>
                                <li>• What's the time frame you're working with?</li>
                                <li>• What have you already tried to get there?</li>
                                <li>• Do you need help on the nutrition side too? <span className="text-primary font-medium">(mention Koa — free)</span></li>
                              </ul>
                            </div>

                            {/* Fitness level questions */}
                            {fitnessLevel && (
                              <div>
                                <p className="font-bold text-foreground mb-1">Fitness Level: {fitnessLevel}/5</p>
                                <ul className="space-y-0.5 text-muted-foreground pl-2">
                                  <li>• "You rated yourself a {fitnessLevel} — what made you pick that number?"</li>
                                  <li>• "What does a {fitnessLevel} feel like for you day to day?"</li>
                                </ul>
                              </div>
                            )}

                            {/* Obstacle questions */}
                            {obstacle && (
                              <div>
                                <p className="font-bold text-foreground mb-1">Obstacle: "{obstacle}"</p>
                                <ul className="space-y-0.5 text-muted-foreground pl-2">
                                  <li>• "What specifically made that get in the way before?"</li>
                                  <li>• "When it was an obstacle, what did that look like?"</li>
                                  <li>• "What's different about now?"</li>
                                </ul>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-2.5">
                            <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1.5">Walk-in — Ask these before class starts:</p>
                            <ul className="space-y-1 text-amber-700 dark:text-amber-400">
                              <li>• "What's your main fitness goal?"</li>
                              <li>• "Why is that the goal — what's it really about?"</li>
                              <li>• "What's been the biggest thing holding you back?"</li>
                              <li>• "How many days a week could you realistically work out?"</li>
                              <li>• "What have you already tried?"</li>
                            </ul>
                          </div>
                        )}
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
                          <Link2 className="w-3 h-3 mr-1" />
                          Link Existing Q
                        </Button>
                      </div>
                    )}

                    {/* ⚡ RISK FREE GUARANTEE — ALWAYS PRESENT */}
                    <div className="rounded-xl border-2 border-yellow-400 bg-yellow-50/60 dark:bg-yellow-950/20 p-3.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Zap className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                        <p className="text-xs font-bold uppercase tracking-wide text-yellow-800 dark:text-yellow-300">Always Mention: Risk Free Guarantee</p>
                      </div>
                      <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-200 leading-relaxed">
                        They can try us for 30 days with no commitment.
                      </p>
                      <p className="text-xs text-yellow-800 dark:text-yellow-300 mt-1">
                        If it's not for them, no hard feelings. Zero risk to try. Say this before the close.
                      </p>
                    </div>
                  </TabsContent>

                  {/* ===== TAB 2: AFTER CLASS — EIRMA ===== */}
                  <TabsContent value="after" className="mt-3 space-y-3">
                    {/* Quick Q ref */}
                    {hasQ && (
                      <div className="rounded-lg p-2.5 text-xs border border-muted bg-muted/20 grid grid-cols-2 gap-x-3 gap-y-0.5">
                        <span className="text-muted-foreground">Goal:</span><span className="font-medium">{goal || '—'}</span>
                        <span className="text-muted-foreground">Obstacle:</span><span className="font-medium">{obstacle || '—'}</span>
                        <span className="text-muted-foreground">Why:</span><span className="font-medium">{emotionalDriver || '—'}</span>
                        <span className="text-muted-foreground">Commit:</span><span className="font-medium">{commitment || '—'}</span>
                      </div>
                    )}

                    {!hasQ && (
                      <div className="rounded-md bg-muted/40 border border-dashed p-2.5 text-xs text-muted-foreground">
                        <span className="font-semibold block mb-1">No questionnaire — defaulting to price objection</span>
                        Fill in their answers from the pre-class conversation above.
                      </div>
                    )}

                    {/* EIRMA objection label */}
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs px-2">
                        Most likely objection: {eirma.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">auto-detected from obstacle</span>
                    </div>

                    {/* EIRMA steps */}
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

                    {/* Risk Free Guarantee — also in After Class tab */}
                    <div className="rounded-xl border-2 border-yellow-400 bg-yellow-50/60 dark:bg-yellow-950/20 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="w-3.5 h-3.5 text-yellow-600" />
                        <p className="text-xs font-bold text-yellow-800 dark:text-yellow-300">⚡ Risk Free Guarantee — say this before close</p>
                      </div>
                      <p className="text-xs text-yellow-900 dark:text-yellow-200">30 days. No commitment. Zero risk to try.</p>
                    </div>

                    {/* HumanizedEirma component (extended coach view) */}
                    <Separator />
                    <HumanizedEirma
                      obstacles={obstacle || (hasQ ? null : 'Price')}
                      fitnessLevel={fitnessLevel}
                      emotionalDriver={emotionalDriver || null}
                      clientName={memberName}
                      fitnessGoal={goal || null}
                      pastExperience={pastExp ?? null}
                    />
                  </TabsContent>
                </Tabs>

                {/* Activity Timeline */}
                {(sendLogs.length > 0 || defaultRuns.length > 0 || defaultBookings.length > 1) && (
                  <div className="space-y-2 print:hidden">
                    <h3 className="text-xs font-bold flex items-center gap-1.5 uppercase tracking-wide text-muted-foreground">
                      <History className="w-3.5 h-3.5 text-primary" />
                      Activity Timeline
                    </h3>
                    <div className="space-y-1.5">
                      {defaultBookings.map(b => (
                        <TimelineItem
                          key={b.id}
                          icon={<Calendar className="w-3 h-3" />}
                          label={`Booked: ${formatDate(b.class_date)}${b.intro_time ? ` @ ${b.intro_time.substring(0, 5)}` : ''}`}
                          detail={`${b.coach_name} · ${b.booking_status || 'Active'}${b.booked_by ? ` · By ${capitalizeName(b.booked_by)}` : ''}`}
                        />
                      ))}
                      {defaultRuns.map(r => (
                        <TimelineItem
                          key={r.id}
                          icon={<Target className="w-3 h-3" />}
                          label={`Ran: ${r.run_date ? formatDate(r.run_date) : 'No date'} → ${r.result}`}
                          detail={r.notes || undefined}
                          highlight={isMembershipSale(r.result)}
                        />
                      ))}
                      {sendLogs.map(l => (
                        <TimelineItem
                          key={l.id}
                          icon={<MessageSquare className="w-3 h-3" />}
                          label={`Script sent by ${capitalizeName(l.sent_by)}`}
                          detail={new Date(l.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t print:hidden">
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

        {/* Print-only card — hidden on screen, shown when printing */}
        <div className="hidden print:block fixed inset-0 bg-white p-6 text-black text-xs font-mono" style={{ zIndex: 9999 }}>
          <div className="border-b pb-2 mb-3 font-bold text-sm">
            {memberName} | {classDate}{classTime ? ` | ${classTime.substring(0, 5)}` : ''} | {coachName}
          </div>

          {oneLiner && (
            <div className="mb-3 p-2 border-2 border-black">
              <div className="font-bold">IF THEY WORK OUT {commitment?.toUpperCase() || '[X DAYS]'}/WEEK → {goal?.toUpperCase() || '[GOAL]'}</div>
            </div>
          )}

          <div className="mb-3">
            <div className="font-bold mb-1">SNAPSHOT</div>
            <div>Goal: {goal || 'Ask before class'} | Why: {emotionalDriver || 'Ask before class'}</div>
            <div>Obstacle: {obstacle || 'Ask before class'} | Commit: {commitment || 'Ask before class'} | Level: {fitnessLevel ? `${fitnessLevel}/5` : 'Ask before class'}</div>
          </div>

          <div className="mb-3">
            <div className="font-bold mb-1">DIG DEEPER</div>
            {hasQ ? (
              <>
                <div>Goal: Specific target? Time frame? What've they tried? Nutrition help?</div>
                {fitnessLevel && <div>Level {fitnessLevel}: What made you rate yourself that? What does it feel like?</div>}
                {obstacle && <div>Obstacle "{obstacle}": What specifically got in the way? What's different now?</div>}
              </>
            ) : (
              <div>Ask: goal, why, obstacle, what they've tried, time frame</div>
            )}
          </div>

          <div className="mb-3 p-2 border border-black">
            <div className="font-bold">⚡ RISK FREE GUARANTEE — ALWAYS MENTION</div>
            <div>30 days. No commitment. Zero risk to try. Say this before the close.</div>
          </div>

          <div className="border-t pt-2">
            <div className="font-bold mb-1">AFTER CLASS — {eirma.label.toUpperCase()} OBJECTION</div>
            <div>E: {eirma.e}</div>
            <div>I: {eirma.i}</div>
            <div>R: {eirma.r}</div>
            <div>M: {eirma.m}</div>
            <div>A: {eirma.a}</div>
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
