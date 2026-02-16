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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Copy, ClipboardList } from 'lucide-react';
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

  const copyToClipboard = () => {
    const lines = [
      `CLIENT: ${memberName}`,
      `DATE: ${classDate}${classTime ? ` @ ${classTime.substring(0, 5)}` : ''}`,
      `COACH: ${coachName}`,
    ];
    if (data?.q1_fitness_goal) lines.push(`GOAL: ${data.q1_fitness_goal}`);
    if (data?.q3_obstacle) lines.push(`OBSTACLE: ${data.q3_obstacle}`);
    if (data?.q5_emotional_driver) lines.push(`EMOTIONAL WHY: ${data.q5_emotional_driver}`);
    if (data?.q6_weekly_commitment) lines.push(`COMMITMENT: ${data.q6_weekly_commitment}`);
    if (data?.q7_coach_notes) lines.push(`COACH NOTES: ${data.q7_coach_notes}`);

    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Copied to clipboard!');
  };

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
            <TabsTrigger value="prep" className="text-xs">Quick Prep</TabsTrigger>
            <TabsTrigger value="close" className="text-xs">Close Script</TabsTrigger>
            <TabsTrigger value="objections" className="text-xs">Objections</TabsTrigger>
          </TabsList>

          {/* TAB 1: Quick Prep */}
          <TabsContent value="prep" className="space-y-3 mt-3">
            {data?.status === 'completed' ? (
              <div className="rounded-lg p-3 text-xs space-y-1.5 border-l-4 border-l-primary bg-primary/5">
                <PrepRow label="Goal" value={data.q1_fitness_goal} />
                <PrepRow label="Level" value={data.q2_fitness_level ? `${data.q2_fitness_level}/5` : null} />
                <PrepRow label="Past Fitness" value={data.q4_past_experience} />
                <PrepRow label="Obstacle" value={data.q3_obstacle} />
                <PrepRow label="Why" value={data.q5_emotional_driver} />
                <PrepRow label="Commitment" value={data.q6_weekly_commitment} />
                {data.q7_coach_notes && <PrepRow label="Coach Notes" value={data.q7_coach_notes} />}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground italic flex items-center gap-1">
                <ClipboardList className="w-3 h-3" />
                {data ? 'Questionnaire not completed yet' : 'No questionnaire on file'}
              </div>
            )}

            <Button onClick={copyToClipboard} className="w-full" variant="outline">
              <Copy className="w-4 h-4 mr-2" />
              Copy to Clipboard
            </Button>
          </TabsContent>

          {/* TAB 2: Close Script */}
          <TabsContent value="close" className="mt-3">
            {data?.status === 'completed' ? (
              <TransformationClose
                clientName={memberName}
                fitnessGoal={data.q1_fitness_goal}
                obstacle={data.q3_obstacle}
                pastExperience={data.q4_past_experience}
                emotionalDriver={data.q5_emotional_driver}
                weeklyCommitment={data.q6_weekly_commitment}
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
            {data?.status === 'completed' ? (
              <EirmaPlaybook
                obstacles={data.q3_obstacle}
                fitnessLevel={data.q2_fitness_level}
                emotionalDriver={data.q5_emotional_driver}
                clientName={memberName}
                fitnessGoal={data.q1_fitness_goal}
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
