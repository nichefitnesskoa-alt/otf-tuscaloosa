/**
 * BookIntroSheet – Schedule an intro for any future (or same-day) date.
 * Supports "Reschedule existing member" mode that searches intros_booked,
 * pre-fills fields, and links the new booking to the original.
 */
import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { VipSessionPicker } from '@/components/shared/VipSessionPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NameAutocomplete } from '@/components/shared/NameAutocomplete';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { autoComplete2ndIntroFollowups } from '@/lib/domain/outcomes/autoComplete2ndIntroFollowups';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { COACHES, LEAD_SOURCES } from '@/types';
import { Users, Search, X } from 'lucide-react';
import { generateUniqueSlug } from '@/lib/utils';
import { ClassTimeSelect, DatePickerField, formatPhoneAsYouType, autoCapitalizeName } from '@/components/shared/FormHelpers';

interface BookIntroSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  prefillFirstName?: string;
  prefillLastName?: string;
  prefillPhone?: string;
  prefillLeadSource?: string;
  prefillVipSessionId?: string;
  prefillCoach?: string;
}

const REFERRAL_SOURCES = new Set([
  'Member Referral',
  'Lead Management (Friend)',
  'Instagram DMs (Friend)',
  'My Personal Friend I Invited',
  'VIP Class (Friend)',
]);

interface SearchResult {
  id: string;
  member_name: string;
  phone: string | null;
  lead_source: string;
  coach_name: string;
  class_date: string;
  booking_status_canon: string;
  intro_owner: string | null;
  intro_owner_locked: boolean | null;
  vip_session_id: string | null;
  originating_booking_id: string | null;
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
  const [vipSessionId, setVipSessionId] = useState('');

  // Inline friend state
  const [friendAnswer, setFriendAnswer] = useState<'yes' | 'no' | null>(null);
  const [friendFirstName, setFriendFirstName] = useState('');
  const [friendLastName, setFriendLastName] = useState('');
  const [friendPhone, setFriendPhone] = useState('');
  const [referredBy, setReferredBy] = useState('');

  // Reschedule mode state
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [rescheduleSearch, setRescheduleSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);

  const showFriendPrompt = !!leadSource && !rescheduleMode;

  const reset = () => {
    setFirstName(''); setLastName(''); setPhone('');
    setClassDate(format(new Date(), 'yyyy-MM-dd')); setClassTime('');
    setCoach(''); setLeadSource(''); setVipSessionId('');
    setFriendAnswer(null); setFriendFirstName(''); setFriendLastName(''); setFriendPhone('');
    setReferredBy('');
    setRescheduleMode(false); setRescheduleSearch(''); setSearchResults([]); setSelectedBooking(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleLeadSourceChange = (val: string) => {
    setLeadSource(val);
    if (!val.toLowerCase().includes('vip')) setVipSessionId('');
    setFriendAnswer(null);
    setFriendFirstName(''); setFriendLastName(''); setFriendPhone('');
    setReferredBy('');
  };

  // Search for existing members
  const doSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data } = await supabase
        .from('intros_booked')
        .select('id, member_name, phone, lead_source, coach_name, class_date, booking_status_canon, intro_owner, intro_owner_locked, vip_session_id, originating_booking_id')
        .ilike('member_name', `%${query.trim()}%`)
        .is('deleted_at', null)
        .order('class_date', { ascending: false })
        .limit(15);

      // Deduplicate by member_name — keep only the most recent booking per person
      const seen = new Map<string, SearchResult>();
      for (const row of (data || [])) {
        const key = row.member_name.toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, row as SearchResult);
        }
      }
      setSearchResults(Array.from(seen.values()));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (!rescheduleMode || selectedBooking) return;
    const timer = setTimeout(() => doSearch(rescheduleSearch), 300);
    return () => clearTimeout(timer);
  }, [rescheduleSearch, rescheduleMode, selectedBooking, doSearch]);

  const handleSelectBooking = (booking: SearchResult) => {
    setSelectedBooking(booking);
    setSearchResults([]);
    setRescheduleSearch('');
    // Pre-fill fields
    const nameParts = booking.member_name.split(' ');
    setFirstName(nameParts[0] || '');
    setLastName(nameParts.slice(1).join(' ') || '');
    setPhone(booking.phone ? formatPhoneAsYouType(booking.phone) : '');
    setLeadSource(booking.lead_source || '');
    setCoach(booking.coach_name || '');
    // Auto-pull VIP session if the original booking was VIP
    if (booking.vip_session_id && booking.lead_source?.toLowerCase().includes('vip')) {
      setVipSessionId(booking.vip_session_id);
    }
  };

  const handleClearSelection = () => {
    setSelectedBooking(null);
    setFirstName(''); setLastName(''); setPhone('');
    setLeadSource(''); setCoach('');
  };

  const handleToggleReschedule = (checked: boolean) => {
    setRescheduleMode(checked);
    if (!checked) {
      setSelectedBooking(null);
      setRescheduleSearch('');
      setSearchResults([]);
      setFirstName(''); setLastName(''); setPhone('');
      setLeadSource(''); setCoach('');
    }
  };

  const statusLabel = (canon: string) => {
    switch (canon) {
      case 'ACTIVE': return 'Active';
      case 'SHOWED': return 'Showed';
      case 'NO_SHOW': return 'No-Show';
      case 'CANCELLED': return 'Cancelled';
      default: return canon;
    }
  };

  const handleSave = async () => {
    if (!firstName.trim()) { toast.error('First name is required'); return; }
    if (!lastName.trim()) { toast.error('Last name is required'); return; }
    if (!phone.trim()) { toast.error('Phone number is required'); return; }
    if (!classDate) { toast.error('Class date is required'); return; }
    if (!classTime) { toast.error('Class time is required'); return; }
    if (!coach) { toast.error('Coach is required'); return; }
    if (!leadSource) { toast.error('Lead source is required'); return; }
    if (leadSource === 'VIP Class' && !vipSessionId) { toast.error('Please select which VIP class'); return; }

    setSaving(true);
    try {
      const memberName = `${firstName.trim()} ${lastName.trim()}`;
      const saName = user?.name || '';
      const classStartAt = classTime ? `${classDate}T${classTime}:00` : null;

      const h = new Date().getHours();
      const shiftLabel = h < 11 ? 'AM Shift' : h < 16 ? 'Mid Shift' : 'PM Shift';

      const rebookedFromId = selectedBooking?.id || null;

      const { data: inserted, error } = await supabase.from('intros_booked').insert({
        member_name: memberName,
        class_date: classDate,
        intro_time: classTime || null,
        class_start_at: classStartAt,
        coach_name: coach,
        lead_source: leadSource,
        sa_working_shift: shiftLabel,
        booked_by: saName,
        intro_owner: selectedBooking?.intro_owner || saName,
        intro_owner_locked: selectedBooking?.intro_owner_locked || false,
        phone: phone.trim() || null,
        booking_type_canon: 'STANDARD',
        booking_status_canon: 'ACTIVE',
        questionnaire_status_canon: 'not_sent',
        is_vip: false,
        referred_by_member_name: REFERRAL_SOURCES.has(leadSource) ? (referredBy.trim() || null) : null,
        vip_session_id: leadSource.toLowerCase().includes('vip') ? (vipSessionId || null) : null,
        rebooked_from_booking_id: rebookedFromId,
        originating_booking_id: selectedBooking ? (selectedBooking.originating_booking_id || selectedBooking.id) : null,
        rebook_reason: rebookedFromId ? 'Rescheduled from My Day' : null,
      }).select('id').single();

      if (error) throw error;

      // Auto-complete pending follow-ups for the original booking
      if (rebookedFromId) {
        await supabase
          .from('follow_up_queue')
          .update({ status: 'completed', sent_by: `${saName} (Rescheduled)` })
          .eq('booking_id', rebookedFromId)
          .eq('status', 'pending');
      }

      // Auto-complete any "Planning 2nd Intro" follow-ups for this member
      if (inserted?.id) {
        autoComplete2ndIntroFollowups(memberName).catch(() => {});
      }

      // Insert referral record if referred by someone (non-reschedule only)
      if (inserted?.id && !rebookedFromId && REFERRAL_SOURCES.has(leadSource) && referredBy.trim()) {
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

      // Handle inline friend booking (only in non-reschedule mode)
      if (!rebookedFromId && inserted?.id && friendAnswer === 'yes' && friendFirstName.trim()) {
        const friendFullName = `${friendFirstName.trim()} ${friendLastName.trim()}`.trim();
        const friendLeadSource = leadSource.includes('(Friend)') ? leadSource : `${leadSource} (Friend)`;

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
          referred_by_member_name: memberName,
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
        const action = rebookedFromId ? 'rescheduled' : 'booked';
        toast.success(`${memberName} ${action} for ${format(new Date(classDate + 'T12:00:00'), 'MMM d')}.`);
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
          <SheetTitle>{rescheduleMode ? 'Reschedule an Intro' : 'Book an Intro'}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pb-4">
          {/* Reschedule toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="reschedule-toggle" className="text-sm font-medium cursor-pointer">
              Reschedule existing member
            </Label>
            <Switch
              id="reschedule-toggle"
              checked={rescheduleMode}
              onCheckedChange={handleToggleReschedule}
            />
          </div>

          {/* Reschedule search */}
          {rescheduleMode && !selectedBooking && (
            <div className="space-y-2">
              <Label>Search member name</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={rescheduleSearch}
                  onChange={e => setRescheduleSearch(e.target.value)}
                  placeholder="Type a name..."
                  className="pl-9"
                  autoFocus
                />
              </div>
              {searching && <p className="text-xs text-muted-foreground">Searching...</p>}
              {searchResults.length > 0 && (
                <div className="rounded-md border max-h-48 overflow-y-auto">
                  {searchResults.map(r => (
                    <button
                      key={r.id}
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between gap-2 border-b last:border-b-0"
                      onClick={() => handleSelectBooking(r)}
                    >
                      <span className="font-medium">{r.member_name}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {statusLabel(r.booking_status_canon)}
                        </Badge>
                        {format(new Date(r.class_date + 'T12:00:00'), 'MMM d')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Selected member chip */}
          {rescheduleMode && selectedBooking && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{selectedBooking.member_name}</p>
                <p className="text-xs text-muted-foreground">
                  Last intro: {format(new Date(selectedBooking.class_date + 'T12:00:00'), 'MMM d, yyyy')} · {statusLabel(selectedBooking.booking_status_canon)}
                  {selectedBooking.intro_owner && ` · Owner: ${selectedBooking.intro_owner}`}
                </p>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleClearSelection}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="book-first">First Name <span className="text-destructive">*</span></Label>
              <Input
                id="book-first"
                value={firstName}
                onChange={e => setFirstName(autoCapitalizeName(e.target.value))}
                placeholder="First"
                autoFocus={!rescheduleMode}
                disabled={rescheduleMode && !!selectedBooking}
                className={rescheduleMode && selectedBooking ? 'bg-muted' : ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="book-last">Last Name <span className="text-destructive">*</span></Label>
              <Input
                id="book-last"
                value={lastName}
                onChange={e => setLastName(autoCapitalizeName(e.target.value))}
                placeholder="Last"
                disabled={rescheduleMode && !!selectedBooking}
                className={rescheduleMode && selectedBooking ? 'bg-muted' : ''}
              />
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="book-phone">Phone <span className="text-destructive">*</span></Label>
            <Input id="book-phone" type="tel" value={phone} onChange={e => setPhone(formatPhoneAsYouType(e.target.value))} placeholder="(555) 555-5555" />
          </div>

          {/* Class Date */}
          <div className="space-y-1.5">
            <Label>Class Date <span className="text-destructive">*</span></Label>
            <DatePickerField value={classDate} onChange={setClassDate} />
          </div>

          {/* Class Time */}
          <div className="space-y-1.5">
            <Label>Class Time <span className="text-destructive">*</span></Label>
            <ClassTimeSelect value={classTime} onValueChange={setClassTime} />
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

          {/* VIP Session picker when VIP Class or VIP Class (Friend) is selected */}
          {leadSource.toLowerCase().includes('vip class') && (
            <VipSessionPicker value={vipSessionId} onValueChange={setVipSessionId} required={leadSource === 'VIP Class'} showWarning={leadSource === 'VIP Class'} />
          )}
          {REFERRAL_SOURCES.has(leadSource) && (
            <div className="space-y-1.5">
              <Label htmlFor="book-referred-by">Who referred them?</Label>
              <NameAutocomplete id="book-referred-by" value={referredBy} onChange={v => setReferredBy(autoCapitalizeName(v))} placeholder="Referring member's name" />
            </div>
          )}

          {/* ── Inline Friend Prompt (non-reschedule mode only) ── */}
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
                      <NameAutocomplete value={friendFirstName} onChange={v => setFriendFirstName(autoCapitalizeName(v))} placeholder="First" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Last Name</Label>
                      <Input value={friendLastName} onChange={e => setFriendLastName(autoCapitalizeName(e.target.value))} placeholder="Last" className="h-8 text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Phone (optional)</Label>
                    <Input type="tel" value={friendPhone} onChange={e => setFriendPhone(formatPhoneAsYouType(e.target.value))} placeholder="(555) 555-5555" className="h-8 text-sm" />
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
            {saving
              ? (rescheduleMode ? 'Rescheduling...' : 'Booking...')
              : rescheduleMode && selectedBooking
                ? 'Reschedule Intro'
                : (friendAnswer === 'yes' && friendFirstName.trim() ? 'Book Both Intros' : 'Book Intro')
            }
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
