/**
 * Public VIP Availability page — /vip-availability
 * Groups can view and claim available VIP session slots.
 * No auth required. OTF-branded.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
// Cast to avoid TS2589 with deeply nested generated types
const sb = supabase as any;
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, Calendar, Clock, Users } from 'lucide-react';
import { format } from 'date-fns';
import { formatDisplayTime } from '@/lib/time/timeUtils';

interface PublicSession {
  id: string;
  session_date: string;
  session_time: string;
  status: string;
  reserved_by_group: string | null;
  description: string | null;
}

export default function VipAvailability() {
  const [sessions, setSessions] = useState<PublicSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [raceError, setRaceError] = useState<string | null>(null);

  // Claim form fields
  const [name, setName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [groupSize, setGroupSize] = useState('');

  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchSessions = useCallback(async () => {
    const { data } = await sb
      .from('vip_sessions')
      .select('id, session_date, session_time, status, reserved_by_group, description')
      .eq('is_on_availability_page', true)
      .gte('session_date', today)
      .neq('status', 'cancelled')
      .order('session_date', { ascending: true })
      .order('session_time', { ascending: true });
    setSessions((data as any[]) || []);
    setLoading(false);
  }, [today]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('vip-availability')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vip_sessions' }, () => {
        fetchSessions();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchSessions]);

  const handleClaim = async (sessionId: string) => {
    if (!name.trim() || !groupName.trim() || !email.trim() || !phone.trim() || !groupSize.trim()) {
      return;
    }
    setSubmitting(true);
    setRaceError(null);

    try {
      // Race condition guard: re-check status before claiming
      const { data: current } = await sb
        .from('vip_sessions')
        .select('status')
        .eq('id', sessionId)
        .single();

      if (!current || (current as any).status !== 'open') {
        setRaceError('This slot was just claimed. Please choose another.');
        setSubmitting(false);
        setClaimingId(null);
        return;
      }

      // 1) Update session
      const { error: upErr } = await sb.from('vip_sessions').update({
        status: 'reserved',
        reserved_by_group: groupName.trim(),
        reserved_contact_name: name.trim(),
        reserved_contact_email: email.trim(),
        reserved_contact_phone: phone.trim(),
        estimated_group_size: parseInt(groupSize),
      } as any).eq('id', sessionId).eq('status', 'open');

      if (upErr) throw upErr;

      // 2) Create vip_registration
      await sb.from('vip_registrations').insert({
        vip_session_id: sessionId,
        full_name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
      } as any);

      // 3) Notification for staff
      const session = sessions.find(s => s.id === sessionId);
      const formattedDate = session ? format(new Date(session.session_date + 'T00:00:00'), 'MMM d') : '';
      const formattedTime = session ? formatDisplayTime(session.session_time) : '';

      await sb.from('notifications').insert({
        notification_type: 'vip_slot_claimed',
        title: `${groupName.trim()} claimed VIP slot`,
        body: `${groupName.trim()} claimed the ${formattedDate} ${formattedTime} VIP slot. ${groupSize} estimated attendees. Contact: ${name.trim()}`,
        target_user: null,
        meta: {
          session_id: sessionId,
          group_name: groupName.trim(),
          contact_name: name.trim(),
          contact_email: email.trim(),
          contact_phone: phone.trim(),
          estimated_size: parseInt(groupSize),
        },
      });

      setConfirmedId(sessionId);
      setClaimingId(null);
      setName('');
      setGroupName('');
      setEmail('');
      setPhone('');
      setGroupSize('');
    } catch (err: any) {
      console.error('Claim error:', err);
      setRaceError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-[#FF6900] text-white py-8 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold">OTF Tuscaloosa — Private Group Classes</h1>
          <p className="mt-2 text-sm opacity-90">
            We host free private fitness experiences for groups. Pick an available time below to claim your slot.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              No available sessions at this time. Check back soon!
            </CardContent>
          </Card>
        ) : (
          sessions.map(session => {
            const isOpen = session.status === 'open';
            const isReserved = session.status === 'reserved';
            const isClaiming = claimingId === session.id;
            const isConfirmed = confirmedId === session.id;

            return (
              <Card
                key={session.id}
                className={!isOpen ? 'opacity-70 bg-muted/30' : ''}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="font-semibold text-base flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        {format(new Date(session.session_date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDisplayTime(session.session_time)}
                      </div>
                      {session.description && (
                        <p className="text-sm text-muted-foreground mt-1">{session.description}</p>
                      )}
                    </div>
                    <div>
                      {isOpen && (
                        <Badge className="bg-green-600 text-white border-transparent">Available</Badge>
                      )}
                      {isReserved && (
                        <Badge className="bg-amber-500 text-white border-transparent">
                          Reserved by {session.reserved_by_group}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Confirmed message */}
                  {isConfirmed && (
                    <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center space-y-1">
                      <CheckCircle className="w-8 h-8 text-green-600 mx-auto" />
                      <p className="font-semibold text-green-700 dark:text-green-400">Your slot is confirmed!</p>
                      <p className="text-sm text-green-600 dark:text-green-500">
                        We'll be in touch with next steps and a link for your group members to fill out before class.
                      </p>
                    </div>
                  )}

                  {/* Race error */}
                  {raceError && !isClaiming && (
                    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
                      {raceError}
                    </div>
                  )}

                  {/* Claim button */}
                  {isOpen && !isClaiming && !isConfirmed && (
                    <Button
                      className="w-full h-11 bg-[#FF6900] hover:bg-[#e55f00] text-white font-semibold"
                      onClick={() => { setClaimingId(session.id); setRaceError(null); }}
                    >
                      Claim This Slot
                    </Button>
                  )}

                  {/* Claim form */}
                  {isClaiming && (
                    <div className="space-y-3 border rounded-lg p-4 bg-background">
                      <div className="space-y-1.5">
                        <Label>Your Name</Label>
                        <Input
                          value={name}
                          onChange={e => setName(e.target.value)}
                          placeholder="Jane Smith"
                          className="border h-11"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Group Name</Label>
                        <Input
                          value={groupName}
                          onChange={e => setGroupName(e.target.value)}
                          placeholder="e.g. Alpha Phi Sorority"
                          className="border h-11"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="jane@example.com"
                          className="border h-11"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Phone</Label>
                        <Input
                          type="tel"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          placeholder="(205) 555-1234"
                          className="border h-11"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Estimated Group Size</Label>
                        <Input
                          type="number"
                          min="1"
                          value={groupSize}
                          onChange={e => setGroupSize(e.target.value)}
                          placeholder="15"
                          className="border h-11"
                          required
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1 h-11"
                          onClick={() => { setClaimingId(null); setRaceError(null); }}
                          disabled={submitting}
                        >
                          Cancel
                        </Button>
                        <Button
                          className="flex-1 h-11 bg-[#FF6900] hover:bg-[#e55f00] text-white font-semibold"
                          onClick={() => handleClaim(session.id)}
                          disabled={submitting || !name.trim() || !groupName.trim() || !email.trim() || !phone.trim() || !groupSize.trim()}
                        >
                          {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                          Claim This Slot
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
