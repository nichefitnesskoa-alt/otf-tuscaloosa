import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, UserCheck, Calendar, Info } from 'lucide-react';
import BookedIntroSelector from './BookedIntroSelector';

const LEAD_SOURCES = [
  'Self-generated (my outreach)',
  'Instagram DMs',
  'Referral',
  'Lead Management Call / Text',
  'Lead Management Web Lead Call',
  'B2B Partnership',
  'B2C Event',
  'Member brought friend',
  'Online Intro Offer (self-booked)',
  'Source Not Found',
] as const;

const OUTCOMES = [
  { label: 'Premier + OTBeat', commission: 15.00 },
  { label: 'Premier w/o OTBeat', commission: 7.50 },
  { label: 'Elite + OTBeat', commission: 12.00 },
  { label: 'Elite w/o OTBeat', commission: 6.00 },
  { label: 'Basic + OTBeat', commission: 9.00 },
  { label: 'Basic w/o OTBeat', commission: 3.00 },
  { label: 'Booked 2nd intro', commission: 0 },
  { label: 'Follow-up needed', commission: 0 },
  { label: 'No-show', commission: 0 },
  { label: 'Not interested', commission: 0 },
] as const;

const GOAL_WHY_OPTIONS = ['Yes', 'Partial', 'No'] as const;
const RELATIONSHIP_OPTIONS = ['Yes', 'Partial', 'No'] as const;
const MADE_FRIEND_OPTIONS = ['Yes', 'No'] as const;

export interface IntroRunData {
  id: string;
  memberName: string;
  runDate: string;
  runTime: string;
  leadSource: string;
  outcome: string;
  // New lead measures (spec-compliant)
  goalWhyCaptured: string;
  relationshipExperience: string;
  madeAFriend: boolean;
  notes: string;
  linkedBookingId?: string;
  // 2nd intro scheduling
  secondIntroDate?: string;
  secondIntroTime?: string;
  // Booking info (carry forward)
  bookedBy?: string;
  originatingBookingId?: string;
}

interface IntroRunEntryProps {
  intro: IntroRunData;
  index: number;
  onUpdate: (index: number, updates: Partial<IntroRunData>) => void;
  onRemove: (index: number) => void;
  currentUserName?: string;
}

export default function IntroRunEntry({ intro, index, onUpdate, onRemove, currentUserName = 'SA' }: IntroRunEntryProps) {
  const [entryMode, setEntryMode] = useState<'select' | 'manual'>('select');
  const [show2ndIntroPrompt, setShow2ndIntroPrompt] = useState(false);

  // Watch for "Booked 2nd intro" outcome
  useEffect(() => {
    if (intro.outcome === 'Booked 2nd intro') {
      setShow2ndIntroPrompt(true);
    } else {
      setShow2ndIntroPrompt(false);
      // Clear 2nd intro fields if outcome changes
      if (intro.secondIntroDate || intro.secondIntroTime) {
        onUpdate(index, { secondIntroDate: undefined, secondIntroTime: undefined });
      }
    }
  }, [intro.outcome]);

  const handleSelectBookedIntro = (booking: {
    id: string;
    booking_id: string | null;
    member_name: string;
    lead_source: string;
    sa_working_shift: string;
    intro_owner: string | null;
  }) => {
    onUpdate(index, {
      linkedBookingId: booking.id,
      memberName: booking.member_name,
      leadSource: booking.lead_source,
      bookedBy: booking.sa_working_shift,
      originatingBookingId: booking.booking_id || undefined,
    });
  };

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

      {/* Info box about booking credit vs commission */}
      <div className="p-2 bg-primary/5 border border-primary/20 rounded-md text-xs text-muted-foreground flex items-start gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
        <span>
          <strong>Booking credit</strong> goes to who booked it. <strong>Commission</strong> goes to who runs the intro first.
        </span>
      </div>

      {/* Entry Mode Toggle */}
      <div className="flex gap-2 mb-3">
        <Button
          variant={entryMode === 'select' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setEntryMode('select')}
          className="flex-1"
        >
          <UserCheck className="w-3.5 h-3.5 mr-1" />
          Select Booked
        </Button>
        <Button
          variant={entryMode === 'manual' ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setEntryMode('manual');
            onUpdate(index, { linkedBookingId: undefined });
          }}
          className="flex-1"
        >
          Manual Entry
        </Button>
      </div>

      {entryMode === 'select' ? (
        <BookedIntroSelector
          selectedBookingId={intro.linkedBookingId}
          onSelect={handleSelectBookedIntro}
          currentUserName={currentUserName}
        />
      ) : (
        <div>
          <Label className="text-xs">Member Name *</Label>
          <Input
            value={intro.memberName || ''}
            onChange={(e) => onUpdate(index, { memberName: e.target.value })}
            className="mt-1"
            placeholder="Full name"
          />
        </div>
      )}

      {/* Run Date & Time */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Run Date *</Label>
          <Input
            type="date"
            value={intro.runDate || ''}
            onChange={(e) => onUpdate(index, { runDate: e.target.value })}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Run Time</Label>
          <Input
            type="time"
            value={intro.runTime || ''}
            onChange={(e) => onUpdate(index, { runTime: e.target.value })}
            className="mt-1"
          />
        </div>
      </div>

      {/* Lead Source (for manual entry) */}
      {entryMode === 'manual' && (
        <div>
          <Label className="text-xs">Lead Source</Label>
          <Select
            value={intro.leadSource || ''}
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
      )}

      {/* NEW LEAD MEASURES (per spec) */}
      <div className="border-t border-border pt-3">
        <Label className="text-xs font-semibold mb-2 block">Lead Measures</Label>
        
        {/* 1. Goal + Why Captured */}
        <div className="mb-3">
          <Label className="text-xs">Main fitness goal + why captured?</Label>
          <Select
            value={intro.goalWhyCaptured || ''}
            onValueChange={(v) => onUpdate(index, { goalWhyCaptured: v })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {GOAL_WHY_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 2. Relationship Experience */}
        <div className="mb-3">
          <Label className="text-xs">High relationship experience executed?</Label>
          <p className="text-xs text-muted-foreground mb-1">
            (halfway encouragement, pre-mobility, coaching summary)
          </p>
          <Select
            value={intro.relationshipExperience || ''}
            onValueChange={(v) => onUpdate(index, { relationshipExperience: v })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {RELATIONSHIP_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 3. Made a Friend */}
        <div className="mb-3">
          <Label className="text-xs">Did you make a friend?</Label>
          <Select
            value={intro.madeAFriend ? 'Yes' : intro.madeAFriend === false ? 'No' : ''}
            onValueChange={(v) => onUpdate(index, { madeAFriend: v === 'Yes' })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {MADE_FRIEND_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Outcome */}
      <div>
        <Label className="text-xs">Outcome *</Label>
        <Select
          value={intro.outcome || ''}
          onValueChange={(v) => onUpdate(index, { outcome: v })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select outcome..." />
          </SelectTrigger>
          <SelectContent>
            {OUTCOMES.map((outcome) => (
              <SelectItem key={outcome.label} value={outcome.label}>
                {outcome.label}{outcome.commission > 0 ? ` ($${outcome.commission.toFixed(2)})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 2nd Intro Date/Time Prompt */}
      {show2ndIntroPrompt && (
        <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg space-y-3">
          <div className="flex items-center gap-2 text-warning">
            <Calendar className="w-4 h-4" />
            <span className="text-sm font-medium">Schedule 2nd Intro</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">2nd Intro Date *</Label>
              <Input
                type="date"
                value={intro.secondIntroDate || ''}
                onChange={(e) => onUpdate(index, { secondIntroDate: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">2nd Intro Time</Label>
              <Input
                type="time"
                value={intro.secondIntroTime || ''}
                onChange={(e) => onUpdate(index, { secondIntroTime: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            This will create a new booking linked to the original intro owner.
          </p>
        </div>
      )}

      {/* Show commission badge for sale outcomes */}
      {intro.outcome && ['Premier', 'Elite', 'Basic'].some(t => intro.outcome.includes(t)) && (
        <div className="p-2 bg-success/10 rounded text-center">
          <Badge className="bg-success">
            Commission Eligible
          </Badge>
        </div>
      )}

      {/* Notes */}
      <div>
        <Label className="text-xs">Notes</Label>
        <Textarea
          value={intro.notes || ''}
          onChange={(e) => onUpdate(index, { notes: e.target.value })}
          className="mt-1 min-h-[60px]"
          placeholder="Any notes..."
        />
      </div>
    </div>
  );
}
