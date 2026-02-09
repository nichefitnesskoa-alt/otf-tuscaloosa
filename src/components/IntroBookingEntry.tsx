import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { useDuplicateDetection, PotentialMatch } from '@/hooks/useDuplicateDetection';
import DuplicateClientAlert from './DuplicateClientAlert';
import { LEAD_SOURCES } from '@/types';

export interface IntroBookingData {
  id: string;
  memberName: string;
  introDate: string;
  introTime: string;
  leadSource: string;
  notes: string;
}

interface IntroBookingEntryProps {
  booking: IntroBookingData;
  index: number;
  onUpdate: (index: number, updates: Partial<IntroBookingData>) => void;
  onRemove: (index: number) => void;
  currentUserName?: string;
}

export default function IntroBookingEntry({ 
  booking, 
  index, 
  onUpdate, 
  onRemove,
  currentUserName = 'Unknown',
}: IntroBookingEntryProps) {
  const { checkForDuplicates, isChecking, matches, clearMatches } = useDuplicateDetection();
  const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);
  const [dismissedWarning, setDismissedWarning] = useState(false);
  const [pendingMatches, setPendingMatches] = useState<PotentialMatch[]>([]);

  // Debounced duplicate check
  useEffect(() => {
    if (!booking.memberName || booking.memberName.trim().length < 3) {
      clearMatches();
      return;
    }

    // If warning was already dismissed for this name, don't check again
    if (dismissedWarning) return;

    const timer = setTimeout(async () => {
      const foundMatches = await checkForDuplicates(booking.memberName);
      if (foundMatches.length > 0) {
        setPendingMatches(foundMatches);
        setShowDuplicateAlert(true);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [booking.memberName, checkForDuplicates, clearMatches, dismissedWarning]);

  const handleNameChange = useCallback((value: string) => {
    // Reset dismissed warning when name changes significantly
    if (dismissedWarning && value.length < 3) {
      setDismissedWarning(false);
    }
    onUpdate(index, { memberName: value });
  }, [index, onUpdate, dismissedWarning]);

  const handleCreateAnyway = useCallback(() => {
    setShowDuplicateAlert(false);
    setDismissedWarning(true);
    clearMatches();
  }, [clearMatches]);

  const handleCancel = useCallback(() => {
    setShowDuplicateAlert(false);
    onUpdate(index, { memberName: '' });
    clearMatches();
  }, [index, onUpdate, clearMatches]);

  const handleRescheduleSuccess = useCallback(() => {
    setShowDuplicateAlert(false);
    // Clear the booking entry since we updated an existing client
    onUpdate(index, { memberName: '', introDate: '', introTime: '', leadSource: '', notes: '' });
    clearMatches();
  }, [index, onUpdate, clearMatches]);

  return (
    <>
      <div className="p-3 bg-muted/50 rounded-lg space-y-3 relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6"
          onClick={() => onRemove(index)}
        >
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
        </Button>

        <div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Member Name *</Label>
            {isChecking && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            {dismissedWarning && (
              <Badge variant="secondary" className="text-xs py-0 px-1.5">
                <AlertTriangle className="w-3 h-3 mr-1 text-destructive" />
                Similar name exists
              </Badge>
            )}
          </div>
          <Input
            value={booking.memberName}
            onChange={(e) => handleNameChange(e.target.value)}
            className="mt-1"
            placeholder="Full name"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Intro Date *</Label>
            <Input
              type="date"
              value={booking.introDate}
              onChange={(e) => onUpdate(index, { introDate: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Intro Time</Label>
            <Input
              type="time"
              value={booking.introTime}
              onChange={(e) => onUpdate(index, { introTime: e.target.value })}
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Lead Source *</Label>
          <Select
            value={booking.leadSource}
            onValueChange={(v) => onUpdate(index, { leadSource: v })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select source..." />
            </SelectTrigger>
            <SelectContent>
              {LEAD_SOURCES.map((source) => (
                <SelectItem key={source} value={source}>{source}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Notes</Label>
          <Textarea
            value={booking.notes}
            onChange={(e) => onUpdate(index, { notes: e.target.value })}
            className="mt-1 min-h-[60px]"
            placeholder="Any notes..."
          />
        </div>
      </div>

      <DuplicateClientAlert
        open={showDuplicateAlert}
        onOpenChange={setShowDuplicateAlert}
        inputName={booking.memberName}
        matches={pendingMatches}
        currentUserName={currentUserName}
        onCreateAnyway={handleCreateAnyway}
        onCancel={handleCancel}
        onRescheduleSuccess={handleRescheduleSuccess}
      />
    </>
  );
}
