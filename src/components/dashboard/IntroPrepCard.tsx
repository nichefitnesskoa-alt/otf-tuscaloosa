import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Copy, ClipboardList, ChevronDown, ChevronRight, HandMetal, BookOpen, MessageSquare, CheckCircle2 } from 'lucide-react';
import { EirmaPlaybook } from './EirmaPlaybook';
import { TransformationClose } from './TransformationClose';

interface IntroPrepCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  classDate: string;
  classTime: string | null;
  coachName: string;
  bookingId: string;
}

interface QData {
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

export function IntroPrepCard({ open, onOpenChange, memberName, classDate, classTime, coachName, bookingId }: IntroPrepCardProps) {
  const [data, setData] = useState<QData | null>(null);

  useEffect(() => {
    if (!open) return;
    supabase
      .from('intro_questionnaires')
      .select('q1_fitness_goal, q2_fitness_level, q3_obstacle, q4_past_experience, q5_emotional_driver, q6_weekly_commitment, q6b_available_days, q7_coach_notes, status' as any)
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data: row }) => setData(row as unknown as QData | null));
  }, [open, bookingId]);

  const firstName = memberName.split(' ')[0];
  const hasQ = data?.status === 'completed';
  const goal = data?.q1_fitness_goal;
  const obstacle = data?.q3_obstacle;
  const emotionalDriver = data?.q5_emotional_driver;
  const commitment = data?.q6_weekly_commitment;

  const copyToClipboard = () => {
    const lines = [
      `CLIENT: ${memberName}`,
      `DATE: ${classDate}${classTime ? ` @ ${classTime.substring(0, 5)}` : ''}`,
      `COACH: ${coachName}`,
    ];
    if (goal) lines.push(`GOAL: ${goal}`);
    if (obstacle) lines.push(`OBSTACLE: ${obstacle}`);
    if (emotionalDriver) lines.push(`EMOTIONAL WHY: ${emotionalDriver}`);
    if (commitment) lines.push(`COMMITMENT: ${commitment}`);
    if (data?.q7_coach_notes) lines.push(`COACH NOTES: ${data.q7_coach_notes}`);

    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Copied to clipboard!');
  };

  const p = (text: string) =>
    text
      .replace(/\[name\]/g, firstName)
      .replace(/\[goal\]/g, goal || '[their goal]')
      .replace(/\[obstacle\]/g, obstacle || '[their obstacle]')
      .replace(/\[commitment\]/g, commitment || '[their commitment]')
      .replace(/\[coach\]/g, coachName || '[coach]');

  const Placeholder = ({ text }: { text: string }) => (
    <span className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 px-1 rounded text-[10px] font-medium">{text}</span>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-xl">{memberName}</SheetTitle>
          <div className="text-sm text-muted-foreground">
            {classDate}{classTime ? ` @ ${classTime.substring(0, 5)}` : ''} · Coach: {coachName}
          </div>
        </SheetHeader>

        <Tabs defaultValue="prep" className="mt-2">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="prep" className="text-xs">Prep</TabsTrigger>
            <TabsTrigger value="close" className="text-xs">The Close</TabsTrigger>
            <TabsTrigger value="objections" className="text-xs">Objections</TabsTrigger>
          </TabsList>

          {/* TAB 1: Prep + Pre-Class */}
          <TabsContent value="prep" className="space-y-3 mt-3">
            {hasQ ? (
              <div className="rounded-lg p-3 text-xs space-y-1.5 border-l-4 border-l-primary bg-primary/5">
                <PrepRow label="Goal" value={goal} />
                <PrepRow label="Level" value={data.q2_fitness_level ? `${data.q2_fitness_level}/5` : null} />
                <PrepRow label="Past Fitness" value={data.q4_past_experience} />
                <PrepRow label="Obstacle" value={obstacle} />
                <PrepRow label="Why" value={emotionalDriver} />
                <PrepRow label="Commitment" value={commitment} />
                {data.q7_coach_notes && <PrepRow label="Coach Notes" value={data.q7_coach_notes} />}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground italic flex items-center gap-1">
                <ClipboardList className="w-3 h-3" />
                {data ? 'Questionnaire not completed yet' : 'No questionnaire on file'}
              </div>
            )}

            <Button onClick={copyToClipboard} className="w-full" variant="outline" size="sm">
              <Copy className="w-4 h-4 mr-2" />
              Copy to Clipboard
            </Button>

            {/* SA Mental Framework */}
            <div className="rounded-lg p-3 text-xs border border-muted bg-muted/30 space-y-1">
              <p className="font-bold uppercase tracking-wide text-muted-foreground text-[10px]">🧠 SA Mindset</p>
              <p className="leading-relaxed">You are not selling a membership. You are helping someone become the person they told you they want to be. Your job is to connect every moment of this visit back to their goal.</p>
            </div>

            {/* Pre-Class Scripts Section */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-green-700 dark:text-green-400">📋 Pre-Class Scripts</p>

              <PrepCollapsible title="Greeting + Q Acknowledgment" icon="👋" defaultOpen accentColor="green">
                <p className="leading-relaxed">
                  {p(`"Hey [name]! Welcome to Orangetheory. I'm so glad you're here. I read through your questionnaire — you said you want to [goal], and I love that. Today's class is going to be a great first step toward that. Let me walk you through what to expect."`)}
                </p>
                {!hasQ && (
                  <div className="mt-1.5">
                    <Placeholder text="Questionnaire not completed — use a general greeting and ask about their goal in person" />
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

          {/* TAB 2: The Close (full post-class flow) */}
          <TabsContent value="close" className="mt-3">
            {hasQ ? (
              <TransformationClose
                clientName={memberName}
                coachName={coachName}
                fitnessGoal={goal}
                obstacle={obstacle}
                pastExperience={data.q4_past_experience}
                emotionalDriver={emotionalDriver}
                weeklyCommitment={commitment}
                availableDays={data.q6b_available_days}
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
                fitnessLevel={data.q2_fitness_level}
                emotionalDriver={emotionalDriver}
                clientName={memberName}
                fitnessGoal={goal}
                pastExperience={data.q4_past_experience}
              />
            ) : (
              <div className="text-xs text-muted-foreground italic flex items-center gap-1 py-4">
                <ClipboardList className="w-3 h-3" />
                Complete the questionnaire to see matched objection playbooks.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function PrepRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2">
      <span className="font-bold text-muted-foreground w-24 shrink-0">{label.toUpperCase()}:</span>
      <span>{value || '—'}</span>
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
