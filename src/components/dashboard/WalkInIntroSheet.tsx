import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { COACHES, LEAD_SOURCES } from '@/types';

interface WalkInIntroSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/** Returns the next upcoming class time slot based on current time (OTF standard slots) */
function getDefaultClassTime(): string {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const totalMin = h * 60 + m;

  // Common OTF class times as minutes from midnight
  const slots = [
    5 * 60,        // 05:00
    6 * 60,        // 06:00
    7 * 60,        // 07:00
    8 * 60,        // 08:00
    9 * 60,        // 09:00
    10 * 60,       // 10:00
    11 * 60,       // 11:00
    12 * 60,       // 12:00
    13 * 60,       // 13:00
    16 * 60,       // 16:00
    17 * 60,       // 17:00
    18 * 60,       // 18:00
    19 * 60,       // 19:00
    20 * 60,       // 20:00
  ];

  const next = slots.find(s => s >= totalMin);
  const targetMin = next ?? slots[0];
  const hh = Math.floor(targetMin / 60).toString().padStart(2, '0');
  const mm = (targetMin % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

export function WalkInIntroSheet({ open, onOpenChange, onSaved }: WalkInIntroSheetProps) {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [classTime, setClassTime] = useState(getDefaultClassTime());
  const [coach, setCoach] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setFirstName('');
    setLastName('');
    setPhone('');
    setClassTime(getDefaultClassTime());
    setCoach('');
    setLeadSource('');
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleSave = async () => {
    if (!firstName.trim()) { toast.error('First name is required'); return; }
    if (!lastName.trim()) { toast.error('Last name is required'); return; }
    if (!classTime) { toast.error('Class time is required'); return; }
    if (!coach) { toast.error('Coach is required'); return; }
    if (!leadSource) { toast.error('Lead source is required'); return; }

    setSaving(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const memberName = `${firstName.trim()} ${lastName.trim()}`;
      const saName = user?.name || '';

      // Build class_start_at from today + selected time
      const classStartAt = `${today}T${classTime}:00`;

      const { error } = await supabase.from('intros_booked').insert({
        member_name: memberName,
        class_date: today,
        intro_time: classTime,
        class_start_at: classStartAt,
        coach_name: coach,
        lead_source: leadSource,
        sa_working_shift: saName,
        booked_by: saName,
        intro_owner: saName,
        intro_owner_locked: false,
        phone: phone.trim() || null,
        booking_type_canon: 'STANDARD',
        booking_status_canon: 'ACTIVE',
        questionnaire_status_canon: 'not_sent',
        is_vip: false,
      });

      if (error) throw error;

      toast.success(`${memberName} added to today's intros.`);
      // Signal UpcomingIntrosCard to refresh immediately
      window.dispatchEvent(new CustomEvent('myday:walk-in-added'));
      onSaved();
      handleClose(false);
    } catch (err: any) {
      console.error('Walk-in intro save error:', err);
      toast.error(err?.message || 'Failed to save walk-in intro');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-xl">
        <SheetHeader className="mb-4">
          <SheetTitle>Add Walk-In Intro</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pb-4">
          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="walk-in-first">First Name <span className="text-destructive">*</span></Label>
              <Input
                id="walk-in-first"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="First"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="walk-in-last">Last Name <span className="text-destructive">*</span></Label>
              <Input
                id="walk-in-last"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Last"
              />
            </div>
          </div>

          {/* Phone (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="walk-in-phone">Phone <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              id="walk-in-phone"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="(555) 555-5555"
            />
          </div>

          {/* Class Time */}
          <div className="space-y-1.5">
            <Label htmlFor="walk-in-time">Class Time <span className="text-destructive">*</span></Label>
            <Input
              id="walk-in-time"
              type="time"
              value={classTime}
              onChange={e => setClassTime(e.target.value)}
            />
          </div>

          {/* Coach */}
          <div className="space-y-1.5">
            <Label>Coach <span className="text-destructive">*</span></Label>
            <Select value={coach} onValueChange={setCoach}>
              <SelectTrigger>
                <SelectValue placeholder="Select coach..." />
              </SelectTrigger>
              <SelectContent>
                {COACHES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lead Source */}
          <div className="space-y-1.5">
            <Label>Lead Source <span className="text-destructive">*</span></Label>
            <Select value={leadSource} onValueChange={setLeadSource}>
              <SelectTrigger>
                <SelectValue placeholder="Select source..." />
              </SelectTrigger>
              <SelectContent>
                {LEAD_SOURCES.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* SA (read-only) */}
          <div className="space-y-1.5">
            <Label>SA (auto-filled)</Label>
            <Input value={user?.name || ''} disabled className="bg-muted" />
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full"
            size="lg"
          >
            {saving ? 'Adding...' : 'Add Intro'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
