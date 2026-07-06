import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, Users } from 'lucide-react';
import otfLogo from '@/assets/otf-logo.jpg';
import { z } from 'zod';

const OTF_ORANGE = '#FF6900';

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const digits = (s: string) => s.replace(/\D/g, '');

const schema = z.object({
  memberName: z.string().trim().min(2, 'Your name is required').max(100),
  memberContact: z.string().trim().min(7, 'Your phone or email is required').max(255)
    .refine(v => isEmail(v) || digits(v).length >= 10, 'Enter a valid phone or email'),
  friendFirst: z.string().trim().min(1, 'Friend\u2019s first name is required').max(60),
  friendLast: z.string().trim().min(1, 'Friend\u2019s last name is required').max(60),
  friendPhone: z.string().trim().refine(v => digits(v).length === 10, 'Enter a 10-digit phone'),
  friendEmail: z.string().trim().email('Enter a valid email').max(255),
});

export default function BuddyCard() {
  const [memberName, setMemberName] = useState('');
  const [memberContact, setMemberContact] = useState('');
  const [friendFirst, setFriendFirst] = useState('');
  const [friendLast, setFriendLast] = useState('');
  const [friendPhone, setFriendPhone] = useState('');
  const [friendEmail, setFriendEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const parsed = schema.safeParse({
      memberName, memberContact, friendFirst, friendLast, friendPhone, friendEmail,
    });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      parsed.error.errors.forEach(err => { if (err.path[0]) fe[err.path[0] as string] = err.message; });
      setErrors(fe);
      return;
    }
    setSubmitting(true);
    try {
      const normalizedPhone = digits(friendPhone);
      const { data: lead, error } = await (supabase as any)
        .from('leads')
        .insert({
          first_name: friendFirst.trim(),
          last_name: friendLast.trim(),
          phone: normalizedPhone,
          email: friendEmail.trim(),
          source: 'Member Referral',
          stage: 'new',
          sourced_by_sa: 'Buddy Card',
          is_buddy_card: true,
          referred_by_member_name: memberName.trim(),
          referring_member_contact: memberContact.trim(),
        })
        .select('id')
        .single();
      if (error) throw error;

      await (supabase as any).from('lead_activities').insert({
        lead_id: lead.id,
        activity_type: 'note',
        performed_by: 'Buddy Card',
        notes: `Buddy Card submitted by ${memberName.trim()} (${memberContact.trim()}). $50 off owed on sale.`,
      });

      await (supabase as any).from('notifications').insert({
        notification_type: 'buddy_card_new',
        title: 'New Buddy Card lead',
        body: `${friendFirst.trim()} ${friendLast.trim()} \u2014 referred by ${memberName.trim()}`,
        meta: { lead_id: lead.id, referring_member: memberName.trim(), referring_contact: memberContact.trim() },
      });

      setSubmitted(true);
    } catch (err) {
      console.error('Buddy card submit failed', err);
      setErrors({ submit: 'Something went wrong. Try again in a sec.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#FDF7EA] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-5">
          <CheckCircle className="w-16 h-16 mx-auto" style={{ color: OTF_ORANGE }} />
          <h1 className="text-3xl font-bold">You're the best.</h1>
          <p className="text-lg text-[#D7D7D7]">
            We'll reach out to {friendFirst}. When they sign up for a membership,
            you get <span style={{ color: OTF_ORANGE }} className="font-bold">$50 off</span> your next month.
          </p>
          <p className="text-sm text-[#D7D7D7]/70">
            Want to send us another? Refresh to submit again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#FDF7EA] p-6">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex flex-col items-center gap-3 pt-6">
          <img src={otfLogo} alt="Orangetheory Tuscaloosa" className="w-20 h-20 rounded-lg object-cover" />
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" style={{ color: OTF_ORANGE }} />
            <span className="text-sm uppercase tracking-widest" style={{ color: OTF_ORANGE }}>
              Bring a Buddy
            </span>
          </div>
          <h1 className="text-3xl font-bold text-center leading-tight">
            Give us a friend.<br />Get $50 off.
          </h1>
          <p className="text-sm text-[#D7D7D7] text-center">
            Drop their name and we'll reach out. When they sign up for a membership,
            your next month is $50 off. Simple.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="space-y-4 rounded-lg border border-[#D7D7D7]/20 p-4">
            <p className="text-xs uppercase tracking-wider text-[#D7D7D7]/80">About you</p>

            <div>
              <Label htmlFor="memberName" className="text-[#FDF7EA]">Your full name</Label>
              <Input
                id="memberName"
                value={memberName}
                onChange={e => setMemberName(e.target.value)}
                placeholder="Jane Smith"
                className="mt-1 bg-[#0A0A0A] border-[#D7D7D7]/30 text-[#FDF7EA] h-12"
                autoComplete="name"
              />
              {errors.memberName && <p className="text-xs text-red-400 mt-1">{errors.memberName}</p>}
            </div>

            <div>
              <Label htmlFor="memberContact" className="text-[#FDF7EA]">Your phone or email</Label>
              <Input
                id="memberContact"
                value={memberContact}
                onChange={e => setMemberContact(e.target.value)}
                placeholder="So we know who to credit the $50 to"
                className="mt-1 bg-[#0A0A0A] border-[#D7D7D7]/30 text-[#FDF7EA] h-12"
              />
              {errors.memberContact && <p className="text-xs text-red-400 mt-1">{errors.memberContact}</p>}
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-[#D7D7D7]/20 p-4">
            <p className="text-xs uppercase tracking-wider text-[#D7D7D7]/80">Your friend</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="friendFirst" className="text-[#FDF7EA]">First name</Label>
                <Input
                  id="friendFirst"
                  value={friendFirst}
                  onChange={e => setFriendFirst(e.target.value)}
                  className="mt-1 bg-[#0A0A0A] border-[#D7D7D7]/30 text-[#FDF7EA] h-12"
                />
                {errors.friendFirst && <p className="text-xs text-red-400 mt-1">{errors.friendFirst}</p>}
              </div>
              <div>
                <Label htmlFor="friendLast" className="text-[#FDF7EA]">Last name</Label>
                <Input
                  id="friendLast"
                  value={friendLast}
                  onChange={e => setFriendLast(e.target.value)}
                  className="mt-1 bg-[#0A0A0A] border-[#D7D7D7]/30 text-[#FDF7EA] h-12"
                />
                {errors.friendLast && <p className="text-xs text-red-400 mt-1">{errors.friendLast}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="friendPhone" className="text-[#FDF7EA]">Their phone</Label>
              <Input
                id="friendPhone"
                type="tel"
                inputMode="tel"
                value={friendPhone}
                onChange={e => setFriendPhone(e.target.value)}
                placeholder="(205) 555-1234"
                className="mt-1 bg-[#0A0A0A] border-[#D7D7D7]/30 text-[#FDF7EA] h-12"
              />
              {errors.friendPhone && <p className="text-xs text-red-400 mt-1">{errors.friendPhone}</p>}
            </div>

            <div>
              <Label htmlFor="friendEmail" className="text-[#FDF7EA]">Their email</Label>
              <Input
                id="friendEmail"
                type="email"
                inputMode="email"
                value={friendEmail}
                onChange={e => setFriendEmail(e.target.value)}
                className="mt-1 bg-[#0A0A0A] border-[#D7D7D7]/30 text-[#FDF7EA] h-12"
              />
              {errors.friendEmail && <p className="text-xs text-red-400 mt-1">{errors.friendEmail}</p>}
            </div>
          </div>

          <p className="text-xs text-[#D7D7D7]/70 text-center">
            Heads up: we'll text them from our studio number. Only submit friends who'd actually
            want the message.
          </p>

          {errors.submit && (
            <p className="text-sm text-red-400 text-center">{errors.submit}</p>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-14 text-base font-bold text-black hover:opacity-90"
            style={{ backgroundColor: OTF_ORANGE }}
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending\u2026</>
            ) : (
              'Send it over'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
