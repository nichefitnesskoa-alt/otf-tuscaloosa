/**
 * CoachDrawer – Simple drawer showing coach-relevant info for a booking.
 * Surfaces questionnaire data (goal, obstacle, commitment) plus handoff script.
 * Blue accent color per design system for coach-specific UI.
 */
import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dumbbell, Copy, ClipboardList } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  q3_obstacle: string | null;
  q5_emotional_driver: string | null;
  q6_weekly_commitment: string | null;
  q7_coach_notes: string | null;
  status: string;
}

export function CoachDrawer({ open, onOpenChange, memberName, bookingId, classTime, coachName }: CoachDrawerProps) {
  const [data, setData] = useState<QData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from('intro_questionnaires')
      .select('q1_fitness_goal, q3_obstacle, q5_emotional_driver, q6_weekly_commitment, q7_coach_notes, status' as any)
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .then(({ data: rows }) => {
        const all = (rows || []) as unknown as QData[];
        const completed = all.find(q => q.status === 'completed' || q.status === 'submitted');
        setData(completed || all[0] || null);
        setLoading(false);
      });
  }, [open, bookingId]);

  const firstName = memberName.split(' ')[0];
  const hasQ = data?.status === 'completed' || data?.status === 'submitted';

  const handoffScript = hasQ
    ? `${firstName} crushed it. She said she wanted to ${data?.q1_fitness_goal || 'improve her fitness'}. Based on what I saw today, if she comes ${data?.q6_weekly_commitment || '3 times'} a week, she is absolutely going to hit that. I would love to see her in my next class.`
    : null;

  const duringClassNote = hasQ && data?.q1_fitness_goal
    ? `Reference their goal 2-3 times during class. Floor block: "This is exactly how you build ${data.q1_fitness_goal}. I will walk you through every move."`
    : 'Reference their goal 2-3 times during class at natural transitions.';

  const copyHandoff = () => {
    if (handoffScript) {
      navigator.clipboard.writeText(handoffScript);
      toast.success('Handoff script copied!');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <SheetHeader className="p-4 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Dumbbell className="w-5 h-5 text-blue-600" />
            Coach Prep: {memberName}
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
            ) : hasQ ? (
              <>
                {/* Questionnaire summary */}
                <div className="rounded-lg p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 space-y-2 text-xs">
                  <Row label="GOAL" value={data?.q1_fitness_goal} />
                  <Row label="OBSTACLE" value={data?.q3_obstacle} />
                  <Row label="WHY" value={data?.q5_emotional_driver} />
                  <Row label="FREQUENCY" value={data?.q6_weekly_commitment} />
                  {data?.q7_coach_notes && <Row label="NOTES" value={data.q7_coach_notes} />}
                </div>

                {/* Handoff script */}
                <div className="rounded-lg p-3 border border-blue-200 dark:border-blue-700 text-xs">
                  <p className="font-bold text-blue-800 dark:text-blue-300 text-[10px] uppercase mb-1">Handoff Script</p>
                  <p className="text-blue-900 dark:text-blue-200 leading-relaxed">{handoffScript}</p>
                </div>

                {/* During class */}
                <div className="rounded-lg p-3 border border-blue-200 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-900/10 text-xs">
                  <p className="font-bold text-blue-800 dark:text-blue-300 text-[10px] uppercase mb-1">During Class</p>
                  <p className="text-blue-900 dark:text-blue-200 leading-relaxed">{duringClassNote}</p>
                </div>

                <Button onClick={copyHandoff} className="w-full" variant="outline" size="sm">
                  <Copy className="w-3 h-3 mr-1.5" />
                  Copy Handoff Script
                </Button>
              </>
            ) : (
              <div className="text-xs text-muted-foreground italic flex items-center gap-1 py-4">
                <ClipboardList className="w-3.5 h-3.5" />
                No questionnaire on file. Ask about their goal before class.
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-2">
      <span className="font-bold text-blue-800 dark:text-blue-300 w-20 shrink-0">{label}:</span>
      <span className="text-blue-900 dark:text-blue-200">{value || '—'}</span>
    </div>
  );
}
