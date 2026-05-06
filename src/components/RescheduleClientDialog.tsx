import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { PotentialMatch } from '@/hooks/useDuplicateDetection';
import { Calendar, Clock, User, Star } from 'lucide-react';
import { LEAD_SOURCES } from '@/types';
import { ClassTimeSelect, DatePickerField } from '@/components/shared/FormHelpers';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';

interface RescheduleClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: PotentialMatch;
  currentUserName: string;
  onSuccess: (updatedData: { date: string; time: string }) => void;
}

export default function RescheduleClientDialog({
  open,
  onOpenChange,
  client,
  currentUserName,
  onSuccess,
}: RescheduleClientDialogProps) {
  const isVipMode = client.source === 'vip';

  const [newDate, setNewDate] = useState(isVipMode ? '' : client.class_date);
  const [newTime, setNewTime] = useState(isVipMode ? '' : (client.intro_time || ''));
  const [leadSource, setLeadSource] = useState(client.lead_source || (isVipMode ? 'VIP Class' : ''));
  const [notes, setNotes] = useState(client.fitness_goal || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newDate) {
      toast({
        title: 'Error',
        description: 'Please pick an intro date',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (isVipMode) {
        // INSERT a brand-new intros_booked row from the VIP registration
        const { data: newBooking, error: insertError } = await supabase
          .from('intros_booked')
          .insert({
            member_name: client.member_name,
            class_date: newDate,
            intro_time: newTime || null,
            coach_name: '',
            sa_working_shift: currentUserName,
            lead_source: leadSource || 'VIP Class',
            booked_by: currentUserName,
            phone: client.phone || null,
            email: client.email || null,
            vip_session_id: client.vip_session_id || null,
            vip_class_name: client.vip_class_name || null,
            fitness_goal: notes || null,
            last_edited_by: currentUserName,
            edit_reason: `Booked from VIP registration by ${currentUserName}`,
          } as any)
          .select('id')
          .single();

        if (insertError) throw insertError;

        // Back-link the registration to the new booking immediately so the
        // auto-trigger doesn't pair it with a different match
        await supabase
          .from('vip_registrations')
          .update({ booking_id: newBooking.id } as any)
          .eq('id', client.id);

        toast({
          title: 'Intro Booked',
          description: `${client.member_name}'s intro is on the calendar for ${newDate}`,
        });

        onSuccess({ date: newDate, time: newTime });
        onOpenChange(false);
        return;
      }

      // Default: UPDATE existing booking
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

      onSuccess({ date: newDate, time: newTime });
      onOpenChange(false);
    } catch (err) {
      console.error('Reschedule/book error:', err);
      toast({
        title: 'Error',
        description: isVipMode ? 'Failed to book intro. Please try again.' : 'Failed to reschedule client. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedVipDate = (() => {
    if (!isVipMode || !client.vip_session_date) return null;
    try { return format(parseLocalDate(client.vip_session_date), 'MMM d, yyyy'); }
    catch { return client.vip_session_date; }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isVipMode ? <Star className="w-5 h-5 text-purple-600 fill-purple-600" /> : <Calendar className="w-5 h-5" />}
            {isVipMode ? `Book intro for ${client.member_name}` : `Reschedule ${client.member_name}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Context block */}
          {isVipMode ? (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm space-y-1">
              <div className="flex items-center gap-2 text-purple-900 font-medium">
                <Star className="w-4 h-4 fill-purple-600 text-purple-600" />
                <span>Registered for: {client.vip_class_name}</span>
              </div>
              {formattedVipDate && (
                <div className="flex items-center gap-2 text-purple-800 text-xs">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>VIP class on {formattedVipDate}</span>
                </div>
              )}
              {(client.phone || client.email) && (
                <div className="flex items-center gap-3 text-purple-800 text-xs">
                  {client.phone && <span>{client.phone}</span>}
                  {client.email && <span className="truncate">{client.email}</span>}
                </div>
              )}
            </div>
          ) : (
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
          )}

          {/* New date/time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="newDate">{isVipMode ? 'Intro Date *' : 'New Intro Date *'}</Label>
              <div className="mt-1">
                <DatePickerField value={newDate} onChange={setNewDate} />
              </div>
            </div>
            <div>
              <Label>{isVipMode ? 'Intro Time' : 'New Intro Time'}</Label>
              <div className="mt-1">
                <ClassTimeSelect value={newTime} onValueChange={setNewTime} />
              </div>
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
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : (isVipMode ? 'Book Intro' : 'Update Booking')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
