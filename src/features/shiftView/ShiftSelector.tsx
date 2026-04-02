import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { Sun, Clock, Sunset, Calendar } from 'lucide-react';

export type ShiftType = 'morning' | 'mid' | 'last' | 'weekend';

interface ShiftOption {
  type: ShiftType;
  label: string;
  timeRange: string;
  icon: React.ReactNode;
}

const SHIFTS: ShiftOption[] = [
  { type: 'morning', label: 'Morning', timeRange: '4:30am – 9:30am', icon: <Sun className="w-6 h-6" /> },
  { type: 'mid', label: 'Mid', timeRange: '8:30am – 2:30pm', icon: <Clock className="w-6 h-6" /> },
  { type: 'last', label: 'Last', timeRange: '1:30pm – 6:30pm', icon: <Sunset className="w-6 h-6" /> },
  { type: 'weekend', label: 'Weekend', timeRange: 'All day', icon: <Calendar className="w-6 h-6" /> },
];

interface ShiftSelectorProps {
  onSelect: (shift: ShiftType) => void;
}

export function ShiftSelector({ onSelect }: ShiftSelectorProps) {
  const { user } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-6">
      <div className="text-center mb-8">
        <h1 className="text-xl font-bold">{user?.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">{format(new Date(), 'EEEE, MMMM d')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
        {SHIFTS.map((shift) => (
          <button
            key={shift.type}
            onClick={() => onSelect(shift.type)}
            className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all active:scale-95"
          >
            <span className="text-primary">{shift.icon}</span>
            <span className="font-semibold text-sm">{shift.label}</span>
            <span className="text-[10px] text-muted-foreground">{shift.timeRange}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
