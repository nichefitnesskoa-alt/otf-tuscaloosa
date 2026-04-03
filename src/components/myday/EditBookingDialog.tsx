import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import { NameAutocomplete } from '@/components/shared/NameAutocomplete';

const LEAD_SOURCES = [
  'Gmail', 'IG', 'Referral', 'Walk-in', 'MindBody', 'Website',
  'Facebook', 'Corporate', 'Event', 'VIP Class', 'Other',
];

const CLASS_TIMES = [
  '05:00', '06:15', '07:30', '08:00', '08:45', '09:15', '10:00',
  '10:30', '11:10', '11:15', '12:15', '12:30', '15:00', '16:15', '17:30',
];

function formatTimeLabel(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hr}:${m.toString().padStart(2, '0')} ${ampm}`;
}

interface EditBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  coachName: string;
  introTime: string | null;
  leadSource: string;
  introOwner: string | null;
  bookedBy: string | null;
  editedBy: string;
  onSaved: () => void;
}

export function EditBookingDialog({
  open, onOpenChange, bookingId,
  coachName, introTime, leadSource,
  introOwner, bookedBy, editedBy, onSaved,
}: EditBookingDialogProps) {
  const [coach, setCoach] = useState(coachName || '');
  const [time, setTime] = useState(introTime || '');
  const [source, setSource] = useState(leadSource || '');
  const [owner, setOwner] = useState(introOwner || '');
  const [booker, setBooker] = useState(bookedBy || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('intros_booked')
        .update({
          coach_name: coach,
          intro_time: time || null,
          lead_source: source,
          intro_owner: owner || null,
          booked_by: booker || null,
          last_edited_at: new Date().toISOString(),
          last_edited_by: editedBy,
        })
        .eq('id', bookingId);

      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success('Booking updated');
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit Booking
            {saved && <Check className="w-4 h-4 text-emerald-600" />}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Coach Name</Label>
            <NameAutocomplete
              value={coach}
              onChange={setCoach}
              placeholder="Coach name"
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Class Time</Label>
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent>
                {CLASS_TIMES.map(t => (
                  <SelectItem key={t} value={t}>{formatTimeLabel(t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Lead Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                {LEAD_SOURCES.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Intro Owner (ran by)</Label>
            <NameAutocomplete
              value={owner}
              onChange={setOwner}
              placeholder="Intro owner"
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Booked By</Label>
            <NameAutocomplete
              value={booker}
              onChange={setBooker}
              placeholder="Booked by"
              className="h-11"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="min-h-[44px]">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="min-h-[44px] bg-[#E8540A] hover:bg-[#E8540A]/90 text-white">
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
