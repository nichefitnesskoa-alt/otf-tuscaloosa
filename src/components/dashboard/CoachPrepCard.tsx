import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Copy, Dumbbell, ClipboardList } from 'lucide-react';

interface CoachPrepCardProps {
  memberName: string;
  classTime: string | null;
  bookingId: string;
}

interface QData {
  q1_fitness_goal: string | null;
  q3_obstacle: string | null;
  q6_weekly_commitment: string | null;
  status: string;
}

export function CoachPrepCard({ memberName, classTime, bookingId }: CoachPrepCardProps) {
  const [data, setData] = useState<QData | null>(null);

  useEffect(() => {
    supabase
      .from('intro_questionnaires')
      .select('q1_fitness_goal, q3_obstacle, q6_weekly_commitment, status' as any)
      .eq('booking_id', bookingId)
      .order('submitted_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data: row }) => setData(row as unknown as QData | null));
  }, [bookingId]);

  const firstName = memberName.split(' ')[0];
  const hasQ = data?.status === 'completed';

  const handoffScript = hasQ
    ? `${firstName} crushed it. She said she wanted to ${data?.q1_fitness_goal || 'improve her fitness'}. Based on what I saw today, if she comes ${data?.q6_weekly_commitment || '3 times'} a week, she is absolutely going to hit that. I would love to see her in my next class.`
    : null;

  const duringClassNote = hasQ && data?.q1_fitness_goal
    ? `Reference their goal 2-3 times at natural transitions. Floor block: "This is exactly how you build ${data.q1_fitness_goal}. I will walk you through every move."`
    : 'Reference their goal 2-3 times at natural transitions. Floor block: "This is exactly how you build [goal]. I will walk you through every move."';

  const copyHandoff = () => {
    if (handoffScript) {
      navigator.clipboard.writeText(handoffScript);
      toast.success('Handoff script copied!');
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-950/20 dark:border-blue-800">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Dumbbell className="w-4 h-4 text-blue-600" />
          <span className="font-semibold">{memberName}</span>
          {classTime && (
            <Badge variant="outline" className="ml-auto text-[10px] text-blue-700 border-blue-300">
              {classTime.substring(0, 5)}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-2">
        {hasQ ? (
          <>
            <div className="text-xs space-y-1 rounded p-2 bg-blue-100/50 dark:bg-blue-900/30">
              <div className="flex gap-2">
                <span className="font-bold text-blue-800 dark:text-blue-300 w-20 shrink-0">GOAL:</span>
                <span className="text-blue-900 dark:text-blue-200">{data?.q1_fitness_goal || '—'}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-blue-800 dark:text-blue-300 w-20 shrink-0">OBSTACLE:</span>
                <span className="text-blue-900 dark:text-blue-200">{data?.q3_obstacle || '—'}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-blue-800 dark:text-blue-300 w-20 shrink-0">FREQUENCY:</span>
                <span className="text-blue-900 dark:text-blue-200">{data?.q6_weekly_commitment || '—'}</span>
              </div>
            </div>

            <div className="text-xs rounded p-2 border border-blue-200 dark:border-blue-700">
              <p className="font-bold text-blue-800 dark:text-blue-300 text-[10px] uppercase mb-1">Handoff Script</p>
              <p className="text-blue-900 dark:text-blue-200 leading-relaxed">{handoffScript}</p>
            </div>

            <div className="text-xs rounded p-2 border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20">
              <p className="font-bold text-blue-800 dark:text-blue-300 text-[10px] uppercase mb-1">During Class</p>
              <p className="text-blue-900 dark:text-blue-200 leading-relaxed">{duringClassNote}</p>
            </div>

            <Button onClick={copyHandoff} className="w-full" variant="outline" size="sm">
              <Copy className="w-3 h-3 mr-1.5" />
              Copy Handoff Script
            </Button>
          </>
        ) : (
          <div className="text-xs text-muted-foreground italic flex items-center gap-1 py-2">
            <ClipboardList className="w-3 h-3" />
            No questionnaire on file. Reference the booking card for basic info.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
