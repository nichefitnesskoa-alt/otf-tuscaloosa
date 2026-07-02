/**
 * SelfSourcedLeadForm — canonical form for logging a lead an SA personally
 * sourced. Used by MyDay's SelfSourcedLeadEntry card AND by the WIG
 * "+ Add Lead" dialog so both surfaces write identical rows (with
 * `sourced_by_sa`) and refresh the same query keys.
 */
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Info } from 'lucide-react';
import { toast } from 'sonner';
import { formatPhoneAsYouType, autoCapitalizeName } from '@/components/shared/FormHelpers';
import { BookIntroDialog } from '@/components/leads/BookIntroDialog';
import { notifyDataChanged } from '@/lib/data/invalidation';
import { isSelfSourcedLeadSource } from '@/lib/sa/leadsBooked';
import type { Tables } from '@/integrations/supabase/types';

/** Sources an SA can pick for a self-sourced lead. Inbound sources are
 *  intentionally excluded — those count when the booking is made through
 *  the normal flow. */
export const SELF_SOURCED_OPTIONS = [
  'Member Referral',
  'Instagram DM',
  'Walk-in',
  'Event',
  'Cold Lead Re-engagement',
  'Manual Entry',
] as const;

interface Props {
  /** Called after successful save (and optional book flow). */
  onSaved?: () => void;
  /** Hide the "Save and book intro" button (dialog contexts where booking
   *  right after is awkward can pass false). Default true. */
  allowBookIntro?: boolean;
}

export function SelfSourcedLeadForm({ onSaved, allowBookIntro = true }: Props) {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState<string>('Member Referral');
  const [saving, setSaving] = useState(false);
  const [savedLead, setSavedLead] = useState<Tables<'leads'> | null>(null);
  const [bookOpen, setBookOpen] = useState(false);

  const reset = () => {
    setFirstName(''); setLastName(''); setPhone(''); setEmail('');
    setSource('Member Referral'); setSavedLead(null);
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
    if (!isSelfSourcedLeadSource(source)) {
      toast.error('That source counts as inbound — log it through the normal booking flow.');
      return;
    }

    setSaving(true);
    try {
      const { data: lead, error } = await supabase
        .from('leads')
        .insert({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          source,
          stage: 'new',
          sourced_by_sa: user.name,
        })
        .select('*')
        .single();
      if (error) throw error;

      await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        activity_type: 'note',
        performed_by: user.name,
        notes: `Logged as self-sourced by ${user.name}`,
      });

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
              {SELF_SOURCED_OPTIONS.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
