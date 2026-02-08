import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';

// Lead Sources (alphabetized)
const LEAD_SOURCES = [
  'Business Partnership Referral',
  'Event',
  'Instagram DMs',
  'Instagram DMs (Friend)',
  'Lead Management',
  'Lead Management (Friend)',
  'Member Referral',
  'My Personal Friend I Invited',
  'Online Intro Offer (self-booked)',
  'Source Not Found',
  'VIP Class',
] as const;

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
}

export default function IntroBookingEntry({ booking, index, onUpdate, onRemove }: IntroBookingEntryProps) {
  return (
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
        <Label className="text-xs">Member Name *</Label>
        <Input
          value={booking.memberName}
          onChange={(e) => onUpdate(index, { memberName: e.target.value })}
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
  );
}
