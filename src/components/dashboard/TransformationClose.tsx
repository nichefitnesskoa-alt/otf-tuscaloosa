import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Copy, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface TransformationCloseProps {
  clientName: string;
  coachName?: string;
  fitnessGoal: string | null;
  obstacle: string | null;
  pastExperience: string | null;
  emotionalDriver: string | null;
  weeklyCommitment: string | null;
  availableDays: string | null;
}

const OBSTACLE_CONNECTORS: { keywords: string[]; response: string }[] = [
  {
    keywords: ['dont know', "don't know", 'structure', 'what to do'],
    response: 'You just did a 50-minute workout that was completely structured for you. The coach told you exactly what to do. You didnt have to think about it.',
  },
  {
    keywords: ['havent found', "haven't found", 'right gym', 'fits'],
    response: 'You just experienced what this gym is. Does it fit?',
  },
  {
    keywords: ['tried before', 'nothing stuck', 'something new', 'tried everything'],
    response: "Most gyms, you walk in, you are on your own. You dont know what to do. You get bored. You stop going. What you just did? A coach told you exactly what to do. You didnt have to think.",
  },
  {
    keywords: ['cost', 'budget', 'expensive', 'afford', 'price', 'money'],
    response: 'Let me show you something. [Transition to pricing comparison]',
  },
  {
    keywords: ['time', 'busy', 'schedule'],
    response: 'The class is 50 minutes. You showed up, did the workout, and you are done.',
  },
  {
    keywords: ['stress', 'mental health', 'anxiety', 'overwhelmed'],
    response: 'You walked in here stressed. How is your stress level right now compared to an hour ago?',
  },
];

function getObstacleConnector(obstacle: string | null): string {
  if (!obstacle) return '';
  const lower = obstacle.toLowerCase();
  for (const entry of OBSTACLE_CONNECTORS) {
    if (entry.keywords.some(k => lower.includes(k))) return entry.response;
  }
  return `You said ${obstacle} was stopping you. You just proved that it doesnt have to.`;
}

export function TransformationClose({
  clientName,
  coachName,
  fitnessGoal,
  obstacle,
  pastExperience,
  emotionalDriver,
  weeklyCommitment,
  availableDays,
}: TransformationCloseProps) {
  const firstName = clientName.split(' ')[0];
  const coach = coachName || 'Coach';
  const [enrollmentChecks, setEnrollmentChecks] = useState<Set<number>>(new Set());

  const toggleCheck = (i: number) => {
    setEnrollmentChecks(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const sections = [
    {
      title: 'Coach Handoff',
      content: `${coach} says to you in front of ${firstName}: "${firstName} crushed it. She said she wanted to ${fitnessGoal || '[their goal]'}. Based on what I saw today, if she comes ${weeklyCommitment || '3 times'} a week, she is absolutely going to hit that. I would love to see her in my next class."`,
      note: `SA: Let the coach speak first. This builds third-party credibility. Then transition: "See? ${coach} already has a plan for you. Let me ask you something..."`,
      highlight: false,
      isCoachHandoff: true,
    },
    {
      title: 'Questionnaire Reference',
      content: `You said your goal is ${fitnessGoal || '[their goal]'}. You said your biggest obstacle is ${obstacle || '[their obstacle]'}. And emotionally, you said you want to ${emotionalDriver || '[their emotional driver]'}.`,
      highlight: false,
    },
    {
      title: 'Accusation Audit',
      content: `Now I know what you are probably thinking right now. This is where the sales pitch starts. I am about to pressure you into buying something you cant afford. Its gonna be way more expensive than you thought. You are going to get locked into some contract you cant get out of. If you say no its going to be awkward. I am not going to let you leave without signing up. And honestly, you probably think this is just going to be like the other times you have tried.`,
      highlight: false,
    },
    {
      title: 'Past Experience Bridge',
      content: `I totally get it. You said you have ${pastExperience || '[their past experience]'}. That makes sense. BUT.`,
      highlight: false,
    },
    {
      title: 'The Question',
      content: `How do you feel RIGHT NOW compared to how you felt when you walked in?`,
      note: 'Wait for their answer. Do not rush. Let them feel the difference.',
      highlight: true,
    },
    {
      title: 'Obstacle Connector',
      content: getObstacleConnector(obstacle),
      highlight: false,
    },
    {
      title: 'Identity Close',
      content: `What I am offering you is the chance to feel like you feel RIGHT NOW, ${emotionalDriver || '[their emotional driver]'}, ${weeklyCommitment || '[their commitment]'} for the next four years. So the real question is: do you want to feel like the person you are right now, or do you want to go back to feeling like the person who filled out that questionnaire an hour ago? Which one do you want to be?`,
      note: 'Pause. Let them answer. Do not fill the silence.',
      highlight: true,
    },
    {
      title: 'Pricing Walkthrough',
      content: '',
      isPricing: true,
      highlight: false,
    },
  ];

  const enrollmentSteps = [
    `Book ${firstName}'s first week of classes (${weeklyCommitment || '3 sessions'})${availableDays ? ` on ${availableDays}` : ''}`,
    `Introduce to the next coach on schedule: "Coach, this is ${firstName}. She just joined. Her goal is ${fitnessGoal || 'to get in shape'}."`,
    `Plant the referral seed: "Who's the one person in your life who would love this? Bring them to your next class — their first one is on us."`,
    `Confirm communication preferences: "I'll send you a text before your next class as a reminder. What's the best number?"`,
    `Set month-1 expectations: "In your first month, focus on showing up. Don't worry about the weights or the speeds. Just get here ${weeklyCommitment || '3 times'} a week. The results will follow."`,
  ];

  const copyFullScript = () => {
    const lines: string[] = [];
    sections.forEach(s => {
      if (s.isPricing) {
        lines.push(`--- ${s.title} ---`);
        lines.push('Cover these points:');
        lines.push('• Freeze for summer/breaks at no charge');
        lines.push('• Works at 1,300+ studios nationwide');
        lines.push('• Locking in Tuscaloosa pricing');
        lines.push('• Referral credits toward membership');
        lines.push('• No annual contract, month to month');
        lines.push('• Switch between Elite and Premier anytime');
        lines.push('• Elite: $92/mo for 8 classes. Premier: $143/mo unlimited.');
      } else {
        lines.push(`--- ${s.title} ---`);
        lines.push(s.content);
        if (s.note) lines.push(`[${s.note}]`);
      }
      lines.push('');
    });
    lines.push('--- After Enrollment ---');
    enrollmentSteps.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Full script copied!');
  };

  return (
    <div className="space-y-3 pb-4">
      {sections.map((s, i) => {
        if (s.isPricing) {
          return (
            <div key={i} className="rounded-lg border border-muted p-3 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{s.title}</p>
              <ul className="text-xs space-y-1 list-disc pl-4 text-muted-foreground">
                <li>Freeze for summer/breaks at no charge</li>
                <li>Works at 1,300+ studios nationwide</li>
                <li>Locking in Tuscaloosa pricing</li>
                <li>Referral credits toward membership</li>
                <li>No annual contract, month to month</li>
                <li>Switch between Elite and Premier anytime</li>
                <li><span className="font-medium text-foreground">Elite: $92/mo</span> for 8 classes · <span className="font-medium text-foreground">Premier: $143/mo</span> unlimited</li>
              </ul>
            </div>
          );
        }

        return (
          <div
            key={i}
            className={`rounded-lg p-3 text-xs ${
              s.isCoachHandoff
                ? 'border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                : s.highlight
                  ? 'border-l-4 border-l-primary bg-primary/5'
                  : 'border border-muted'
            }`}
          >
            <p className="font-bold uppercase tracking-wide text-muted-foreground text-[10px] mb-1">{s.title}</p>
            <p className={`leading-relaxed ${s.highlight ? 'text-sm font-medium' : ''}`}>
              {s.content}
            </p>
            {s.note && (
              <p className="mt-2 text-[10px] italic text-muted-foreground bg-muted/50 rounded px-2 py-1">
                ⏸ {s.note}
              </p>
            )}
          </div>
        );
      })}

      {/* After Enrollment Checklist */}
      <AfterEnrollmentChecklist
        steps={enrollmentSteps}
        checks={enrollmentChecks}
        onToggle={toggleCheck}
      />

      <Button onClick={copyFullScript} className="w-full" variant="outline">
        <Copy className="w-4 h-4 mr-2" />
        Copy Full Script
      </Button>
    </div>
  );
}

function AfterEnrollmentChecklist({ steps, checks, onToggle }: {
  steps: string[];
  checks: Set<number>;
  onToggle: (i: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-950/20 overflow-hidden">
        <CollapsibleTrigger className="w-full px-3 py-2 flex items-center gap-2 text-left text-xs">
          {isOpen ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
          <span className="font-semibold">After Enrollment Checklist</span>
          <span className="ml-auto text-[10px] text-muted-foreground">{checks.size}/{steps.length}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-2">
            {steps.map((step, i) => (
              <label key={i} className="flex items-start gap-2 text-xs cursor-pointer" onClick={() => onToggle(i)}>
                <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  checks.has(i) ? 'bg-green-600 border-green-600 text-white' : 'border-muted-foreground/30'
                }`}>
                  {checks.has(i) && <CheckCircle2 className="w-3 h-3" />}
                </div>
                <span className={checks.has(i) ? 'line-through text-muted-foreground' : ''}>{step}</span>
              </label>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
