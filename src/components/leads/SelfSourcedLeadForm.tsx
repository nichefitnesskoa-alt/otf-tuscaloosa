/**
 * SelfSourcedLeadForm — canonical form for logging a lead an SA personally
 * sourced. Used by MyDay's SelfSourcedLeadEntry card AND by the WIG
 * "+ Add Lead" dialog so both surfaces write identical rows (with
 * `sourced_by_sa`) and refresh the same query keys.
 */
import { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Info } from 'lucide-react';
import { toast } from 'sonner';
import { formatPhoneAsYouType, autoCapitalizeName } from '@/components/shared/FormHelpers';
import { BookIntroDialog } from '@/components/leads/BookIntroDialog';
import { notifyDataChanged } from '@/lib/data/invalidation';
import { isSelfSourcedLeadSource, isReferralLikeSource } from '@/lib/sa/leadsBooked';
import { LEAD_SOURCES } from '@/types';
import type { Tables } from '@/integrations/supabase/types';

/** Extra sources allowed on the log-a-lead form that aren't in the canonical
 *  intro-booking LEAD_SOURCES list. Kept for backwards compatibility with how
 *  SAs described self-sourced leads before the canon list existed. */
const FORM_ONLY_EXTRA_SOURCES = ['Walk-in', 'Event', 'Cold Lead Re-engagement', 'Manual Entry'] as const;

const CANON_SOURCES = LEAD_SOURCES.filter(isSelfSourcedLeadSource);
const REFERRAL_SOURCES = CANON_SOURCES.filter(isReferralLikeSource);
const OTHER_CANON_SOURCES = CANON_SOURCES.filter(s => !isReferralLikeSource(s));

export const SELF_SOURCED_OPTIONS = [
  ...REFERRAL_SOURCES,
  ...OTHER_CANON_SOURCES,
  ...FORM_ONLY_EXTRA_SOURCES,
] as const;

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const digits = (s: string) => s.replace(/\D/g, '');

interface Props {
  onSaved?: () => void;
  allowBookIntro?: boolean;
}

export function SelfSourcedLeadForm({ onSaved, allowBookIntro = true }: Props) {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState<string>('Member Referral');
  const [referrerName, setReferrerName] = useState('');
  const [referrerContact, setReferrerContact] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedLead, setSavedLead] = useState<Tables<'leads'> | null>(null);
  const [bookOpen, setBookOpen] = useState(false);

  const needsReferrer = useMemo(() => isReferralLikeSource(source), [source]);

  const reset = () => {
    setFirstName(''); setLastName(''); setPhone(''); setEmail('');
    setSource('Member Referral'); setReferrerName(''); setReferrerContact('');
    setSavedLead(null);
  };

  const submit = async (alsoBook: boolean) => {
    if (!user?.name) {
      toast.error('You need to be signed in to log a lead');
      return;
    }
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      toast.error('First name, last name, and phone are required');
      return;
    }
    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!isEmail(email.trim())) {
      toast.error('Enter a valid email');
      return;
    }
    if (!isSelfSourcedLeadSource(source)) {
      toast.error('That source counts as inbound — log it through the normal booking flow.');
      return;
    }
    if (needsReferrer) {
      if (!referrerName.trim() || referrerName.trim().length < 2) {
        toast.error("Who referred them? Add the referring member's name.");
        return;
      }
      const contact = referrerContact.trim();
      if (!contact || (!isEmail(contact) && digits(contact).length < 10)) {
        toast.error("Add the referring member's phone or email so we can credit them.");
        return;
      }
    }

    setSaving(true);
    try {
      const { data: lead, error } = await supabase
        .from('leads')
        .insert({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          source,
          stage: 'new',
          sourced_by_sa: user.name,
          referred_by_member_name: needsReferrer ? referrerName.trim() : null,
          referring_member_contact: needsReferrer ? referrerContact.trim() : null,
        } as any)
        .select('*')
        .single();
      if (error) throw error;

      await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        activity_type: 'note',
        performed_by: user.name,
        notes: needsReferrer
          ? `Logged as self-sourced by ${user.name}. Referred by ${referrerName.trim()} (${referrerContact.trim()}).`
          : `Logged as self-sourced by ${user.name}`,
      });

      // If this lead is a referral, credit the sourcing SA on the SOML
      // scoreboard immediately (before/without an intro being booked).
      if (needsReferrer) {
        const memberName = `${firstName.trim()} ${lastName.trim()}`;
        const { error: somlErr } = await (supabase as any)
          .from('soml_manual_referrals')
          .insert({
            member_name: memberName,
            referring_member_name: referrerName.trim(),
            referred_by: user.name,
            notes: `Auto-logged from self-sourced lead (${source})`,
            created_by: user.name,
          });
        if (somlErr) console.warn('SOML manual referral auto-log failed (non-blocking):', somlErr);
        window.dispatchEvent(new CustomEvent('soml-data-changed'));
      }

      toast.success(alsoBook ? 'Lead saved — book the intro' : 'Lead logged');
      notifyDataChanged(['leads', 'sa-leads']);

      if (alsoBook) {
        setSavedLead(lead as Tables<'leads'>);
        setBookOpen(true);
      } else {
        reset();
        onSaved?.();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to log lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] leading-snug">
          <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <span>
            Only log leads <strong>you personally sourced</strong>. Do not log
            inbound leads (lead management, online intro offer). Those count
            for you when you book them through the normal flow.
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">First name *</Label>
            <Input
              value={firstName}
              onChange={e => setFirstName(autoCapitalizeName(e.target.value))}
              className="h-10"
            />
          </div>
          <div>
            <Label className="text-xs">Last name *</Label>
            <Input
              value={lastName}
              onChange={e => setLastName(autoCapitalizeName(e.target.value))}
              className="h-10"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Phone *</Label>
          <Input
            type="tel"
            value={phone}
            onChange={e => setPhone(formatPhoneAsYouType(e.target.value))}
            placeholder="(555) 123-4567"
            className="h-10"
          />
        </div>
        <div>
          <Label className="text-xs">Email</Label>
          <Input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="h-10"
          />
        </div>
        <div>
          <Label className="text-xs">How you got them *</Label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Referrals &amp; Friends</SelectLabel>
                {REFERRAL_SOURCES.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Other sources</SelectLabel>
                {OTHER_CANON_SOURCES.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
                {FORM_ONLY_EXTRA_SOURCES.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {needsReferrer && (
          <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs font-semibold">This person was referred — who sent them?</p>
            <div>
              <Label className="text-xs">Referring member's full name *</Label>
              <Input
                value={referrerName}
                onChange={e => setReferrerName(autoCapitalizeName(e.target.value))}
                placeholder="Jane Smith"
                className="h-10"
              />
            </div>
            <div>
              <Label className="text-xs">Referring member's phone or email *</Label>
              <Input
                value={referrerContact}
                onChange={e => setReferrerContact(e.target.value)}
                placeholder="(205) 555-1234 or jane@email.com"
                className="h-10"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                So we know who to credit when the referral converts.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <Button
            className="flex-1 min-h-[44px]"
            onClick={() => submit(false)}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save lead'}
          </Button>
          {allowBookIntro && (
            <Button
              variant="outline"
              className="flex-1 min-h-[44px]"
              onClick={() => submit(true)}
              disabled={saving}
            >
              Save and book intro
            </Button>
          )}
        </div>
      </div>

      {savedLead && (
        <BookIntroDialog
          open={bookOpen}
          onOpenChange={(o) => {
            setBookOpen(o);
            if (!o) { reset(); onSaved?.(); }
          }}
          lead={savedLead}
          onDone={() => {
            notifyDataChanged(['leads', 'intros_booked', 'sa-leads', 'sa-all-booked']);
            setBookOpen(false);
            reset();
            onSaved?.();
          }}
        />
      )}
    </>
  );
}
