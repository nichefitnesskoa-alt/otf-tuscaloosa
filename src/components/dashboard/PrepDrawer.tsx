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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { capitalizeName, parseLocalDate } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { isMembershipSale } from '@/lib/sales-detection';
import {
  User, Calendar, Target, ClipboardList, DollarSign, Phone, Mail,
  MessageSquare, FileText, Copy, History, ChevronDown, ChevronRight, Link2,
  Shield, BookOpen, HandMetal, Mic2,
} from 'lucide-react';
import { toast } from 'sonner';
import { TransformationClose } from './TransformationClose';
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
  template_name?: string;
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

// Dig deeper prompts for each Q answer
const DIG_DEEPER: Record<string, (answer: string) => string> = {
  goal: () => 'Ask: "How much specifically? By when? What changes in your life when you get there?"',
  obstacle: (a) => {
    if (/time|busy|schedule/i.test(a)) return 'Ask: "What does a typical week look like? What time of day could work?"';
    if (/cost|money|price|expensive/i.test(a)) return 'Ask: "Is it the total cost, or more about whether it\'s worth it?"';
    if (/motivat|accountab|alone/i.test(a)) return 'Ask: "When was the last time you stuck with something? What made the difference?"';
    return 'Ask: "Tell me more about that. What has that looked like for you?"';
  },
  emotional: (_a: string) => 'Ask: "When did you last feel that way? What was different then?"',
  past: (_a: string) => 'Ask: "What did you like about it? What made you stop?"',
  commitment: (_a: string) => '"Great — let\'s talk about which specific days after class."',
};

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
    if (phone) {
      navigator.clipboard.writeText(phone);
      toast.success('Phone copied!');
    } else {
      toast.info('No phone number on file');
    }
  };

  const handleCallPhone = () => {
    if (phone) window.open(`tel:${phone}`);
  };

  const handleEmailClick = () => {
    if (email) window.open(`mailto:${email}`);
  };

  const firstName = memberName.split(' ')[0];
  const hasQ = questionnaire?.status === 'completed' || questionnaire?.status === 'submitted';
  const goal = questionnaire?.q1_fitness_goal;
  const obstacle = questionnaire?.q3_obstacle;
  const emotionalDriver = questionnaire?.q5_emotional_driver;
  const commitment = questionnaire?.q6_weekly_commitment;
  const pastExp = questionnaire?.q4_past_experience;

  const p = (text: string) =>
    text
      .replace(/\[name\]/g, firstName)
      .replace(/\[goal\]/g, goal || '[their goal]')
      .replace(/\[obstacle\]/g, obstacle || '[their obstacle]')
      .replace(/\[commitment\]/g, commitment || '[their commitment]')
      .replace(/\[coach\]/g, coachName || '[coach]');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
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
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="p-4 space-y-4">
            {/* Quick Info */}
            <div className="rounded-lg bg-muted/30 p-3 text-sm space-y-1.5">
              <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label="Date" value={`${classDate}${classTime ? ` @ ${classTime.substring(0, 5)}` : ''}`} />
              <InfoRow icon={<User className="w-3.5 h-3.5" />} label="Coach" value={coachName} />
              <InfoRow icon={<Target className="w-3.5 h-3.5" />} label="Source" value={leadSource} />
              {phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground text-xs w-16">Phone</span>
                  <button onClick={handleCallPhone} className="text-primary underline text-xs font-medium">{phone}</button>
                </div>
              )}
              {email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground text-xs w-16">Email</span>
                  <button onClick={handleEmailClick} className="text-primary underline text-xs font-medium">{email}</button>
                </div>
              )}
            </div>

            {/* Tabbed Prep Content — 2 Tabs */}
            <Tabs defaultValue="before" className="w-full">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="before" className="text-xs">Before Class</TabsTrigger>
                <TabsTrigger value="after" className="text-xs">After Class</TabsTrigger>
              </TabsList>

              {/* ===== TAB 1: BEFORE CLASS ===== */}
              <TabsContent value="before" className="space-y-3 mt-3">
                {loading ? (
                  <p className="text-xs text-muted-foreground">Loading...</p>
                ) : (
                  <>
                    {/* SECTION 1: Accusation Audit — always visible, NOT collapsible */}
                    <div className="rounded-lg p-3.5 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">Your Opening Move — Accusation Audit</h3>
                      </div>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-2.5 leading-relaxed">
                        Before you say anything else, acknowledge what they might be feeling:
                      </p>
                      <div className="space-y-2">
                        {[
                          "You're probably nervous about being in a new place with people you don't know",
                          "You might be thinking this is going to be too hard or too intense",
                          "You might be worried I'm going to try to hard-sell you into something",
                          "And honestly, you might be wondering if this is even worth your time",
                        ].map((line, i) => (
                          <p key={i} className="text-sm text-indigo-900 dark:text-indigo-200 leading-relaxed pl-3 border-l-2 border-indigo-300 dark:border-indigo-600">
                            "{line}"
                          </p>
                        ))}
                      </div>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-3 italic">
                        Starting here tells them you GET it. Now they can relax.
                      </p>
                    </div>

                    {/* SECTION 2: Their Story — Q answers with dig deeper */}
                    <div className="rounded-lg border border-muted overflow-hidden">
                      <div className="px-3 py-2 bg-muted/30 flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-primary" />
                        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Their Story</h3>
                      </div>
                      <div className="p-3 space-y-3">
                        {hasQ ? (
                          <>
                            {/* Quick Summary */}
                            <div className="rounded-md bg-primary/5 border border-primary/20 p-2.5 text-xs leading-relaxed">
                              <span className="font-semibold">{firstName}</span> wants to{' '}
                              <span className="font-medium text-primary">{goal || '—'}</span> because{' '}
                              <span className="font-medium text-primary">{emotionalDriver || '—'}</span>.
                              Their biggest obstacle is{' '}
                              <span className="font-medium text-primary">{obstacle || '—'}</span>.
                              They can commit{' '}
                              <span className="font-medium text-primary">{commitment || '—'}</span> per week.
                            </div>

                            <StoryRow label="Goal" answer={goal} digDeeper={DIG_DEEPER.goal(goal || '')} />
                            <StoryRow label="Fitness Level" answer={questionnaire?.q2_fitness_level ? `${questionnaire.q2_fitness_level}/5` : null} />
                            <StoryRow label="Biggest Obstacle" answer={obstacle} digDeeper={obstacle ? DIG_DEEPER.obstacle(obstacle) : undefined} />
                            <StoryRow label="Past Experience" answer={pastExp} digDeeper={pastExp ? DIG_DEEPER.past(pastExp) : undefined} />
                            <StoryRow label="Emotional Driver" answer={emotionalDriver} digDeeper={emotionalDriver ? DIG_DEEPER.emotional(emotionalDriver) : undefined} />
                            <StoryRow label="Weekly Commitment" answer={commitment} digDeeper={commitment ? DIG_DEEPER.commitment(commitment) : undefined} />
                            <StoryRow label="Best Days" answer={questionnaire?.q6b_available_days} />
                            <StoryRow label="Coach Notes" answer={questionnaire?.q7_coach_notes} />
                          </>
                        ) : (
                          <div className="space-y-2">
                            <div className="text-xs text-muted-foreground italic flex items-center gap-2 p-2 rounded border border-dashed">
                              <ClipboardList className="w-3.5 h-3.5" />
                              {questionnaire?.last_opened_at && questionnaire.status === 'sent'
                                ? `Questionnaire opened ${formatDistanceToNow(new Date(questionnaire.last_opened_at), { addSuffix: true })} but not completed`
                                : questionnaire ? `Questionnaire ${questionnaire.status === 'sent' ? 'sent but not completed' : 'not yet sent'}` : 'No questionnaire on file'}
                            </div>
                            <div className="flex gap-2">
                              {onSendQ && (!questionnaire || questionnaire.status === 'not_sent') && (
                                <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={onSendQ}>
                                  Send Q
                                </Button>
                              )}
                              <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => setLinkQOpen(true)}>
                                <Link2 className="w-3 h-3 mr-1" />
                                Link Existing Q
                              </Button>
                            </div>
                            <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-2.5 text-xs">
                              <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1.5">Since the Q isn't completed, ask during the greeting:</p>
                              <ul className="space-y-1 text-amber-700 dark:text-amber-400">
                                <li>• "What's your main fitness goal?"</li>
                                <li>• "What's been the biggest thing holding you back?"</li>
                                <li>• "How many days a week could you realistically work out?"</li>
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SECTION 3: Guide Them In */}
                    <PrepCollapsible title="Guide Them In — Greeting" icon="👋" defaultOpen accentColor="green">
                      <p className="leading-relaxed">
                        {p(`"Hey [name]! Welcome to Orangetheory. I'm so glad you're here. I read through your questionnaire — you said you want to [goal], and I love that. Today's class is going to be a great first step toward that. Let me walk you through what to expect."`)}
                      </p>
                      {!hasQ && (
                        <div className="mt-1.5">
                          <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-1 rounded text-[10px] font-medium">
                            Q not completed — use a general greeting and ask about their goal in person
                          </span>
                        </div>
                      )}
                      <div className="mt-3 pt-2 border-t border-green-200 dark:border-green-800">
                        <p className="font-semibold text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Set Expectations</p>
                        <p className="leading-relaxed">
                          {p(`"After class, we'll sit down for about 5-10 minutes. I'll ask you how you felt, and if it's a fit, I'll show you how to keep this going. No pressure, no awkward pitch. Sound good?"`)}
                        </p>
                      </div>
                    </PrepCollapsible>

                    {/* SECTION 4: During Class */}
                    <PrepCollapsible title="During Class — Check-In" icon="💪" accentColor="green">
                      <p className="leading-relaxed">
                        {p(`Walk into the studio at the ~25 minute mark. Make eye contact with [name], give a thumbs up or a quick "You're crushing it!" This creates a bond and shows you are invested in their experience.`)}
                      </p>
                      <p className="mt-1.5 text-muted-foreground italic">
                        Tip: Note which station they're at and what they're doing well — use this in the post-class sit-down.
                      </p>
                    </PrepCollapsible>

                    {/* Reference — Flipbook (collapsed, low priority) */}
                    <PrepCollapsible title="Reference — Flipbook Talking Points" icon="📖" accentColor="muted">
                      <ul className="space-y-1 list-disc pl-4">
                        <li><span className="font-medium">Heart Rate Zones:</span> "We use a heart rate monitor so you can see your effort in real time. You'll aim for the Orange Zone — that's where the magic happens."</li>
                        <li><span className="font-medium">Coaching:</span> "There's a coach leading the entire class. They'll tell you every move, every transition. You don't have to figure anything out."</li>
                        <li><span className="font-medium">Afterburn:</span> "The workout is designed so you keep burning calories for up to 36 hours after class. It's called the afterburn effect."</li>
                        <li><span className="font-medium">Community:</span> "Everyone in that room was a first-timer once. This is one of the most supportive workout communities you'll find."</li>
                      </ul>
                    </PrepCollapsible>
                  </>
                )}
              </TabsContent>

              {/* ===== TAB 2: AFTER CLASS ===== */}
              <TabsContent value="after" className="mt-3 space-y-4">
                {/* Quick Q Reference */}
                {hasQ && (
                  <div className="rounded-lg p-2.5 text-xs border border-muted bg-muted/20 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">📋 Quick Reference</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                      <span className="text-muted-foreground">Goal:</span>
                      <span className="font-medium">{goal || '—'}</span>
                      <span className="text-muted-foreground">Obstacle:</span>
                      <span className="font-medium">{obstacle || '—'}</span>
                      <span className="text-muted-foreground">Why:</span>
                      <span className="font-medium">{emotionalDriver || '—'}</span>
                      <span className="text-muted-foreground">Commit:</span>
                      <span className="font-medium">{commitment || '—'}</span>
                    </div>
                  </div>
                )}

                {/* Transformation Close */}
                <TransformationClose
                  clientName={memberName}
                  coachName={coachName}
                  fitnessGoal={goal || null}
                  obstacle={obstacle || null}
                  pastExperience={pastExp || null}
                  emotionalDriver={emotionalDriver || null}
                  weeklyCommitment={commitment || null}
                  availableDays={questionnaire?.q6b_available_days || null}
                />

                {!hasQ && (
                  <div className="text-xs text-muted-foreground italic flex items-center gap-1 p-2 rounded border border-dashed">
                    <ClipboardList className="w-3 h-3" />
                    Complete the questionnaire for a personalized close script. Bracketed placeholders shown above.
                  </div>
                )}

                <Separator />

                {/* Humanized EIRMA Objection Cards */}
                <HumanizedEirma
                  obstacles={obstacle || null}
                  fitnessLevel={questionnaire?.q2_fitness_level ?? null}
                  emotionalDriver={emotionalDriver || null}
                  clientName={memberName}
                  fitnessGoal={goal || null}
                  pastExperience={pastExp ?? null}
                />
              </TabsContent>
            </Tabs>

            {/* Activity Timeline */}
            {(sendLogs.length > 0 || defaultRuns.length > 0 || defaultBookings.length > 1) && (
              <div className="space-y-2">
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
            <div className="grid grid-cols-2 gap-2 pt-2 border-t">
              {onGenerateScript && (
                <Button variant="default" size="sm" className="text-xs" onClick={onGenerateScript}>
                  <MessageSquare className="w-3.5 h-3.5 mr-1" /> Generate Script
                </Button>
              )}
              {onSendQ && !isSecondIntro && (
                <Button variant="outline" size="sm" className="text-xs" onClick={onSendQ}>
                  <FileText className="w-3.5 h-3.5 mr-1" /> Send Q
                </Button>
              )}
              <Button variant="outline" size="sm" className="text-xs" onClick={handleCopyPhone}>
                <Copy className="w-3.5 h-3.5 mr-1" /> Copy Phone
              </Button>
            </div>
          </div>
        </ScrollArea>
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

function StoryRow({ label, answer, digDeeper }: { label: string; answer: string | null; digDeeper?: string }) {
  if (!answer) return null;
  return (
    <div className="text-xs">
      <div className="flex items-baseline gap-1.5">
        <span className="font-bold text-foreground">{label}:</span>
        <span>{answer}</span>
      </div>
      {digDeeper && (
        <p className="mt-0.5 pl-3 text-muted-foreground italic text-[11px] leading-relaxed">
          → {digDeeper}
        </p>
      )}
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

function PrepCollapsible({ title, icon, children, defaultOpen = false, accentColor = 'green' }: {
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accentColor?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const borderColor = accentColor === 'green' ? 'border-l-green-500' : accentColor === 'blue' ? 'border-l-blue-500' : accentColor === 'amber' ? 'border-l-amber-500' : accentColor === 'muted' ? 'border-l-muted-foreground/30' : 'border-l-primary';
  const bgColor = accentColor === 'green' ? 'bg-green-50/50 dark:bg-green-950/20' : accentColor === 'blue' ? 'bg-blue-50/50 dark:bg-blue-950/20' : accentColor === 'amber' ? 'bg-amber-50/50 dark:bg-amber-950/20' : accentColor === 'muted' ? 'bg-muted/20' : 'bg-primary/5';

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={`rounded-lg border-l-4 ${borderColor} ${bgColor} overflow-hidden`}>
        <CollapsibleTrigger className="w-full px-3 py-2 flex items-center gap-2 text-left text-xs">
          {isOpen ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
          <span>{icon}</span>
          <span className="font-semibold">{title}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 text-xs">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
