/**
 * BookIntroSheet – Schedule an intro for any future (or same-day) date.
 * Distinct from WalkInIntroSheet which is locked to today/right-now.
 */
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

interface BookIntroSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function BookIntroSheet({ open, onOpenChange, onSaved }: BookIntroSheetProps) {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [classDate, setClassDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [classTime, setClassTime] = useState('');
  const [coach, setCoach] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setFirstName('');
    setLastName('');
    setPhone('');
    setClassDate(format(new Date(), 'yyyy-MM-dd'));
    setClassTime('');
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
    if (!classDate) { toast.error('Class date is required'); return; }
    if (!coach) { toast.error('Coach is required'); return; }
    if (!leadSource) { toast.error('Lead source is required'); return; }

    setSaving(true);
    try {
      const memberName = `${firstName.trim()} ${lastName.trim()}`;
      const saName = user?.name || '';
      const classStartAt = classTime ? `${classDate}T${classTime}:00` : null;

      const { error } = await supabase.from('intros_booked').insert({
        member_name: memberName,
        class_date: classDate,
        intro_time: classTime || null,
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

      toast.success(`${memberName} booked for ${format(new Date(classDate + 'T12:00:00'), 'MMM d')}.`);
      window.dispatchEvent(new CustomEvent('myday:walk-in-added'));
      onSaved();
      handleClose(false);
    } catch (err: any) {
      console.error('Book intro save error:', err);
      toast.error(err?.message || 'Failed to save booking');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-xl">
        <SheetHeader className="mb-4">
          <SheetTitle>Book an Intro</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pb-4">
          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="book-first">First Name <span className="text-destructive">*</span></Label>
              <Input
                id="book-first"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="First"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="book-last">Last Name <span className="text-destructive">*</span></Label>
              <Input
                id="book-last"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Last"
              />
            </div>
          </div>

          {/* Phone (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="book-phone">Phone <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              id="book-phone"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="(555) 555-5555"
            />
          </div>

          {/* Class Date */}
          <div className="space-y-1.5">
            <Label htmlFor="book-date">Class Date <span className="text-destructive">*</span></Label>
            <Input
              id="book-date"
              type="date"
              value={classDate}
              onChange={e => setClassDate(e.target.value)}
            />
          </div>

          {/* Class Time */}
          <div className="space-y-1.5">
            <Label htmlFor="book-time">Class Time <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              id="book-time"
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
            {saving ? 'Booking...' : 'Book Intro'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
