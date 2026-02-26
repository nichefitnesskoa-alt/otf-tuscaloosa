/**
 * CoachDrawer – Two-section coach handoff tool.
 * Section 1: IN-CLASS ACTIONS — generated from fitness level + goal
 * Section 2: EXPERIENCE ENHANCERS — suggested lines from questionnaire data
 */
import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dumbbell, ClipboardList } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CoachDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  bookingId: string;
  classTime: string | null;
  coachName: string;
}

interface QData {
  q1_fitness_goal: string | null;
  q2_fitness_level: number | null;
  q3_obstacle: string | null;
  q5_emotional_driver: string | null;
  q6_weekly_commitment: string | null;
  q7_coach_notes: string | null;
  status: string;
}

function getInClassActions(level: number | null, goal: string | null): string[] {
  const actions: string[] = [];
  const l = level ?? 2;

  if (l <= 2) {
    actions.push('Keep them on the treads at base pace — don\'t push to push pace until they ask');
    actions.push('Watch their form on the rower — first-timers usually need cues on handle height and drive sequence');
    actions.push('Check in at the 20-minute mark: "How are you feeling? You\'re doing amazing"');
  } else if (l <= 3) {
    actions.push('Let them find their own base/push rhythm — gentle nudges only');
    actions.push('On the floor, demonstrate modifications but encourage them to try the standard first');
    actions.push('Check in at transitions: "You\'re keeping up great — this is exactly where you should be"');
  } else {
    actions.push('Challenge them — they can handle push pace and all-outs');
    actions.push('On the floor, show progressions for advanced modifications');
    actions.push('Keep the energy high: "You clearly know what you\'re doing — let\'s see what you\'ve got"');
  }

  if (goal) {
    const g = goal.toLowerCase();
    if (g.includes('weight') || g.includes('lose') || g.includes('fat')) {
      actions.push('During tread block: "This is exactly how you burn — stay in the orange zone"');
    } else if (g.includes('strength') || g.includes('muscle') || g.includes('tone')) {
      actions.push('During floor block: "This is where you build the strength you\'re looking for"');
    } else if (g.includes('energy') || g.includes('stress') || g.includes('mental')) {
      actions.push('Mid-class: "Notice how different you feel already? That\'s what consistency does"');
    }
  }

  return actions.slice(0, 4);
}

function getExperienceEnhancers(goal: string | null, why: string | null, name: string): string[] {
  const firstName = name.split(' ')[0];
  const enhancers: string[] = [];

  if (goal) {
    enhancers.push(`"${firstName}, I can already see you crushing your goal when you're consistent — you've got this"`);
  }
  if (why) {
    enhancers.push(`Reference their why naturally: "${firstName} mentioned ${why.toLowerCase().substring(0, 50)} — tie that to a moment in class"`);
  }
  if (!goal && !why) {
    enhancers.push(`"${firstName}, you did great today — I'd love to see you back for your next class"`);
    enhancers.push(`Ask about their experience: "What was your favorite part of the workout?"`);
  }

  return enhancers.slice(0, 2);
}

export function CoachDrawer({ open, onOpenChange, memberName, bookingId, classTime, coachName }: CoachDrawerProps) {
  const [data, setData] = useState<QData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from('intro_questionnaires')
      .select('q1_fitness_goal, q2_fitness_level, q3_obstacle, q5_emotional_driver, q6_weekly_commitment, q7_coach_notes, status' as any)
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .then(({ data: rows }) => {
        const all = (rows || []) as unknown as QData[];
        const completed = all.find(q => q.status === 'completed' || q.status === 'submitted');
        setData(completed || all[0] || null);
        setLoading(false);
      });
  }, [open, bookingId]);

  const hasQ = data?.status === 'completed' || data?.status === 'submitted';
  const inClassActions = getInClassActions(data?.q2_fitness_level ?? null, data?.q1_fitness_goal ?? null);
  const experienceEnhancers = getExperienceEnhancers(data?.q1_fitness_goal ?? null, data?.q5_emotional_driver ?? null, memberName);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <SheetHeader className="p-4 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Dumbbell className="w-5 h-5 text-blue-600" />
            Coach Handoff: {memberName}
          </SheetTitle>
          <SheetDescription className="sr-only">Coach preparation info</SheetDescription>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {classTime && <span>{classTime.substring(0, 5)}</span>}
            {coachName && <span>· Coach: {coachName}</span>}
          </div>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="p-4 space-y-4">
            {loading ? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            ) : (
              <>
                {/* Quick summary */}
                {hasQ && (
                  <div className="rounded-lg p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-xs space-y-1">
                    <div className="flex gap-2"><span className="font-bold text-blue-800 dark:text-blue-300 w-14">Goal:</span><span>{data?.q1_fitness_goal || '—'}</span></div>
                    <div className="flex gap-2"><span className="font-bold text-blue-800 dark:text-blue-300 w-14">Level:</span><span>{data?.q2_fitness_level ? `${data.q2_fitness_level}/5` : '—'}</span></div>
                    {data?.q7_coach_notes && <div className="flex gap-2"><span className="font-bold text-blue-800 dark:text-blue-300 w-14">Notes:</span><span>{data.q7_coach_notes}</span></div>}
                  </div>
                )}

                {!hasQ && (
                  <div className="text-xs text-muted-foreground italic flex items-center gap-1 py-2">
                    <ClipboardList className="w-3.5 h-3.5" />
                    No questionnaire on file — using default coaching actions.
                  </div>
                )}

                {/* IN-CLASS ACTIONS */}
                <div className="rounded-lg border overflow-hidden">
                  <div className="px-3 py-2 bg-blue-100/50 dark:bg-blue-950/30">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-blue-800 dark:text-blue-300">In-Class Actions</p>
                    <p className="text-[10px] text-blue-600 dark:text-blue-400">What the coach should do during class</p>
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

                {/* EXPERIENCE ENHANCERS */}
                <div className="rounded-lg border overflow-hidden">
                  <div className="px-3 py-2 bg-emerald-100/50 dark:bg-emerald-950/30">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">Experience Enhancers</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Things the coach could say to make them feel seen</p>
                  </div>
                  <div className="p-3 space-y-2">
                    {experienceEnhancers.map((line, i) => (
                      <div key={i} className="flex gap-2 text-xs">
                        <span className="text-emerald-600 mt-0.5">💬</span>
                        <span className="italic">{line}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
