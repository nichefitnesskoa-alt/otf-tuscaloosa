import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Tables } from '@/integrations/supabase/types';
import { generateUniqueSlug } from '@/lib/utils';

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
  const [bringingFriend, setBringingFriend] = useState(false);
  const [friendFirstName, setFriendFirstName] = useState('');
  const [friendLastName, setFriendLastName] = useState('');
  const [friendPhone, setFriendPhone] = useState('');
  const [friendEmail, setFriendEmail] = useState('');

  const resetForm = () => {
    setClassDate('');
    setClassTime('');
    setBringingFriend(false);
    setFriendFirstName('');
    setFriendLastName('');
    setFriendPhone('');
    setFriendEmail('');
  };

  const handleSubmit = async () => {
    if (!classDate) {
      toast.error('Please select a class date');
      return;
    }
    if (bringingFriend && (!friendFirstName.trim() || !friendPhone.trim())) {
      toast.error('Friend\'s first name and phone are required');
      return;
    }
    setSaving(true);
    try {
      // Create main intro booking
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
          phone: lead.phone || null,
          email: lead.email || null,
        } as any)
        .select('id')
        .single();

      if (bookingError) throw bookingError;

      // Auto-create questionnaire for 1st intros
      try {
        const firstName = lead.first_name;
        const lastName = lead.last_name;
        const slug = await generateUniqueSlug(firstName, lastName, supabase);
        await supabase.from('intro_questionnaires').insert({
          id: crypto.randomUUID(),
          booking_id: booking.id,
          client_first_name: firstName,
          client_last_name: lastName,
          scheduled_class_date: classDate,
          scheduled_class_time: classTime || null,
          status: 'not_sent',
          slug,
        } as any);
      } catch (qErr) {
        console.error('Auto-create Q error:', qErr);
      }

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

      let friendBookingId: string | null = null;

      // Handle friend booking
      if (bringingFriend && friendFirstName.trim()) {
        const friendFullName = `${friendFirstName.trim()} ${friendLastName.trim()}`.trim();

        // Create friend lead
        const { data: friendLead } = await supabase
          .from('leads')
          .insert({
            first_name: friendFirstName.trim(),
            last_name: friendLastName.trim() || '',
            phone: friendPhone.trim(),
            email: friendEmail.trim() || null,
            source: `Referral from ${lead.first_name} ${lead.last_name}`,
            stage: 'new',
          })
          .select('id')
          .single();

        // Create friend booking
        const { data: friendBooking } = await supabase
          .from('intros_booked')
          .insert({
            member_name: friendFullName,
            class_date: classDate,
            intro_time: classTime || null,
            coach_name: '',
            sa_working_shift: user?.name || 'Unknown',
            lead_source: `Referral from ${lead.first_name} ${lead.last_name}`,
            booked_by: user?.name || 'Unknown',
            paired_booking_id: booking.id,
          })
          .select('id')
          .single();

        if (friendBooking) {
          friendBookingId = friendBooking.id;

          // Link main booking to friend
          await supabase.from('intros_booked')
            .update({ paired_booking_id: friendBooking.id })
            .eq('id', booking.id);

          // Update friend lead with booking
          if (friendLead) {
            await supabase.from('leads').update({
              booked_intro_id: friendBooking.id,
            }).eq('id', friendLead.id);

            // Log friend activity
            await supabase.from('lead_activities').insert({
              lead_id: friendLead.id,
              activity_type: 'stage_change',
              performed_by: user?.name || 'Unknown',
              notes: `Referred by ${lead.first_name} ${lead.last_name}. Booked together for ${classDate}${classTime ? ' at ' + classTime : ''}.`,
            });
          }
        }

        toast.success(`Intro booked for both ${lead.first_name} and ${friendFirstName}!`);
      } else {
        toast.success('Intro booked! Lead moved to intro pipeline.');
      }

      resetForm();
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
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
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

          {/* Friend booking toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">Bringing a friend?</Label>
              <p className="text-xs text-muted-foreground">Create a linked booking for their friend</p>
            </div>
            <Switch checked={bringingFriend} onCheckedChange={setBringingFriend} />
          </div>

          {bringingFriend && (
            <div className="space-y-2 rounded-lg border border-dashed p-3">
              <p className="text-xs font-semibold text-muted-foreground">Friend's Info</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">First Name *</Label>
                  <Input value={friendFirstName} onChange={e => setFriendFirstName(e.target.value)} placeholder="First" />
                </div>
                <div>
                  <Label className="text-xs">Last Name</Label>
                  <Input value={friendLastName} onChange={e => setFriendLastName(e.target.value)} placeholder="Last" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Phone *</Label>
                <Input value={friendPhone} onChange={e => setFriendPhone(e.target.value)} placeholder="(555) 123-4567" type="tel" />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input value={friendEmail} onChange={e => setFriendEmail(e.target.value)} placeholder="email@example.com" type="email" />
              </div>
            </div>
          )}

          <Button onClick={handleSubmit} disabled={saving || !classDate} className="w-full">
            {saving ? 'Booking...' : bringingFriend ? 'Book Both Intros' : 'Book Intro'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
