import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Copy, ClipboardList, Lightbulb } from 'lucide-react';
import { ObjectionPlaybook } from './ObjectionPlaybook';

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
  q5_emotional_driver: string | null;
  q6_weekly_commitment: string | null;
  q7_coach_notes: string | null;
  status: string;
}

export function IntroPrepCard({ open, onOpenChange, memberName, classDate, classTime, coachName, bookingId }: IntroPrepCardProps) {
  const [data, setData] = useState<QData | null>(null);

  useEffect(() => {
    if (!open) return;
    supabase
      .from('intro_questionnaires')
      .select('q1_fitness_goal, q2_fitness_level, q3_obstacle, q5_emotional_driver, q6_weekly_commitment, q7_coach_notes, status' as any)
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl">{memberName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{classDate}{classTime ? ` @ ${classTime.substring(0, 5)}` : ''}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Coach</span>
              <span className="font-medium">{coachName}</span>
            </div>
          </div>

          {data?.status === 'completed' ? (
            <div className="rounded-lg p-3 text-xs space-y-1.5 border-l-4 border-l-primary bg-primary/5">
              <PrepRow label="Goal" value={data.q1_fitness_goal} />
              <PrepRow label="Level" value={data.q2_fitness_level ? `${data.q2_fitness_level}/5` : null} />
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

          {data?.status === 'completed' && (
            <ObjectionPlaybook
              obstacles={data.q3_obstacle}
              fitnessLevel={data.q2_fitness_level}
              emotionalDriver={data.q5_emotional_driver}
            />
          )}

          <Button onClick={copyToClipboard} className="w-full" variant="outline">
            <Copy className="w-4 h-4 mr-2" />
            Copy to Clipboard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
