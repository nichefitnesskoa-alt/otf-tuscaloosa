import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, ClipboardList } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface QuestionnaireResponse {
  q1_fitness_goal: string | null;
  q2_fitness_level: number | null;
  q3_obstacle: string | null;
  q4_past_experience: string | null;
  q5_emotional_driver: string | null;
  q6_weekly_commitment: string | null;
  q6b_available_days: string | null;
  q7_coach_notes: string | null;
}

interface QuestionnaireResponseViewerProps {
  questionnaireId: string;
  questionnaireStatus?: string;
}

export default function QuestionnaireResponseViewer({ questionnaireId, questionnaireStatus }: QuestionnaireResponseViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<QuestionnaireResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (questionnaireStatus !== 'completed' || loaded) return;
    (async () => {
      const { data: row } = await supabase
        .from('intro_questionnaires')
        .select('q1_fitness_goal, q2_fitness_level, q3_obstacle, q4_past_experience, q5_emotional_driver, q6_weekly_commitment, q7_coach_notes')
        .eq('id', questionnaireId)
        .maybeSingle();
      // Also fetch q6b_available_days via a separate cast since it may not be in generated types yet
      let q6bValue: string | null = null;
      try {
        const { data: extraRow } = await supabase
          .from('intro_questionnaires')
          .select('q6b_available_days' as any)
          .eq('id', questionnaireId)
          .maybeSingle();
        q6bValue = (extraRow as any)?.q6b_available_days ?? null;
      } catch {}
      if (row) setData({ ...(row as any), q6b_available_days: q6bValue } as QuestionnaireResponse);
      setLoaded(true);
    })();
  }, [questionnaireId, questionnaireStatus, loaded]);

  if (questionnaireStatus !== 'completed' || !data) return null;

  const emotionalWhy = data.q5_emotional_driver
    ? data.q5_emotional_driver.length > 80
      ? data.q5_emotional_driver.substring(0, 80) + '…'
      : data.q5_emotional_driver
    : '—';

  // Parse Q4 into Q4a and Q4b
  const q4Parts = data.q4_past_experience?.split(' | ') ?? [];
  const q4a = q4Parts[0] || null;
  const q4b = q4Parts.length > 1 ? q4Parts.slice(1).join(' | ') : null;

  return (
    <div className="mt-2">
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-between text-xs h-7 px-2"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex items-center gap-1">
          <ClipboardList className="w-3 h-3" />
          View Responses
        </span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </Button>

      {expanded && (
        <div className="mt-2 space-y-3 animate-fade-in">
          {/* Summary Card */}
          <div className="rounded-lg p-3 text-xs space-y-1.5" style={{ borderLeft: '4px solid #FF6900', backgroundColor: '#FFF8F0' }}>
            <div className="flex gap-2">
              <span className="font-bold text-muted-foreground w-24 shrink-0">GOAL:</span>
              <span style={{ color: '#333' }}>{data.q1_fitness_goal || '—'}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold text-muted-foreground w-24 shrink-0">LEVEL:</span>
              <span style={{ color: '#333' }}>{data.q2_fitness_level ?? '—'}/5</span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold text-muted-foreground w-24 shrink-0">OBSTACLE:</span>
              <span style={{ color: '#333' }}>{data.q3_obstacle || '—'}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold text-muted-foreground w-24 shrink-0">EMOTIONAL WHY:</span>
              <span style={{ color: '#333' }}>{emotionalWhy}</span>
            </div>
          </div>

          {/* Full responses */}
          <div className="space-y-2 text-xs">
            <ResponseRow label="Q1: Fitness Goal" value={data.q1_fitness_goal} />
            <ResponseRow label="Q2: Fitness Level" value={data.q2_fitness_level ? `${data.q2_fitness_level}/5` : null} />
            <ResponseRow label="Q3: Biggest Obstacle" value={data.q3_obstacle} />
            <ResponseRow label="Q4a: Past Experience" value={q4a} />
            <ResponseRow label="Q4b: Past Results" value={q4b} />
            <ResponseRow label="Q5: Emotional Driver" value={data.q5_emotional_driver} />
            <ResponseRow label="Q6: Weekly Commitment" value={data.q6_weekly_commitment} />
            <ResponseRow label="Q6b: Available Days" value={data.q6b_available_days} />
            <ResponseRow label="Q7: Coach Notes" value={data.q7_coach_notes} />
          </div>
        </div>
      )}
    </div>
  );
}

function ResponseRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="border-b border-border/40 pb-1.5">
      <div className="font-medium text-muted-foreground">{label}</div>
      <div style={{ color: '#333' }}>{value || <span className="italic text-muted-foreground">No answer</span>}</div>
    </div>
  );
}
