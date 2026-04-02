import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ShiftSelector, ShiftType } from './ShiftSelector';
import { ShiftTaskList } from './ShiftTaskList';
import { ShiftIntroCards } from './ShiftIntroCards';

const SHIFT_LABELS: Record<ShiftType, { label: string; time: string }> = {
  morning: { label: 'Morning', time: '4:30am – 9:30am' },
  mid: { label: 'Mid', time: '8:30am – 2:30pm' },
  last: { label: 'Last', time: '1:30pm – 6:30pm' },
  weekend: { label: 'Weekend', time: 'All day' },
};

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

      {/* Content */}
      <div className="px-4 pt-4 space-y-5">
        <ShiftTaskList shiftType={selectedShift} />

        {/* Intros section */}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Today's intros</p>
        <ShiftIntroCards />
      </div>
    </div>
  );
}
