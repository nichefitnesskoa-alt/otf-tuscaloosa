import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { ShiftSelector, ShiftType } from './ShiftSelector';
import { ShiftTaskList } from './ShiftTaskList';
import { ShiftIntroCards } from './ShiftIntroCards';
import { EndOfShiftSubmission } from './EndOfShiftSubmission';
import { useShiftSubmission } from './useShiftSubmission';

const SHIFT_LABELS: Record<ShiftType, { label: string; time: string }> = {
  morning: { label: 'Morning', time: '4:30am – 9:30am' },
  mid: { label: 'Mid', time: '8:30am – 2:30pm' },
  last: { label: 'Last', time: '1:30pm – 6:30pm' },
  weekend: { label: 'Weekend', time: 'All day' },
};

const HEADER_QUESTIONS: { key: 'lead_forward_answer' | 'member_experience_answer' | 'ownership_lane_answer'; q: string }[] = [
  { key: 'lead_forward_answer', q: 'How did you move a new lead forward today?' },
  { key: 'member_experience_answer', q: "How did you impact a member's experience?" },
  { key: 'ownership_lane_answer', q: 'What did you do in your ownership lane?' },
];

function ShiftHeaderQuestions({ shiftType }: { shiftType: ShiftType }) {
  const { user } = useAuth();
  const { data } = useShiftSubmission(user?.name, shiftType);

  const scrollToCloseOut = () => {
    document.getElementById('end-of-shift')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Card className="border-primary/30">
      <div className="p-3 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Three questions you'll answer at end of shift
        </p>
        <div className="space-y-1.5">
          {HEADER_QUESTIONS.map(({ key, q }) => {
            const ans = (data[key] || '').trim();
            return (
              <button
                key={key}
                type="button"
                onClick={scrollToCloseOut}
                className="w-full text-left flex items-start gap-2 py-1 px-1 rounded hover:bg-muted/30 transition-colors"
              >
                <span className="text-[11px] font-medium text-foreground/80 shrink-0 mt-0.5">·</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[11px] text-muted-foreground">{q}</span>
                  <span className={`block text-xs mt-0.5 truncate ${ans ? 'text-foreground' : 'text-muted-foreground/60 italic'}`}>
                    {ans || '—'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground italic pt-1 border-t border-border/50">
          Log the real number. We can work with honest. We can't work with hidden.
        </p>
      </div>
    </Card>
  );
}

export default function ShiftViewPage() {
  const { user } = useAuth();
  const [selectedShift, setSelectedShift] = useState<ShiftType | null>(null);

  if (!selectedShift) {
    return <ShiftSelector onSelect={setSelectedShift} />;
  }

  const shift = SHIFT_LABELS[selectedShift];

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSelectedShift(null)}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <span className="font-bold text-sm">{user?.name}</span>
          </div>
          <Badge className="bg-primary text-primary-foreground hover:bg-primary text-xs px-3 py-1">
            {shift.label} · {shift.time}
          </Badge>
        </div>
      </div>

      {/* Sticky three-questions card */}
      <div className="sticky top-[57px] z-10 bg-background px-4 pt-3 pb-2 border-b border-border">
        <ShiftHeaderQuestions shiftType={selectedShift} />
      </div>

      {/* Content */}
      <div className="px-4 pt-4 space-y-5">
        <ShiftTaskList shiftType={selectedShift} />

        <EndOfShiftSubmission shiftType={selectedShift} />

        {/* Intros section */}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Today's intros</p>
        <ShiftIntroCards />
      </div>
    </div>
  );
}
