import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, UserCheck, AlertCircle } from 'lucide-react';
import { useData, IGLead } from '@/context/DataContext';

const MANUAL_BOOKING_SOURCES = [
  'Online Intro Offer',
  'Lead management',
  'Referral',
  'Instagram',
  'Other',
] as const;

type ManualBookingSource = typeof MANUAL_BOOKING_SOURCES[number];

export interface ManualIntroData {
  id: string;
  memberName: string;
  classTime: string;
  bookingSource: ManualBookingSource | '';
  isSelfGen: boolean;
  claimedIGLeadId?: string;
  claimedIGHandle?: string;
}

interface ManualIntroEntryProps {
  intro: ManualIntroData;
  index: number;
  saName: string;
  onUpdate: (index: number, updates: Partial<ManualIntroData>) => void;
  onRemove: (index: number) => void;
}

export default function ManualIntroEntry({ 
  intro, 
  index, 
  saName,
  onUpdate, 
  onRemove 
}: ManualIntroEntryProps) {
  const { findMatchingIGLead, igLeads } = useData();
  const [matchedLead, setMatchedLead] = useState<IGLead | null>(null);
  const [showMatchPrompt, setShowMatchPrompt] = useState(false);
  const [matchDecisionMade, setMatchDecisionMade] = useState(false);

  // Check for matching IG lead when member name changes and source is Online Intro Offer or Instagram
  useEffect(() => {
    const shouldAutoMatch = intro.bookingSource === 'Online Intro Offer' || intro.bookingSource === 'Instagram';
    
    if (shouldAutoMatch && intro.memberName.trim().length >= 2 && !matchDecisionMade) {
      // Find leads that belong to this SA
      const saLeads = igLeads.filter(lead => lead.sa_name === saName);
      
      // Try to find a match in SA's leads
      const match = saLeads.find(lead => {
        const leadFullName = `${lead.first_name} ${lead.last_name || ''}`.toLowerCase().trim();
        const memberNameLower = intro.memberName.toLowerCase().trim();
        return leadFullName.includes(memberNameLower) || memberNameLower.includes(leadFullName);
      });
      
      if (match && match.id !== intro.claimedIGLeadId) {
        setMatchedLead(match);
        setShowMatchPrompt(true);
      } else if (!match) {
        setMatchedLead(null);
        setShowMatchPrompt(false);
      }
    } else {
      setMatchedLead(null);
      setShowMatchPrompt(false);
    }
  }, [intro.memberName, intro.bookingSource, saName, igLeads, matchDecisionMade, intro.claimedIGLeadId]);

  // Reset match decision when booking source changes
  useEffect(() => {
    setMatchDecisionMade(false);
    onUpdate(index, { claimedIGLeadId: undefined, claimedIGHandle: undefined, isSelfGen: false });
  }, [intro.bookingSource]);

  const handleClaimLead = () => {
    if (matchedLead) {
      onUpdate(index, { 
        claimedIGLeadId: matchedLead.id, 
        claimedIGHandle: matchedLead.instagram_handle,
        isSelfGen: true 
      });
      setMatchDecisionMade(true);
      setShowMatchPrompt(false);
    }
  };

  const handleDeclineClaim = () => {
    setMatchDecisionMade(true);
    setShowMatchPrompt(false);
    onUpdate(index, { claimedIGLeadId: undefined, claimedIGHandle: undefined, isSelfGen: false });
  };

  const showSelfGenCheckbox = ['Lead management', 'Referral', 'Other'].includes(intro.bookingSource);

  return (
    <div className="p-3 bg-muted/50 rounded-lg space-y-3 relative border-l-4 border-l-primary/50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Manual Entry #{index + 1}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onRemove(index)}
        >
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Member Name *</Label>
          <Input
            value={intro.memberName}
            onChange={(e) => onUpdate(index, { memberName: e.target.value })}
            className="mt-1"
            placeholder="Full name"
          />
        </div>
        <div>
          <Label className="text-xs">Class Time *</Label>
          <Input
            type="time"
            value={intro.classTime}
            onChange={(e) => onUpdate(index, { classTime: e.target.value })}
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">How did they get booked? *</Label>
        <Select
          value={intro.bookingSource}
          onValueChange={(v) => onUpdate(index, { bookingSource: v as ManualBookingSource })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select source..." />
          </SelectTrigger>
          <SelectContent>
            {MANUAL_BOOKING_SOURCES.map((source) => (
              <SelectItem key={source} value={source}>{source}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Match Found Prompt for Online Intro Offer or Instagram */}
      {showMatchPrompt && matchedLead && (
        <div className="p-3 bg-primary/10 rounded-lg border border-primary/30">
          <div className="flex items-start gap-2">
            <UserCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Match found!</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                This appears to be YOUR lead: <span className="font-semibold text-primary">@{matchedLead.instagram_handle}</span>
                {matchedLead.first_name && ` (${matchedLead.first_name} ${matchedLead.last_name || ''})`}
              </p>
              <p className="text-xs text-muted-foreground">Claim it for self-gen commission?</p>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="default" onClick={handleClaimLead} className="h-7 text-xs">
                  Yes, Claim It
                </Button>
                <Button size="sm" variant="outline" onClick={handleDeclineClaim} className="h-7 text-xs">
                  No, Not My Lead
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Show claimed lead confirmation */}
      {intro.claimedIGLeadId && intro.claimedIGHandle && (
        <div className="p-2 bg-primary/10 rounded-lg border border-primary/30 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-primary" />
          <span className="text-xs text-primary">
            Claimed as self-gen: <span className="font-semibold">@{intro.claimedIGHandle}</span>
          </span>
        </div>
      )}

      {/* Self-gen checkbox for non-auto-matching sources */}
      {showSelfGenCheckbox && (
        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            id={`selfgen-${intro.id}`}
            checked={intro.isSelfGen}
            onCheckedChange={(checked) => onUpdate(index, { isSelfGen: !!checked })}
          />
          <Label htmlFor={`selfgen-${intro.id}`} className="text-xs font-normal">
            This was my self-generated lead (for commission tracking)
          </Label>
        </div>
      )}
    </div>
  );
}
