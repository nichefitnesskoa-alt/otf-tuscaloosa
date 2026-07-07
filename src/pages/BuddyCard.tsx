import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle } from 'lucide-react';
import otfLogoAsset from '@/assets/otf-logo-orange.png.asset.json';
import { z } from 'zod';

const OTF_ORANGE = '#FF6F0D';
const OTF_BONE = '#FDF7EA';
const OTF_DARK = '#0A0A0A';
const BRAND_FONT = "'PP Right Grotesk', 'Arial Black', 'Helvetica Neue', Arial, sans-serif";

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

const inputCls =
  'mt-2 h-12 rounded-none border-0 border-b bg-transparent px-0 text-[15px] tracking-[-0.01em] ' +
  'text-[#FDF7EA] placeholder:text-[#FDF7EA]/30 focus-visible:ring-0 focus-visible:ring-offset-0 ' +
  'focus-visible:border-[#FF6F0D] transition-colors';
const inputStyle = { borderBottomColor: 'rgba(253,247,234,0.25)' } as React.CSSProperties;
const labelCls = 'text-[11px] uppercase tracking-[0.18em] text-[#FDF7EA]/70 font-medium';
const sectionLabelCls = 'text-[10px] uppercase tracking-[0.28em] text-[#FF6F0D] font-bold';

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
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ backgroundColor: OTF_DARK, color: OTF_BONE, fontFamily: BRAND_FONT, letterSpacing: '-0.02em' }}
      >
        <div className="max-w-md w-full text-center space-y-6">
          <CheckCircle className="w-16 h-16 mx-auto" style={{ color: OTF_ORANGE }} strokeWidth={1.5} />
          <h1 className="text-5xl font-bold leading-[0.95]">You're the best.</h1>
          <p className="text-lg text-[#FDF7EA]/80 leading-snug">
            We'll reach out to {friendFirst}. When they sign up,
            you get <span style={{ color: OTF_ORANGE }} className="font-bold">$50 off</span> your next month.
          </p>
          <p className="text-xs uppercase tracking-[0.2em] text-[#FDF7EA]/50">
            Refresh to send another
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: OTF_DARK, color: OTF_BONE, fontFamily: BRAND_FONT, letterSpacing: '-0.02em' }}
    >
      <div className="max-w-md mx-auto px-6 pt-10 pb-16">
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-5">
          <img
            src={otfLogoAsset.url}
            alt="Orangetheory Fitness Tuscaloosa"
            className="h-12 w-auto object-contain"
          />
          <div className={sectionLabelCls}>Bring a Buddy</div>
          <h1 className="text-[44px] leading-[0.92] font-bold">
            Give us a friend.
            <br />
            <span style={{ color: OTF_ORANGE }}>Get $50 off.</span>
          </h1>
          <p className="text-[15px] text-[#FDF7EA]/75 leading-snug max-w-sm">
            Drop their name and we'll reach out. When they sign up for a membership,
            your next month is $50 off.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-10 space-y-10">
          {/* About you */}
          <section className="space-y-5">
            <div className="flex items-center gap-3">
              <span className={sectionLabelCls}>01 · About You</span>
              <div className="h-px flex-1" style={{ backgroundColor: 'rgba(253,247,234,0.15)' }} />
            </div>

            <div>
              <Label htmlFor="memberName" className={labelCls}>Your full name</Label>
              <Input
                id="memberName"
                value={memberName}
                onChange={e => setMemberName(e.target.value)}
                placeholder="Jane Smith"
                className={inputCls}
                style={inputStyle}
                autoComplete="name"
              />
              {errors.memberName && <p className="text-xs text-red-400 mt-2">{errors.memberName}</p>}
            </div>

            <div>
              <Label htmlFor="memberContact" className={labelCls}>Your phone or email</Label>
              <Input
                id="memberContact"
                value={memberContact}
                onChange={e => setMemberContact(e.target.value)}
                placeholder="So we know who to credit"
                className={inputCls}
                style={inputStyle}
              />
              {errors.memberContact && <p className="text-xs text-red-400 mt-2">{errors.memberContact}</p>}
            </div>
          </section>

          {/* Your friend */}
          <section className="space-y-5">
            <div className="flex items-center gap-3">
              <span className={sectionLabelCls}>02 · Your Friend</span>
              <div className="h-px flex-1" style={{ backgroundColor: 'rgba(253,247,234,0.15)' }} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="friendFirst" className={labelCls}>First name</Label>
                <Input
                  id="friendFirst"
                  value={friendFirst}
                  onChange={e => setFriendFirst(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                />
                {errors.friendFirst && <p className="text-xs text-red-400 mt-2">{errors.friendFirst}</p>}
              </div>
              <div>
                <Label htmlFor="friendLast" className={labelCls}>Last name</Label>
                <Input
                  id="friendLast"
                  value={friendLast}
                  onChange={e => setFriendLast(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                />
                {errors.friendLast && <p className="text-xs text-red-400 mt-2">{errors.friendLast}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="friendPhone" className={labelCls}>Their phone</Label>
              <Input
                id="friendPhone"
                type="tel"
                inputMode="tel"
                value={friendPhone}
                onChange={e => setFriendPhone(e.target.value)}
                placeholder="(205) 555-1234"
                className={inputCls}
                style={inputStyle}
              />
              {errors.friendPhone && <p className="text-xs text-red-400 mt-2">{errors.friendPhone}</p>}
            </div>

            <div>
              <Label htmlFor="friendEmail" className={labelCls}>Their email</Label>
              <Input
                id="friendEmail"
                type="email"
                inputMode="email"
                value={friendEmail}
                onChange={e => setFriendEmail(e.target.value)}
                className={inputCls}
                style={inputStyle}
              />
              {errors.friendEmail && <p className="text-xs text-red-400 mt-2">{errors.friendEmail}</p>}
            </div>
          </section>

          <p className="text-[11px] uppercase tracking-[0.15em] text-[#FDF7EA]/50 text-center leading-relaxed">
            We'll text them from our studio number.
            <br />
            Please let your friend know you recommended them to reach out.
            <br />
            Only send friends who'd want to hear from us.
          </p>

          {errors.submit && (
            <p className="text-sm text-red-400 text-center">{errors.submit}</p>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-14 text-base font-bold tracking-[-0.01em] rounded-none hover:opacity-90 transition-opacity"
            style={{ backgroundColor: OTF_ORANGE, color: OTF_DARK, fontFamily: BRAND_FONT }}
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending&hellip;</>
            ) : (
              'Send it over'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
