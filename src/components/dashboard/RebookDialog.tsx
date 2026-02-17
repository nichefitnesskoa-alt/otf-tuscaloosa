import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { getLocalDateString } from '@/lib/utils';
import { ALL_STAFF } from '@/types';
import { CalendarPlus, Loader2 } from 'lucide-react';

interface RebookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personName: string;
  bookingId: string | null;
  personType: 'no_show' | 'didnt_buy';
}

const REBOOK_REASONS = [
  { value: 'no_show_save', label: 'No-Show Save' },
  { value: 'didnt_buy_save', label: "Didn't Buy Save" },
  { value: 'scheduling_conflict', label: 'Scheduling Conflict' },
  { value: 'other', label: 'Other' },
] as const;

export function RebookDialog({ open, onOpenChange, personName, bookingId, personType }: RebookDialogProps) {
  const { user } = useAuth();
  const { refreshData, refreshFollowUps } = useData();
  const [isSaving, setIsSaving] = useState(false);
  const [classDate, setClassDate] = useState(getLocalDateString());
  const [introTime, setIntroTime] = useState('');
  const [coachName, setCoachName] = useState('');
  const [reason, setReason] = useState<string>(personType === 'no_show' ? 'no_show_save' : 'didnt_buy_save');

  const handleSubmit = async () => {
    if (!classDate) {
      toast.error('Please select a date');
      return;
    }
    setIsSaving(true);
    try {
      // Fetch original booking for context
      let leadSource = 'Rebook';
      let fitnessGoal = '';
      let saWorking = user?.name || '';
      
      if (bookingId) {
        const { data: original } = await supabase
          .from('intros_booked')
          .select('lead_source, fitness_goal, sa_working_shift, coach_name, intro_owner')
          .eq('id', bookingId)
          .maybeSingle();
        
        if (original) {
          leadSource = original.lead_source || 'Rebook';
          fitnessGoal = original.fitness_goal || '';
          saWorking = original.sa_working_shift || user?.name || '';
          if (!coachName) setCoachName(original.coach_name || '');
        }
      }

      // Create new booking linked to original
      const { error: insertError } = await supabase
        .from('intros_booked')
        .insert({
          member_name: personName,
          class_date: classDate,
          intro_time: introTime || null,
          coach_name: coachName || 'TBD',
          sa_working_shift: saWorking,
          lead_source: leadSource,
          fitness_goal: fitnessGoal || null,
          booking_status: 'Active',
          booking_status_canon: 'ACTIVE',
          booked_by: user?.name || 'Unknown',
          originating_booking_id: bookingId,
          rebooked_from_booking_id: bookingId,
          rebook_reason: reason,
          rebooked_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;

      // Mark follow-up queue as saved_to_rebook
      if (bookingId) {
        await supabase
          .from('follow_up_queue')
          .update({
            saved_to_rebook: true,
            saved_to_rebook_at: new Date().toISOString(),
          })
          .eq('booking_id', bookingId)
          .eq('status', 'pending');
      }

      toast.success(`Rebooked ${personName} for ${classDate}`);
      onOpenChange(false);
      await Promise.all([refreshData(), refreshFollowUps()]);
    } catch (err: any) {
      console.error('Rebook error:', err);
      toast.error('Failed to rebook: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="w-4 h-4" />
            Rebook {personName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">New Class Date</Label>
            <Input
              type="date"
              value={classDate}
              onChange={e => setClassDate(e.target.value)}
              className="h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Intro Time (optional)</Label>
            <Input
              type="time"
              value={introTime}
              onChange={e => setIntroTime(e.target.value)}
              className="h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Coach (optional)</Label>
            <Input
              value={coachName}
              onChange={e => setCoachName(e.target.value)}
              placeholder="TBD"
              className="h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REBOOK_REASONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
            Rebook
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
