import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

interface TransformationCloseProps {
  clientName: string;
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
  fitnessGoal,
  obstacle,
  pastExperience,
  emotionalDriver,
  weeklyCommitment,
  availableDays,
}: TransformationCloseProps) {
  const firstName = clientName.split(' ')[0];

  const sections = [
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
      note: 'Wait for their answer. Do not rush.',
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
      note: 'Pause. Let them answer.',
      highlight: true,
    },
    {
      title: 'Pricing Walkthrough',
      content: '',
      isPricing: true,
      highlight: false,
    },
  ];

  const copyFullScript = () => {
    const lines: string[] = [];
    sections.forEach(s => {
      if (s.isPricing) {
        lines.push(`--- ${s.title} ---`);
        lines.push('TO BUILD: Pricing/flexibility visual slide. For now, cover these points:');
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
              <p className="text-[10px] text-warning font-medium">TO BUILD: Pricing/flexibility visual slide. For now, cover these points conversationally.</p>
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
              s.highlight
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

      <Button onClick={copyFullScript} className="w-full" variant="outline">
        <Copy className="w-4 h-4 mr-2" />
        Copy Full Script
      </Button>
    </div>
  );
}
