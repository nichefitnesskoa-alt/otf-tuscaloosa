import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, UserCheck } from 'lucide-react';
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
  'Premier + OTBeat',
  'Premier w/o OTBeat',
  'Elite + OTBeat',
  'Elite w/o OTBeat',
  'Basic + OTBeat',
  'Basic w/o OTBeat',
  'Booked 2nd intro',
  'Follow-up needed',
  'No-show',
  'Not interested',
] as const;

const GOAL_QUALITY_OPTIONS = ['Clear', 'Partial', 'None'] as const;
const PRICING_ENGAGEMENT_OPTIONS = ['Yes', 'Partial', 'No'] as const;

export interface IntroRunData {
  id: string;
  memberName: string;
  runDate: string;
  runTime: string;
  leadSource: string;
  outcome: string;
  goalQuality: string;
  pricingEngagement: string;
  fvcCompleted: boolean;
  rfgPresented: boolean;
  choiceArchitecture: boolean;
  halfwayEncouragement: boolean;
  premobilityEncouragement: boolean;
  coachingSummaryPresence: boolean;
  notes: string;
  linkedBookingId?: string;
}

interface IntroRunEntryProps {
  intro: IntroRunData;
  index: number;
  onUpdate: (index: number, updates: Partial<IntroRunData>) => void;
  onRemove: (index: number) => void;
}

export default function IntroRunEntry({ intro, index, onUpdate, onRemove }: IntroRunEntryProps) {
  const [entryMode, setEntryMode] = useState<'select' | 'manual'>('select');

  const handleSelectBookedIntro = (booking: {
    booking_id: string;
    member_name: string;
    lead_source: string;
  }) => {
    onUpdate(index, {
      linkedBookingId: booking.booking_id,
      memberName: booking.member_name,
      leadSource: booking.lead_source,
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

      {/* Process Checklist Group 1 */}
      <div>
        <Label className="text-xs mb-2 block">Process Checklist</Label>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`fvc-${index}`}
              checked={intro.fvcCompleted}
              onCheckedChange={(checked) => onUpdate(index, { fvcCompleted: !!checked })}
            />
            <Label htmlFor={`fvc-${index}`} className="text-xs font-normal">
              FVC (First Visit Card) completed
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`rfg-${index}`}
              checked={intro.rfgPresented}
              onCheckedChange={(checked) => onUpdate(index, { rfgPresented: !!checked })}
            />
            <Label htmlFor={`rfg-${index}`} className="text-xs font-normal">
              RFG (Risk Free Guaranteed) presented
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`choice-${index}`}
              checked={intro.choiceArchitecture}
              onCheckedChange={(checked) => onUpdate(index, { choiceArchitecture: !!checked })}
            />
            <Label htmlFor={`choice-${index}`} className="text-xs font-normal">
              Choice Architecture used
            </Label>
          </div>
        </div>
      </div>

      {/* Lead Measures Group 2 */}
      <div>
        <Label className="text-xs mb-2 block">Lead Measures</Label>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`halfway-${index}`}
              checked={intro.halfwayEncouragement}
              onCheckedChange={(checked) => onUpdate(index, { halfwayEncouragement: !!checked })}
            />
            <Label htmlFor={`halfway-${index}`} className="text-xs font-normal">
              Halfway encouragement
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`premobility-${index}`}
              checked={intro.premobilityEncouragement}
              onCheckedChange={(checked) => onUpdate(index, { premobilityEncouragement: !!checked })}
            />
            <Label htmlFor={`premobility-${index}`} className="text-xs font-normal">
              Pre-mobility encouragement
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`coaching-${index}`}
              checked={intro.coachingSummaryPresence}
              onCheckedChange={(checked) => onUpdate(index, { coachingSummaryPresence: !!checked })}
            />
            <Label htmlFor={`coaching-${index}`} className="text-xs font-normal">
              Coaching summary presence
            </Label>
          </div>
        </div>
      </div>

      {/* Goal Quality */}
      <div>
        <Label className="text-xs">Goal Quality</Label>
        <Select
          value={intro.goalQuality || ''}
          onValueChange={(v) => onUpdate(index, { goalQuality: v })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {GOAL_QUALITY_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Pricing Engagement */}
      <div>
        <Label className="text-xs">Pricing Engagement</Label>
        <Select
          value={intro.pricingEngagement || ''}
          onValueChange={(v) => onUpdate(index, { pricingEngagement: v })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {PRICING_ENGAGEMENT_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
              <SelectItem key={outcome} value={outcome}>{outcome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
