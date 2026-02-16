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
import { isMembershipSale } from '@/lib/sales-detection';
import {
  User, Calendar, Target, ClipboardList, DollarSign, Phone, Mail,
  MessageSquare, FileText, Copy, History, ChevronDown, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { EirmaPlaybook } from './EirmaPlaybook';
import { TransformationClose } from './TransformationClose';
import { IntroTypeBadge, LeadSourceTag } from './IntroTypeBadge';
import { FollowUpStatusBadge } from './FollowUpStatusBadge';

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

export function PrepDrawer({
  open, onOpenChange, memberName, memberKey, bookingId, classDate, classTime,
  coachName, leadSource, isSecondIntro, phone, email, bookings, runs,
  onGenerateScript, onSendQ,
}: PrepDrawerProps) {
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireData | null>(null);
  const [sendLogs, setSendLogs] = useState<SendLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

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
        .select('q1_fitness_goal, q2_fitness_level, q3_obstacle, q4_past_experience, q5_emotional_driver, q6_weekly_commitment, q6b_available_days, q7_coach_notes, status' as any)
        .in('booking_id', bookingIds)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('script_send_log')
        .select('id, sent_at, sent_by, message_body_sent')
        .in('booking_id', bookingIds)
        .order('sent_at', { ascending: false })
        .limit(20),
    ]).then(([qRes, logRes]) => {
      setQuestionnaire(qRes.data as unknown as QuestionnaireData | null);
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

  const firstName = memberName.split(' ')[0];
  const hasQ = questionnaire?.status === 'completed';
  const goal = questionnaire?.q1_fitness_goal;
  const obstacle = questionnaire?.q3_obstacle;
  const emotionalDriver = questionnaire?.q5_emotional_driver;
  const commitment = questionnaire?.q6_weekly_commitment;

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
                <InfoRow icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={email} />
              )}
            </div>

            {/* Tabbed Prep Content */}
            <Tabs defaultValue="prep" className="w-full">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="prep" className="text-xs">Prep</TabsTrigger>
                <TabsTrigger value="close" className="text-xs">The Close</TabsTrigger>
                <TabsTrigger value="objections" className="text-xs">Objections</TabsTrigger>
              </TabsList>

              {/* TAB 1: Prep + Pre-Class */}
              <TabsContent value="prep" className="space-y-3 mt-3">
                {loading ? (
                  <p className="text-xs text-muted-foreground">Loading...</p>
                ) : hasQ ? (
                  <div className="rounded-lg p-3 text-xs space-y-2 border-l-4 border-l-primary bg-primary/5">
                    <QRow label="What is your fitness goal?" value={goal} />
                    <QRow label="Current fitness level (1-5)" value={questionnaire.q2_fitness_level ? `${questionnaire.q2_fitness_level}/5` : null} />
                    <QRow label="Biggest obstacle?" value={obstacle} />
                    <QRow label="What have you tried before?" value={questionnaire.q4_past_experience} />
                    <QRow label="What would reaching your goal mean to you?" value={emotionalDriver} />
                    <QRow label="Days per week you can commit?" value={commitment} />
                    <QRow label="Which days work best?" value={questionnaire.q6b_available_days} />
                    {questionnaire.q7_coach_notes && (
                      <QRow label="Coach notes" value={questionnaire.q7_coach_notes} />
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground italic flex items-center gap-2 p-2 rounded border">
                    <ClipboardList className="w-3.5 h-3.5" />
                    {questionnaire ? `Questionnaire ${questionnaire.status === 'sent' ? 'sent but not completed' : 'not yet sent'}` : 'No questionnaire on file'}
                    {onSendQ && (!questionnaire || questionnaire.status === 'not_sent') && (
                      <Button variant="outline" size="sm" className="h-6 text-[10px] ml-auto" onClick={onSendQ}>
                        Send Q
                      </Button>
                    )}
                  </div>
                )}

                {/* SA Mindset */}
                <div className="rounded-lg p-3 text-xs border border-muted bg-muted/30 space-y-1">
                  <p className="font-bold uppercase tracking-wide text-muted-foreground text-[10px]">🧠 SA Mindset</p>
                  <p className="leading-relaxed">You are not selling a membership. You are helping someone become the person they told you they want to be. Your job is to connect every moment of this visit back to their goal.</p>
                </div>

                {/* Pre-Class Scripts */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-green-700 dark:text-green-400">📋 Pre-Class Scripts</p>

                  <PrepCollapsible title="Greeting + Q Acknowledgment" icon="👋" defaultOpen accentColor="green">
                    <p className="leading-relaxed">
                      {p(`"Hey [name]! Welcome to Orangetheory. I'm so glad you're here. I read through your questionnaire — you said you want to [goal], and I love that. Today's class is going to be a great first step toward that. Let me walk you through what to expect."`)}
                    </p>
                    {!hasQ && (
                      <div className="mt-1.5">
                        <span className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 px-1 rounded text-[10px] font-medium">
                          Questionnaire not completed — use a general greeting and ask about their goal in person
                        </span>
                      </div>
                    )}
                  </PrepCollapsible>

                  <PrepCollapsible title="Flipbook Talking Points" icon="📖" accentColor="green">
                    <ul className="space-y-1 list-disc pl-4">
                      <li><span className="font-medium">Heart Rate Zones:</span> "We use a heart rate monitor so you can see your effort in real time. You'll aim for the Orange Zone — that's where the magic happens."</li>
                      <li><span className="font-medium">Coaching:</span> "There's a coach leading the entire class. They'll tell you every move, every transition. You don't have to figure anything out."</li>
                      <li><span className="font-medium">Afterburn:</span> "The workout is designed so you keep burning calories for up to 36 hours after class. It's called the afterburn effect."</li>
                      <li><span className="font-medium">Community:</span> "Everyone in that room was a first-timer once. This is one of the most supportive workout communities you'll find."</li>
                    </ul>
                  </PrepCollapsible>

                  <PrepCollapsible title="Set Expectations" icon="⏱️" accentColor="green">
                    <p className="leading-relaxed">
                      {p(`"After class, we'll sit down for about 5-10 minutes. I'll ask you how you felt, and if it's a fit, I'll show you how to keep this going. No pressure, no awkward pitch. Sound good?"`)}
                    </p>
                  </PrepCollapsible>

                  <PrepCollapsible title="Mid-Class Check-In" icon="💪" accentColor="green">
                    <p className="leading-relaxed">
                      {p(`Walk into the studio at the ~25 minute mark. Make eye contact with [name], give a thumbs up or a quick "You're crushing it!" This creates a bond and shows you are invested in their experience.`)}
                    </p>
                    <p className="mt-1.5 text-muted-foreground italic">
                      Tip: Note which station they're at and what they're doing well — use this in the post-class sit-down.
                    </p>
                  </PrepCollapsible>
                </div>
              </TabsContent>

              {/* TAB 2: The Close */}
              <TabsContent value="close" className="mt-3">
                {hasQ ? (
                  <TransformationClose
                    clientName={memberName}
                    coachName={coachName}
                    fitnessGoal={goal}
                    obstacle={obstacle}
                    pastExperience={questionnaire.q4_past_experience}
                    emotionalDriver={emotionalDriver}
                    weeklyCommitment={commitment}
                    availableDays={questionnaire.q6b_available_days}
                  />
                ) : (
                  <div className="text-xs text-muted-foreground italic flex items-center gap-1 py-4">
                    <ClipboardList className="w-3 h-3" />
                    Complete the questionnaire to generate a personalized close script.
                  </div>
                )}
              </TabsContent>

              {/* TAB 3: Objections */}
              <TabsContent value="objections" className="mt-3">
                {hasQ ? (
                  <EirmaPlaybook
                    obstacles={obstacle}
                    fitnessLevel={questionnaire.q2_fitness_level}
                    emotionalDriver={emotionalDriver}
                    clientName={memberName}
                    fitnessGoal={goal}
                    pastExperience={questionnaire.q4_past_experience}
                  />
                ) : (
                  <div className="text-xs text-muted-foreground italic flex items-center gap-1 py-4">
                    <ClipboardList className="w-3 h-3" />
                    Complete the questionnaire to see matched objection playbooks.
                  </div>
                )}
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
    </Sheet>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground w-16">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function QRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="font-semibold text-muted-foreground">{label}</p>
      <p className="mt-0.5">{value || '—'}</p>
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

  const borderColor = accentColor === 'green' ? 'border-l-green-500' : accentColor === 'blue' ? 'border-l-blue-500' : 'border-l-primary';
  const bgColor = accentColor === 'green' ? 'bg-green-50/50 dark:bg-green-950/20' : accentColor === 'blue' ? 'bg-blue-50/50 dark:bg-blue-950/20' : 'bg-primary/5';

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
