import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Copy, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { matchObstaclesToPlaybooks, useObjectionPlaybooks, ObjectionPlaybookEntry } from '@/hooks/useObjectionPlaybooks';

interface HumanizedEirmaProps {
  obstacles: string | null;
  fitnessLevel: number | null;
  emotionalDriver: string | null;
  clientName?: string;
  fitnessGoal?: string | null;
  pastExperience?: string | null;
}

// Human-friendly objection titles
const HUMAN_TITLES: Record<string, string> = {
  'pricing': "If they say it's too expensive",
  'price': "If they say it's too expensive",
  'time': "If they say they don't have time",
  'spouse': "If they need to talk to their spouse",
  'think about it': "If they say they need to think about it",
  'not sure': "If they're not sure it's for them",
  'motivation': "If they're worried they won't stick with it",
  'intimidation': "If they feel intimidated",
  'contract': "If they're worried about a contract",
};

function getHumanTitle(objectionName: string): string {
  const lower = objectionName.toLowerCase();
  for (const [key, title] of Object.entries(HUMAN_TITLES)) {
    if (lower.includes(key)) return title;
  }
  return `If they say "${objectionName}"`;
}

interface HumanizedEirmaProps {
  obstacles: string | null;
  fitnessLevel: number | null;
  emotionalDriver: string | null;
  clientName?: string;
  fitnessGoal?: string | null;
  pastExperience?: string | null;
  weeklyCommitment?: string | null;
}

function getMembershipRecommendation(commitment: string | null): string {
  if (!commitment) return 'Elite + OTbeat';
  if (commitment.includes('5+')) return 'Premier + OTbeat';
  if (commitment.includes('3') || commitment.includes('4')) return 'Elite + OTbeat';
  return 'Basic + OTbeat';
}

export function HumanizedEirma({ obstacles, fitnessLevel, emotionalDriver, clientName, fitnessGoal, pastExperience, weeklyCommitment }: HumanizedEirmaProps) {
  const { data: playbooks = [] } = useObjectionPlaybooks();
  const matched = matchObstaclesToPlaybooks(obstacles, playbooks);
  const matchedIds = new Set(matched.map(m => m.id));
  const unmatched = playbooks.filter(pb => !matchedIds.has(pb.id));

  const firstName = clientName?.split(' ')[0] || 'them';
  const recommendedTier = getMembershipRecommendation(weeklyCommitment || null);

  const personalize = (text: string) => {
    let result = text;
    if (clientName) result = result.replace(/\[name\]/gi, firstName);
    if (fitnessGoal) result = result.replace(/\[their goal\]/gi, fitnessGoal);
    if (emotionalDriver) result = result.replace(/\[their emotional driver\]/gi, emotionalDriver);
    if (pastExperience) result = result.replace(/\[their past attempt answer\]/gi, pastExperience);
    if (obstacles) result = result.replace(/\[their obstacle\]/gi, obstacles);
    return result;
  };

  // No-obstacle fallback: show a goal-anchored default EIRMA
  if (matched.length === 0 && fitnessGoal) {
    const shortGoal = fitnessGoal.split('|')[0].trim().toLowerCase();
    const shortWhy = emotionalDriver ? emotionalDriver.split('|')[0].trim().toLowerCase() : null;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-amber-600" />
          <h3 className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">Close Framework</h3>
        </div>
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">Goal-Anchored Close</p>
          {[
            { step: 'E — Empathize', line: `"I can see how much ${shortGoal} means to you."` },
            { step: 'I — Isolate', line: `"Is there anything else holding you back, or is it just making sure this is the right fit?"` },
            { step: 'R — Redirect', line: `"That's exactly why this works — ${shortWhy ? 'because you want ' + shortWhy : "it\u2019s built around your goal"}."` },
            { step: `M — Suggest`, line: `"Based on what you told me, I'd recommend ${recommendedTier}. It fits your schedule."` },
            { step: 'A — Ask', line: `"Let's get you started today. Which works better — paying now or setting up monthly?"` },
          ].map((s, i) => (
            <div key={i} className="space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">{s.step}</p>
              <p className="text-sm text-foreground leading-relaxed">{s.line}</p>
            </div>
          ))}
        </div>
        {fitnessLevel != null && fitnessLevel <= 2 && (
          <div className="text-xs p-2 rounded border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 text-blue-700 dark:text-blue-300">
            <span className="font-medium">Low fitness level ({fitnessLevel}/5):</span> Emphasize modifications, heart-rate zones, and "go at your own pace" messaging.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-amber-600" />
        <h3 className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">Objection Handling</h3>
      </div>

      {matched.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">Likely Objections (from Q)</p>
          {matched.map((pb, i) => (
            <ObjectionCard
              key={pb.id}
              pb={pb}
              personalize={personalize}
              firstName={firstName}
              fitnessGoal={fitnessGoal}
              emotionalDriver={emotionalDriver}
              recommendedTier={recommendedTier}
              defaultOpen={i === 0}
            />
          ))}
        </div>
      )}

      {unmatched.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Other Objections</p>
          {unmatched.map(pb => (
            <ObjectionCard
              key={pb.id}
              pb={pb}
              personalize={personalize}
              firstName={firstName}
              fitnessGoal={fitnessGoal}
              emotionalDriver={emotionalDriver}
              recommendedTier={recommendedTier}
            />
          ))}
        </div>
      )}

      {fitnessLevel != null && fitnessLevel <= 2 && (
        <div className="text-xs p-2 rounded border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 text-blue-700 dark:text-blue-300">
          <span className="font-medium">Low fitness level ({fitnessLevel}/5):</span> Emphasize modifications, heart-rate zones, and "go at your own pace" messaging.
        </div>
      )}
    </div>
  );
}

function ObjectionCard({
  pb,
  personalize,
  firstName,
  fitnessGoal,
  emotionalDriver,
  recommendedTier,
  defaultOpen = false,
}: {
  pb: ObjectionPlaybookEntry;
  personalize: (t: string) => string;
  firstName: string;
  fitnessGoal?: string | null;
  emotionalDriver?: string | null;
  recommendedTier?: string;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const steps = [
    { step: 'E — Empathize', content: personalize(pb.empathize_line) },
    { step: 'I — Isolate', content: personalize(pb.isolate_question) },
    { step: 'R — Redirect', content: personalize(pb.redirect_framework) },
    { step: 'M — Suggest', content: `Based on what ${firstName} said, I'd recommend ${recommendedTier || 'Elite + OTbeat'}. It fits their schedule.` },
    { step: 'A — Ask', content: personalize(pb.ask_line) },
  ];

  const copyScript = () => {
    const text = steps.map(s => `${s.step}:\n"${s.content}"`).join('\n\n');
    navigator.clipboard.writeText(text);
    toast.success('Script copied!');
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
        <CollapsibleTrigger className="w-full px-3 py-2.5 flex items-center gap-2 text-left">
          {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-amber-600 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
          <span className="text-sm font-medium text-amber-900 dark:text-amber-200">
            {getHumanTitle(pb.objection_name)}
          </span>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-3">
            {steps.map((s, i) => (
              <div key={i} className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                  {s.step}
                </p>
                <div className="rounded-md bg-white dark:bg-background border border-amber-100 dark:border-amber-900 px-3 py-2">
                  <p className="text-sm text-foreground leading-relaxed">
                    "{s.content}"
                  </p>
                </div>
              </div>
            ))}

            {pb.redirect_discovery_question && (
              <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 px-3 py-2">
                <p className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 mb-0.5">Discovery Question</p>
                <p className="text-xs text-blue-800 dark:text-blue-200 italic">"{personalize(pb.redirect_discovery_question)}"</p>
              </div>
            )}

            {/* Remember callout */}
            {(fitnessGoal || emotionalDriver) && (
              <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs">
                <span className="font-semibold">Remember:</span>{' '}
                {firstName}'s goal: "{fitnessGoal || '—'}".
                {emotionalDriver && ` Their emotional why: "${emotionalDriver}".`}
                {' '}Use this.
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-amber-700 hover:text-amber-900 dark:text-amber-400 gap-1.5"
              onClick={(e) => { e.stopPropagation(); copyScript(); }}
            >
              <Copy className="w-3 h-3" />
              Copy Script
            </Button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
