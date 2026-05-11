import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { useShiftSubmission } from './useShiftSubmission';
import type { ShiftType } from './ShiftSelector';
import { toast } from 'sonner';

interface Props {
  shiftType: ShiftType;
}

const QUESTIONS = {
  lead_forward_answer: 'How did you move a new lead forward today?',
  member_experience_answer: "How did you impact a member's experience?",
  ownership_lane_answer: 'What did you do in your ownership lane?',
} as const;

type Field = keyof typeof QUESTIONS;

export function EndOfShiftSubmission({ shiftType }: Props) {
  const { user } = useAuth();
  const { data, loading, save, submit, reopen } = useShiftSubmission(user?.name, shiftType);

  const [local, setLocal] = useState({
    lead_forward_answer: '',
    member_experience_answer: '',
    ownership_lane_answer: '',
  });

  useEffect(() => {
    setLocal({
      lead_forward_answer: data.lead_forward_answer,
      member_experience_answer: data.member_experience_answer,
      ownership_lane_answer: data.ownership_lane_answer,
    });
  }, [data.id, data.lead_forward_answer, data.member_experience_answer, data.ownership_lane_answer]);

  const isSubmitted = !!data.submitted_at;
  const hasAtLeastOne =
    local.lead_forward_answer.trim().length > 0 ||
    local.member_experience_answer.trim().length > 0 ||
    local.ownership_lane_answer.trim().length > 0;

  const onBlur = (field: Field) => {
    if (local[field] !== data[field]) {
      save({ [field]: local[field] } as any);
    }
  };

  const onSubmit = async () => {
    // Persist any pending edits first
    await save({
      lead_forward_answer: local.lead_forward_answer,
      member_experience_answer: local.member_experience_answer,
      ownership_lane_answer: local.ownership_lane_answer,
    });
    await submit();
    toast.success('Shift closed out');
  };

  return (
    <Card id="end-of-shift" className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Check className="w-4 h-4 text-primary" />
          Close out your shift
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Answer the three questions to submit. Optional — but the data feeds Monday's Own It.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {(Object.keys(QUESTIONS) as Field[]).map(field => (
          <div key={field} className="space-y-1.5">
            <Label className="text-xs font-medium">{QUESTIONS[field]}</Label>
            <Textarea
              value={local[field]}
              onChange={e => setLocal(p => ({ ...p, [field]: e.target.value }))}
              onBlur={() => onBlur(field)}
              placeholder="One sentence is enough."
              className="min-h-[64px] text-sm"
              disabled={loading}
            />
          </div>
        ))}

        <div className="flex items-center justify-between pt-2">
          {isSubmitted ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Check className="w-3 h-3" />
              Submitted at {format(new Date(data.submitted_at!), 'h:mm a')}
            </p>
          ) : (
            <span className="text-xs text-muted-foreground">Not submitted yet</span>
          )}
          {isSubmitted ? (
            <Button variant="outline" size="sm" onClick={reopen} className="h-9 px-3 text-xs">
              Edit & resubmit
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onSubmit}
              disabled={!hasAtLeastOne || loading}
              className="h-9 px-4 text-xs"
            >
              Submit shift
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
