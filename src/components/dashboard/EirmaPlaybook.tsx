import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Lightbulb, AlertTriangle } from 'lucide-react';
import { ObjectionPlaybookEntry, matchObstaclesToPlaybooks, useObjectionPlaybooks } from '@/hooks/useObjectionPlaybooks';

interface EirmaPlaybookProps {
  obstacles: string | null;
  fitnessLevel: number | null;
  emotionalDriver: string | null;
  clientName?: string;
  fitnessGoal?: string | null;
  pastExperience?: string | null;
}

export function EirmaPlaybook({ obstacles, fitnessLevel, emotionalDriver, clientName, fitnessGoal, pastExperience }: EirmaPlaybookProps) {
  const { data: playbooks = [] } = useObjectionPlaybooks();
  const matched = matchObstaclesToPlaybooks(obstacles, playbooks);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showFullScript, setShowFullScript] = useState<Set<string>>(new Set());

  // No early return — let parent control visibility

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleFullScript = (id: string) => {
    setShowFullScript(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const personalize = (text: string) => {
    let result = text;
    if (clientName) result = result.replace(/\[name\]/gi, clientName.split(' ')[0]);
    if (fitnessGoal) result = result.replace(/\[their goal\]/gi, fitnessGoal);
    if (emotionalDriver) result = result.replace(/\[their emotional driver\]/gi, emotionalDriver);
    if (pastExperience) result = result.replace(/\[their past attempt answer\]/gi, pastExperience);
    if (obstacles) result = result.replace(/\[their obstacle\]/gi, obstacles);
    return result;
  };

  if (matched.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold flex items-center gap-1.5 text-amber-700 uppercase tracking-wide">
        <Lightbulb className="w-3.5 h-3.5" />
        Matched Objection Playbooks
      </h3>

      {matched.map((pb, i) => {
        const isFirst = i === 0;
        const isExpanded = isFirst || expandedIds.has(pb.id);
        const showFull = showFullScript.has(pb.id);

        return (
          <Collapsible key={pb.id} open={isExpanded} onOpenChange={() => !isFirst && toggleExpand(pb.id)}>
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 overflow-hidden">
              <CollapsibleTrigger className="w-full px-3 py-2 flex items-center gap-2 text-left">
                {!isFirst && (isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-amber-600" /> : <ChevronRight className="w-3.5 h-3.5 text-amber-600" />)}
                <Badge className="bg-amber-600 text-white text-[10px] border-transparent">
                  {pb.objection_name}
                </Badge>
                <span className="text-xs text-amber-700 font-medium">Likely Objection</span>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="px-3 pb-3 space-y-2 text-xs">
                  <div className="space-y-1.5">
                    <EirmaStep letter="E" label="Empathize" content={personalize(pb.empathize_line)} />
                    <EirmaStep letter="I" label="Isolate" content={personalize(pb.isolate_question)} />
                    <EirmaStep letter="R" label="Redirect" content={personalize(pb.redirect_framework)} />
                    {pb.redirect_discovery_question && (
                      <div className="pl-5 text-amber-700 italic">
                        Discovery: {personalize(pb.redirect_discovery_question)}
                      </div>
                    )}
                    <EirmaStep letter="M" label="Suggest" content={personalize(pb.suggestion_framework)} />
                    <EirmaStep letter="A" label="Ask/Close" content={personalize(pb.ask_line)} />
                  </div>

                  {(fitnessGoal || emotionalDriver || pastExperience) && (
                    <div className="p-2 rounded bg-blue-50 border border-blue-200 text-blue-700">
                      <span className="font-semibold">Remember:</span>{' '}
                      {clientName && `${clientName.split(' ')[0]} `}
                      {fitnessGoal && `said their goal is "${fitnessGoal}"`}
                      {pastExperience && ` and they've tried "${pastExperience}" before`}
                      {emotionalDriver && `. Their emotional why: "${emotionalDriver}"`}
                      . Use this in your redirect.
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-amber-700 hover:text-amber-900 px-1"
                    onClick={(e) => { e.stopPropagation(); toggleFullScript(pb.id); }}
                  >
                    {showFull ? 'Hide' : 'Show'} Full Script
                  </Button>

                  {showFull && (
                    <div className="p-3 rounded bg-white border border-amber-200 text-xs whitespace-pre-wrap leading-relaxed">
                      {personalize(pb.full_script)}
                      {pb.training_notes && (
                        <div className="mt-3 pt-2 border-t border-amber-100">
                          <span className="font-bold text-amber-800">Training Notes:</span>
                          <p className="mt-1 text-amber-700">{pb.training_notes}</p>
                        </div>
                      )}
                      {pb.expert_principles && (
                        <div className="mt-2 pt-2 border-t border-amber-100">
                          <span className="font-bold text-amber-800">Expert Principles:</span>
                          <p className="mt-1 text-amber-700">{pb.expert_principles}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}

      {fitnessLevel && fitnessLevel <= 2 && (
        <div className="text-xs p-2 rounded border border-blue-200 bg-blue-50 text-blue-700">
          <span className="font-medium">Low fitness level ({fitnessLevel}/5):</span> Emphasize modifications, heart-rate zones, and "go at your own pace" messaging.
        </div>
      )}
    </div>
  );
}

/** "I need to think about it" handler — exported so parent can position it */
export function ThinkAboutItHandler() {
  return (
    <div className="text-xs p-2 rounded border border-orange-200 bg-orange-50 text-orange-700 flex items-start gap-1.5">
      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      <div>
        <span className="font-semibold">"I need to think about it"</span> is NEVER the real objection.
        If they say this, ask: <span className="italic">"What specifically do you need to think about?"</span> Then pivot to the matching EIRMA script.
      </div>
    </div>
  );
}

function EirmaStep({ letter, label, content }: { letter: string; label: string; content: string }) {
  return (
    <div className="flex gap-2">
      <span className="font-bold text-amber-800 w-4 shrink-0">{letter}:</span>
      <div>
        <span className="font-semibold text-amber-800">{label}:</span>{' '}
        <span className="text-amber-700">{content}</span>
      </div>
    </div>
  );
}
