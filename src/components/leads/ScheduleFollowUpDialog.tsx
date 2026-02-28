import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { DatePickerField } from '@/components/shared/FormHelpers';

interface ScheduleFollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  onDone: () => void;
}

export function ScheduleFollowUpDialog({ open, onOpenChange, leadId, onDone }: ScheduleFollowUpDialogProps) {
  const { user } = useAuth();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!date) {
      toast.error('Please select a date');
      return;
    }
    setSaving(true);
    try {
      const followUpAt = new Date(`${date}T${time}`).toISOString();

      await supabase.from('leads').update({ follow_up_at: followUpAt }).eq('id', leadId);

      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        activity_type: 'reminder',
        performed_by: user?.name || 'Unknown',
        notes: `Follow-up scheduled for ${format(new Date(`${date}T${time}`), 'MMM d, yyyy h:mm a')}`,
      });

      toast.success('Follow-up scheduled');
      setDate('');
      setTime('09:00');
      onOpenChange(false);
      onDone();
    } catch {
      toast.error('Failed to schedule follow-up');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Follow-Up</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Date *</Label>
            <DatePickerField value={date} onChange={setDate} disablePast />
          </div>
          <div>
            <Label>Time</Label>
            <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
          </div>
          <Button onClick={handleSubmit} disabled={saving || !date} className="w-full">
            {saving ? 'Saving...' : 'Set Follow-Up'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
