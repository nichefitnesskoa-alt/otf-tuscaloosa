import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Trash2, CalendarIcon, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

const BOOKING_SOURCES = [
  '1st Class Intro (staff booked)',
  '2nd Class Intro (staff booked)',
  'Comp Session (staff booked)',
  'Online Intro Offer (self-booked)',
  'Source Not Found',
] as const;

const PROCESS_CHECKLIST = [
  'FVC (First Visit Card) completed',
  'RFG (Risk Free Guaranteed) presented',
  'Choice Architecture used',
] as const;

const LEAD_MEASURES = [
  'Half way transition encouragement',
  'Pre Mobility Matrix congratulations',
  'Stay for stretching and summary',
  'Be at entire coach summary breakdown',
] as const;

const MEMBERSHIP_TYPES = [
  { label: 'Premier + OTBeat', commission: 15.00 },
  { label: 'Premier w/o OTBeat', commission: 7.50 },
  { label: 'Elite + OTBeat', commission: 12.00 },
  { label: 'Elite w/o OTBeat', commission: 6.00 },
  { label: 'Basic + OTBeat', commission: 9.00 },
  { label: 'Basic w/o OTBeat', commission: 3.00 },
  { label: 'Follow-up needed (no sale yet)', commission: 0 },
  { label: 'No-show (didn\'t attend)', commission: 0 },
] as const;

type BookingSource = typeof BOOKING_SOURCES[number];
type MembershipType = typeof MEMBERSHIP_TYPES[number]['label'];

interface IntroBookedRecord {
  id: string;
  member_name: string;
  class_date: string;
  coach_name: string;
  sa_working_shift: string;
  fitness_goal?: string | null;
  lead_source: string;
}

export interface IntroRunData {
  id: string;
  memberName?: string;
  classTime?: string;
  bookingSource?: BookingSource;
  processChecklist: string[];
  leadMeasures: string[];
  result?: MembershipType;
  notes?: string;
  isSelfGen: boolean;
  buyDate?: Date;
  linkedIntroBookedId?: string;
}

interface IntroRunEntryProps {
  intro: IntroRunData;
  index: number;
  onUpdate: (index: number, updates: Partial<IntroRunData>) => void;
  onRemove: (index: number) => void;
}

export default function IntroRunEntry({ intro, index, onUpdate, onRemove }: IntroRunEntryProps) {
  const [pendingIntros, setPendingIntros] = useState<IntroBookedRecord[]>([]);
  const [isLoadingIntros, setIsLoadingIntros] = useState(false);
  const [entryMode, setEntryMode] = useState<'select' | 'manual'>('select');

  useEffect(() => {
    const fetchPendingIntros = async () => {
      setIsLoadingIntros(true);
      try {
        // Fetch intros_booked that haven't been run yet (not in intros_run)
        const { data, error } = await supabase
          .from('intros_booked')
          .select('*')
          .order('class_date', { ascending: false });

        if (error) throw error;
        setPendingIntros(data || []);
      } catch (error) {
        console.error('Error fetching pending intros:', error);
      } finally {
        setIsLoadingIntros(false);
      }
    };

    fetchPendingIntros();
  }, []);

  const handleSelectBookedIntro = (introId: string) => {
    const selected = pendingIntros.find(i => i.id === introId);
    if (selected) {
      onUpdate(index, {
        linkedIntroBookedId: introId,
        memberName: selected.member_name,
        isSelfGen: selected.lead_source?.includes('Self-generated') || 
                   selected.lead_source?.includes('Instagram'),
      });
    }
  };

  const selectedIntro = pendingIntros.find(i => i.id === intro.linkedIntroBookedId);

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
            onUpdate(index, { linkedIntroBookedId: undefined });
          }}
          className="flex-1"
        >
          Manual Entry
        </Button>
      </div>

      {entryMode === 'select' ? (
        <div>
          <Label className="text-xs">Select from Booked Intros</Label>
          <Select
            value={intro.linkedIntroBookedId || ''}
            onValueChange={handleSelectBookedIntro}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder={isLoadingIntros ? 'Loading...' : 'Select an intro...'} />
            </SelectTrigger>
            <SelectContent>
              {pendingIntros.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground text-center">
                  No pending intros found
                </div>
              ) : (
                pendingIntros.map((bookedIntro) => (
                  <SelectItem key={bookedIntro.id} value={bookedIntro.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{bookedIntro.member_name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({format(new Date(bookedIntro.class_date), 'MMM d')})
                      </span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {selectedIntro && (
            <div className="mt-2 p-2 bg-primary/10 rounded text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Coach:</span>
                <span>{selectedIntro.coach_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source:</span>
                <span>{selectedIntro.lead_source}</span>
              </div>
              {selectedIntro.fitness_goal && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Goal:</span>
                  <span>{selectedIntro.fitness_goal}</span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Member Name *</Label>
            <Input
              value={intro.memberName || ''}
              onChange={(e) => onUpdate(index, { memberName: e.target.value })}
              className="mt-1"
              placeholder="Full name"
            />
          </div>
          <div>
            <Label className="text-xs">Class Time *</Label>
            <Input
              type="time"
              value={intro.classTime || ''}
              onChange={(e) => onUpdate(index, { classTime: e.target.value })}
              className="mt-1"
            />
          </div>
        </div>
      )}

      {/* Common fields for both modes */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Class Time *</Label>
          <Input
            type="time"
            value={intro.classTime || ''}
            onChange={(e) => onUpdate(index, { classTime: e.target.value })}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Buy Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full mt-1 justify-start text-left font-normal",
                  !intro.buyDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {intro.buyDate ? format(intro.buyDate, 'MMM d, yyyy') : 'Select date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={intro.buyDate}
                onSelect={(date) => onUpdate(index, { buyDate: date })}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div>
        <Label className="text-xs">Booking Source</Label>
        <Select
          value={intro.bookingSource || ''}
          onValueChange={(v) => onUpdate(index, { bookingSource: v as BookingSource })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select source..." />
          </SelectTrigger>
          <SelectContent>
            {BOOKING_SOURCES.map((source) => (
              <SelectItem key={source} value={source}>{source}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs mb-2 block">Process Checklist</Label>
        <div className="space-y-2">
          {PROCESS_CHECKLIST.map((item) => (
            <div key={item} className="flex items-center gap-2">
              <Checkbox
                id={`process-${index}-${item}`}
                checked={intro.processChecklist?.includes(item)}
                onCheckedChange={(checked) => {
                  const current = intro.processChecklist || [];
                  onUpdate(index, {
                    processChecklist: checked
                      ? [...current, item]
                      : current.filter(i => i !== item)
                  });
                }}
              />
              <Label htmlFor={`process-${index}-${item}`} className="text-xs font-normal">
                {item}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs mb-2 block">Lead Measures</Label>
        <div className="space-y-2">
          {LEAD_MEASURES.map((item) => (
            <div key={item} className="flex items-center gap-2">
              <Checkbox
                id={`lead-${index}-${item}`}
                checked={intro.leadMeasures?.includes(item)}
                onCheckedChange={(checked) => {
                  const current = intro.leadMeasures || [];
                  onUpdate(index, {
                    leadMeasures: checked
                      ? [...current, item]
                      : current.filter(i => i !== item)
                  });
                }}
              />
              <Label htmlFor={`lead-${index}-${item}`} className="text-xs font-normal">
                {item}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs">Result *</Label>
        <Select
          value={intro.result || ''}
          onValueChange={(v) => onUpdate(index, { result: v as MembershipType })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select result..." />
          </SelectTrigger>
          <SelectContent>
            {MEMBERSHIP_TYPES.map((type) => (
              <SelectItem key={type.label} value={type.label}>
                {type.label} {type.commission > 0 && `($${type.commission.toFixed(2)})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 p-2 bg-primary/5 rounded">
        <Checkbox
          id={`selfgen-${index}`}
          checked={intro.isSelfGen}
          onCheckedChange={(checked) => onUpdate(index, { isSelfGen: !!checked })}
        />
        <Label htmlFor={`selfgen-${index}`} className="text-xs font-normal">
          Self-generated lead
        </Label>
        {intro.isSelfGen && (
          <Badge variant="default" className="ml-auto text-xs">
            Self-Gen
          </Badge>
        )}
      </div>

      <div>
        <Label className="text-xs">Additional Notes</Label>
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
