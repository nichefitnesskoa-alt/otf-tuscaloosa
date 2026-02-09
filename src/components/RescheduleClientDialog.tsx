import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { PotentialMatch } from '@/hooks/useDuplicateDetection';
import { Calendar, Clock, User } from 'lucide-react';
import { LEAD_SOURCES } from '@/types';

interface RescheduleClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: PotentialMatch;
  currentUserName: string;
  onSuccess: () => void;
}

export default function RescheduleClientDialog({
  open,
  onOpenChange,
  client,
  currentUserName,
  onSuccess,
}: RescheduleClientDialogProps) {
  const [newDate, setNewDate] = useState(client.class_date);
  const [newTime, setNewTime] = useState(client.intro_time || '');
  const [leadSource, setLeadSource] = useState(client.lead_source);
  const [notes, setNotes] = useState(client.fitness_goal || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReschedule = async () => {
    if (!newDate) {
      toast({
        title: 'Error',
        description: 'Please select a new intro date',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('intros_booked')
        .update({
          class_date: newDate,
          intro_time: newTime || null,
          lead_source: leadSource,
          fitness_goal: notes || null,
          last_edited_at: new Date().toISOString(),
          last_edited_by: currentUserName,
          edit_reason: `Rescheduled by ${currentUserName}`,
        })
        .eq('id', client.id);

      if (error) throw error;

      toast({
        title: 'Client Rescheduled',
        description: `${client.member_name}'s intro has been updated to ${newDate}`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error('Error rescheduling client:', err);
      toast({
        title: 'Error',
        description: 'Failed to reschedule client. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Reschedule {client.member_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current booking info */}
          <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>Currently booked: {client.class_date}</span>
              {client.intro_time && (
                <>
                  <Clock className="w-4 h-4 ml-2" />
                  <span>{client.intro_time}</span>
                </>
              )}
            </div>
            {client.booked_by && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="w-4 h-4" />
                <span>Booked by: {client.booked_by}</span>
              </div>
            )}
          </div>

          {/* New date/time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="newDate">New Intro Date *</Label>
              <Input
                id="newDate"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="newTime">New Intro Time</Label>
              <Input
                id="newTime"
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Lead source */}
          <div>
            <Label htmlFor="leadSource">Lead Source</Label>
            <Select value={leadSource} onValueChange={setLeadSource}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_SOURCES.map((source) => (
                  <SelectItem key={source} value={source}>
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 min-h-[80px]"
              placeholder="Any additional notes..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleReschedule} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Update Booking'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
