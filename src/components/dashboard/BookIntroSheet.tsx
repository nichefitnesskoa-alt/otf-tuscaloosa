/**
 * BookIntroSheet – Schedule an intro for any future (or same-day) date.
 * Distinct from WalkInIntroSheet which is locked to today/right-now.
 * Inline friend prompt appears when a referral-type lead source is selected.
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
import { Users } from 'lucide-react';
import { generateUniqueSlug } from '@/lib/utils';

interface BookIntroSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function isReferralSource(source: string): boolean {
  if (!source) return false;
  const lower = source.toLowerCase();
  return lower.includes('referral') || lower.includes('friend') || lower.includes('invited');
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

  // Inline friend state
  const [friendAnswer, setFriendAnswer] = useState<'yes' | 'no' | null>(null);
  const [friendFirstName, setFriendFirstName] = useState('');
  const [friendLastName, setFriendLastName] = useState('');
  const [friendPhone, setFriendPhone] = useState('');
  const [referredBy, setReferredBy] = useState('');

  const showFriendPrompt = isReferralSource(leadSource);

  const reset = () => {
    setFirstName(''); setLastName(''); setPhone('');
    setClassDate(format(new Date(), 'yyyy-MM-dd')); setClassTime('');
    setCoach(''); setLeadSource('');
    setFriendAnswer(null); setFriendFirstName(''); setFriendLastName(''); setFriendPhone('');
    setReferredBy('');
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleLeadSourceChange = (val: string) => {
    setLeadSource(val);
    setFriendAnswer(null);
    setFriendFirstName(''); setFriendLastName(''); setFriendPhone('');
    setReferredBy('');
  };

  const handleSave = async () => {
    if (!firstName.trim()) { toast.error('First name is required'); return; }
    if (!lastName.trim()) { toast.error('Last name is required'); return; }
    if (!phone.trim()) { toast.error('Phone number is required'); return; }
    if (!classDate) { toast.error('Class date is required'); return; }
    if (!classTime) { toast.error('Class time is required'); return; }
    if (!coach) { toast.error('Coach is required'); return; }
    if (!leadSource) { toast.error('Lead source is required'); return; }

    setSaving(true);
    try {
      const memberName = `${firstName.trim()} ${lastName.trim()}`;
      const saName = user?.name || '';
      const classStartAt = classTime ? `${classDate}T${classTime}:00` : null;

      const h = new Date().getHours();
      const shiftLabel = h < 11 ? 'AM Shift' : h < 16 ? 'Mid Shift' : 'PM Shift';

      const { data: inserted, error } = await supabase.from('intros_booked').insert({
        member_name: memberName,
        class_date: classDate,
        intro_time: classTime || null,
        class_start_at: classStartAt,
        coach_name: coach,
        lead_source: leadSource,
        sa_working_shift: shiftLabel,
        booked_by: saName,
        intro_owner: saName,
        intro_owner_locked: false,
        phone: phone.trim() || null,
        booking_type_canon: 'STANDARD',
        booking_status_canon: 'ACTIVE',
        questionnaire_status_canon: 'not_sent',
        is_vip: false,
        referred_by_member_name: leadSource === 'Member Referral' ? (referredBy.trim() || null) : null,
      }).select('id').single();

      if (error) throw error;

      // Insert referral record if referred by someone
      if (inserted?.id && leadSource === 'Member Referral' && referredBy.trim()) {
        await supabase.from('referrals').insert({
          referrer_name: referredBy.trim(),
          referred_name: memberName,
          referrer_booking_id: null,
          referred_booking_id: inserted.id,
          discount_applied: false,
        });
      }

      // Auto-create questionnaire
      if (inserted?.id) {
        import('@/lib/introHelpers').then(({ autoCreateQuestionnaire }) => {
          autoCreateQuestionnaire({ bookingId: inserted.id, memberName, classDate }).catch(() => {});
        });
      }

      // Handle inline friend booking
      if (inserted?.id && friendAnswer === 'yes' && friendFirstName.trim()) {
        const friendFullName = `${friendFirstName.trim()} ${friendLastName.trim()}`.trim();
        const friendLeadSource = `Referral (Friend of ${memberName})`;

        const { data: friendBooking } = await supabase.from('intros_booked').insert({
          member_name: friendFullName,
          class_date: classDate,
          intro_time: classTime || null,
          class_start_at: classStartAt,
          coach_name: coach,
          lead_source: friendLeadSource,
          sa_working_shift: shiftLabel,
          booked_by: saName,
          intro_owner: saName,
          intro_owner_locked: false,
          phone: friendPhone.trim() || null,
          booking_type_canon: 'STANDARD',
          booking_status_canon: 'ACTIVE',
          questionnaire_status_canon: 'not_sent',
          is_vip: false,
          paired_booking_id: inserted.id,
          originating_booking_id: inserted.id,
        }).select('id').single();

        if (friendBooking?.id) {
          await Promise.all([
            supabase.from('intros_booked').update({ paired_booking_id: friendBooking.id }).eq('id', inserted.id),
            supabase.from('referrals').insert({
              referrer_name: memberName,
              referred_name: friendFullName,
              referrer_booking_id: inserted.id,
              referred_booking_id: friendBooking.id,
              discount_applied: false,
            }),
          ]);

          const fNameParts = friendFullName.split(' ');
          try {
            const slug = await generateUniqueSlug(fNameParts[0], fNameParts.slice(1).join(' '), supabase);
            await supabase.from('intro_questionnaires').insert({
              booking_id: friendBooking.id,
              client_first_name: fNameParts[0],
              client_last_name: fNameParts.slice(1).join(' ') || '',
              scheduled_class_date: classDate,
              scheduled_class_time: classTime || null,
              status: 'not_sent',
              slug,
            } as any);
          } catch {}

          toast.success(`${memberName} + ${friendFullName} booked for ${format(new Date(classDate + 'T12:00:00'), 'MMM d')}.`);
        } else {
          toast.success(`${memberName} booked for ${format(new Date(classDate + 'T12:00:00'), 'MMM d')}.`);
        }
      } else {
        toast.success(`${memberName} booked for ${format(new Date(classDate + 'T12:00:00'), 'MMM d')}.`);
      }

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
              <Input id="book-first" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="book-last">Last Name <span className="text-destructive">*</span></Label>
              <Input id="book-last" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last" />
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="book-phone">Phone <span className="text-destructive">*</span></Label>
            <Input id="book-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 555-5555" />
          </div>

          {/* Class Date */}
          <div className="space-y-1.5">
            <Label htmlFor="book-date">Class Date <span className="text-destructive">*</span></Label>
            <Input id="book-date" type="date" value={classDate} onChange={e => setClassDate(e.target.value)} />
          </div>

          {/* Class Time */}
          <div className="space-y-1.5">
            <Label htmlFor="book-time">Class Time <span className="text-destructive">*</span></Label>
            <Input id="book-time" type="time" value={classTime} onChange={e => setClassTime(e.target.value)} />
          </div>

          {/* Coach */}
          <div className="space-y-1.5">
            <Label>Coach <span className="text-destructive">*</span></Label>
            <Select value={coach} onValueChange={setCoach}>
              <SelectTrigger><SelectValue placeholder="Select coach..." /></SelectTrigger>
              <SelectContent>{COACHES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Lead Source */}
          <div className="space-y-1.5">
            <Label>Lead Source <span className="text-destructive">*</span></Label>
            <Select value={leadSource} onValueChange={handleLeadSourceChange}>
              <SelectTrigger><SelectValue placeholder="Select source..." /></SelectTrigger>
              <SelectContent>{LEAD_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* ── Who Referred Them? (Member Referral only) ── */}
          {leadSource === 'Member Referral' && (
            <div className="space-y-1.5">
              <Label htmlFor="book-referred-by">Who referred them?</Label>
              <Input id="book-referred-by" value={referredBy} onChange={e => setReferredBy(e.target.value)} placeholder="Referring member's name" />
            </div>
          )}

          {/* ── Inline Friend Prompt (referral sources only) ── */}
          {showFriendPrompt && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="w-4 h-4 text-primary" />
                👥 Did they bring a friend?
              </div>
              {friendAnswer === null && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 border-primary text-primary" onClick={() => setFriendAnswer('yes')}>
                    Yes — add friend details
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setFriendAnswer('no')}>
                    No
                  </Button>
                </div>
              )}
              {friendAnswer === 'yes' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Friend's First Name <span className="text-destructive">*</span></Label>
                      <Input value={friendFirstName} onChange={e => setFriendFirstName(e.target.value)} placeholder="First" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Last Name</Label>
                      <Input value={friendLastName} onChange={e => setFriendLastName(e.target.value)} placeholder="Last" className="h-8 text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Phone (optional)</Label>
                    <Input type="tel" value={friendPhone} onChange={e => setFriendPhone(e.target.value)} placeholder="(555) 555-5555" className="h-8 text-sm" />
                  </div>
                  <Button size="sm" variant="ghost" className="text-xs text-muted-foreground h-6" onClick={() => { setFriendAnswer('no'); setFriendFirstName(''); setFriendLastName(''); setFriendPhone(''); }}>
                    ✕ Remove friend
                  </Button>
                </div>
              )}
              {friendAnswer === 'no' && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">No friend — booking for one person.</span>
                  <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => setFriendAnswer(null)}>Change</Button>
                </div>
              )}
            </div>
          )}

          {/* SA (read-only) */}
          <div className="space-y-1.5">
            <Label>SA (auto-filled)</Label>
            <Input value={user?.name || ''} disabled className="bg-muted" />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
            {saving ? 'Booking...' : (friendAnswer === 'yes' && friendFirstName.trim() ? 'Book Both Intros' : 'Book Intro')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
