import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Tables } from '@/integrations/supabase/types';

interface BookIntroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Tables<'leads'>;
  onDone: () => void;
}

export function BookIntroDialog({ open, onOpenChange, lead, onDone }: BookIntroDialogProps) {
  const { user } = useAuth();
  const [classDate, setClassDate] = useState('');
  const [classTime, setClassTime] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!classDate) {
      toast.error('Please select a class date');
      return;
    }
    setSaving(true);
    try {
      // Create intro booking
      const { data: booking, error: bookingError } = await supabase
        .from('intros_booked')
        .insert({
          member_name: `${lead.first_name} ${lead.last_name}`,
          class_date: classDate,
          intro_time: classTime || null,
          coach_name: '',
          sa_working_shift: user?.name || 'Unknown',
          lead_source: lead.source,
          booked_by: user?.name || 'Unknown',
        })
        .select('id')
        .single();

      if (bookingError) throw bookingError;

      // Update lead with booked_intro_id
      await supabase.from('leads').update({
        booked_intro_id: booking.id,
      }).eq('id', lead.id);

      // Log activity
      await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        activity_type: 'stage_change',
        performed_by: user?.name || 'Unknown',
        notes: `Booked intro for ${classDate}${classTime ? ' at ' + classTime : ''}`,
      });

      toast.success('Intro booked! Lead moved to intro pipeline.');
      setClassDate('');
      setClassTime('');
      onOpenChange(false);
      onDone();
    } catch {
      toast.error('Failed to book intro');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Book Intro for {lead.first_name} {lead.last_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Class Date *</Label>
            <Input type="date" value={classDate} onChange={e => setClassDate(e.target.value)} />
          </div>
          <div>
            <Label>Class Time</Label>
            <Input type="time" value={classTime} onChange={e => setClassTime(e.target.value)} />
          </div>
          <Button onClick={handleSubmit} disabled={saving || !classDate} className="w-full">
            {saving ? 'Booking...' : 'Book Intro'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
