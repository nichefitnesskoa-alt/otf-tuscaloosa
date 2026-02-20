/**
 * FriendReferralDialog — shown once after a booking is saved.
 * Creates a linked intros_booked record for the friend with all
 * class details auto-filled from the original booking.
 * Also writes a referral log entry to the referrals table.
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Users } from 'lucide-react';
import { generateUniqueSlug } from '@/lib/utils';
import { format } from 'date-fns';

export interface OriginalBookingInfo {
  id: string;
  memberName: string;
  classDate: string;
  classStartAt: string | null;
  introTime: string | null;
  coachName: string;
  saWorkingShift: string;
  bookedBy: string;
}

interface FriendReferralDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalBooking: OriginalBookingInfo;
}

export function FriendReferralDialog({ open, onOpenChange, originalBooking }: FriendReferralDialogProps) {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [friendName, setFriendName] = useState('');
  const [friendPhone, setFriendPhone] = useState('');
  const [saving, setSaving] = useState(false);

  // The SA who is currently logged in — used for booked_by on the friend booking
  const currentSA = user?.name || originalBooking.bookedBy;

  const handleNo = () => {
    onOpenChange(false);
  };

  const handleYes = () => {
    setShowForm(true);
  };

  const handleSave = async () => {
    const trimmedName = friendName.trim();
    if (!trimmedName) {
      toast.error("Friend's name is required");
      return;
    }

    setSaving(true);
    try {
      const nameParts = trimmedName.split(' ');
      const firstName = nameParts[0] || trimmedName;
      const lastName = nameParts.slice(1).join(' ') || '';
      const leadSource = `Referral (Friend of ${originalBooking.memberName})`;

      // Insert friend booking — booked_by MUST be the currently logged-in SA
      const { data: friendBooking, error: bookingErr } = await supabase
        .from('intros_booked')
        .insert({
          member_name: trimmedName,
          class_date: originalBooking.classDate,
          class_start_at: originalBooking.classStartAt,
          intro_time: originalBooking.introTime,
          coach_name: originalBooking.coachName,
          lead_source: leadSource,
          sa_working_shift: originalBooking.saWorkingShift,
          booked_by: currentSA,        // Always the logged-in SA — critical for shift recap count
          intro_owner: currentSA,
          intro_owner_locked: false,
          phone: friendPhone.trim() || null,
          booking_type_canon: 'STANDARD',
          booking_status_canon: 'ACTIVE',
          questionnaire_status_canon: 'not_sent',
          is_vip: false,
          paired_booking_id: originalBooking.id,
          originating_booking_id: originalBooking.id,  // Links friend to original booking
        })
        .select('id')
        .single();

      if (bookingErr) throw bookingErr;

      // Link original booking back to friend, and write referral log entry atomically
      await Promise.all([
        // Update original booking with cross-reference
        supabase
          .from('intros_booked')
          .update({ paired_booking_id: friendBooking.id })
          .eq('id', originalBooking.id),

        // Write referral log entry — referrer gets credit
        supabase.from('referrals').insert({
          referrer_name: originalBooking.memberName,
          referred_name: trimmedName,
          referrer_booking_id: originalBooking.id,
          referred_booking_id: friendBooking.id,
          discount_applied: false,
        }),
      ]);

      // Auto-create questionnaire for friend
      try {
        const slug = await generateUniqueSlug(firstName, lastName, supabase);
        await supabase.from('intro_questionnaires').insert({
          booking_id: friendBooking.id,
          client_first_name: firstName,
          client_last_name: lastName,
          scheduled_class_date: originalBooking.classDate,
          scheduled_class_time: originalBooking.introTime,
          status: 'not_sent',
          slug,
        } as any);
      } catch (qErr) {
        console.warn('Friend questionnaire auto-create failed (non-critical):', qErr);
      }

      // Format display time
      let timeDisplay = '';
      if (originalBooking.introTime) {
        try {
          const [h, m] = originalBooking.introTime.split(':');
          const d = new Date();
          d.setHours(parseInt(h), parseInt(m));
          timeDisplay = format(d, 'h:mm a');
        } catch {
          timeDisplay = originalBooking.introTime;
        }
      }

      toast.success(`${trimmedName} added to${timeDisplay ? ` ${timeDisplay}` : ''} class!`);

      // Signal MyDay to refresh
      window.dispatchEvent(new CustomEvent('myday:walk-in-added'));

      onOpenChange(false);
    } catch (err: any) {
      console.error('Friend referral booking error:', err);
      toast.error(err?.message || 'Failed to add friend');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setShowForm(false);
    setFriendName('');
    setFriendPhone('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Did they bring a friend?
          </DialogTitle>
          <DialogDescription>
            Add a linked booking for their friend — all class details will be auto-filled.
          </DialogDescription>
        </DialogHeader>

        {!showForm ? (
          <div className="flex gap-3 pt-2">
            <Button className="flex-1" onClick={handleYes}>
              Yes, add friend
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleNo}>
              No thanks
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Auto-filled class info summary */}
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
              <div><span className="font-medium">Date:</span> {originalBooking.classDate}</div>
              {originalBooking.introTime && (
                <div><span className="font-medium">Time:</span> {originalBooking.introTime}</div>
              )}
              <div><span className="font-medium">Coach:</span> {originalBooking.coachName}</div>
              <div><span className="font-medium">Source:</span> Referral (Friend of {originalBooking.memberName})</div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="friend-name">
                Friend's Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="friend-name"
                value={friendName}
                onChange={e => setFriendName(e.target.value)}
                placeholder="First Last"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="friend-phone">
                Phone <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Input
                id="friend-phone"
                type="tel"
                value={friendPhone}
                onChange={e => setFriendPhone(e.target.value)}
                placeholder="(555) 555-5555"
              />
            </div>

            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={saving || !friendName.trim()}
              >
                {saving ? 'Adding...' : 'Add Friend'}
              </Button>
              <Button variant="ghost" onClick={handleNo} disabled={saving}>
                Skip
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
