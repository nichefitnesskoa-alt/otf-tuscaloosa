import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface Props {
  bookingId: string;
  coachBriefWhyMoment: string | null;
  shoutoutConsent: boolean | null;
  coachShoutoutStart: boolean | null;
  coachShoutoutEnd: boolean | null;
  coachReferralAsked: boolean | null;
  coachReferralNames: string | null;
  // intros_run fields (may be null if run record doesn't exist yet)
  runId: string | null;
  goalWhyCaptured: string | null;
  madeAFriend: boolean | null;
  relationshipExperience: string | null;
  onFieldSaved: () => void;
}

function SavedIndicator({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="text-[10px] text-primary font-medium ml-2 animate-in fade-in">Saved</span>;
}

export function CoachPrePostClass({
  bookingId,
  coachBriefWhyMoment,
  shoutoutConsent,
  coachShoutoutStart,
  coachShoutoutEnd,
  coachReferralAsked,
  coachReferralNames,
  runId,
  goalWhyCaptured,
  madeAFriend,
  relationshipExperience,
  onFieldSaved,
}: Props) {
  // Pre-Class state
  const [whyPlan, setWhyPlan] = useState(coachBriefWhyMoment || '');
  const [consent, setConsent] = useState(shoutoutConsent ?? false);

  // Post-Class state
  const [shoutoutStart, setShoutoutStart] = useState(coachShoutoutStart ?? false);
  const [shoutoutEnd, setShoutoutEnd] = useState(coachShoutoutEnd ?? false);
  const [usedWhy, setUsedWhy] = useState(goalWhyCaptured === 'yes');
  const [introducedMember, setIntroducedMember] = useState(madeAFriend ?? false);
  const [memberName, setMemberName] = useState(relationshipExperience || '');
  const [referralAsked, setReferralAsked] = useState(coachReferralAsked ?? false);
  const [referralNames, setReferralNames] = useState(coachReferralNames || '');

  // Saved indicators
  const [savedField, setSavedField] = useState<string | null>(null);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const flashSaved = (field: string) => {
    setSavedField(field);
    setTimeout(() => setSavedField(null), 2000);
  };

  const saveBookingField = useCallback(async (field: string, value: any) => {
    await supabase.from('intros_booked').update({ [field]: value } as any).eq('id', bookingId);
    flashSaved(field);
    onFieldSaved();
  }, [bookingId, onFieldSaved]);

  const saveRunField = useCallback(async (fields: Record<string, any>) => {
    if (!runId) return; // No run record yet — skip silently
    await supabase.from('intros_run').update(fields as any).eq('id', runId);
    flashSaved(Object.keys(fields)[0]);
    onFieldSaved();
  }, [runId, onFieldSaved]);

  // Debounced text saves
  const debounceSave = useCallback((key: string, fn: () => void, delay = 800) => {
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(fn, delay);
  }, []);

  // Pre-Class: WHY plan
  const handleWhyChange = (val: string) => {
    setWhyPlan(val);
    debounceSave('why', () => saveBookingField('coach_brief_why_moment', val || null));
  };

  // Pre-Class: Shoutout consent
  const handleConsentChange = (val: boolean) => {
    setConsent(val);
    saveBookingField('shoutout_consent', val);
  };

  // Post-Class handlers
  const handleShoutoutStart = (val: boolean) => {
    setShoutoutStart(val);
    saveBookingField('coach_shoutout_start', val);
  };

  const handleShoutoutEnd = (val: boolean) => {
    setShoutoutEnd(val);
    saveBookingField('coach_shoutout_end', val);
  };

  const handleUsedWhy = (val: boolean) => {
    setUsedWhy(val);
    saveRunField({ goal_why_captured: val ? 'yes' : 'no' });
  };

  const handleIntroducedMember = (val: boolean) => {
    setIntroducedMember(val);
    if (!val) {
      setMemberName('');
      saveRunField({ made_a_friend: false, relationship_experience: null });
    } else {
      saveRunField({ made_a_friend: true });
    }
  };

  const handleMemberNameChange = (val: string) => {
    setMemberName(val);
    debounceSave('memberName', () => saveRunField({ relationship_experience: val || null }));
  };

  const handleReferralAsked = (val: boolean) => {
    setReferralAsked(val);
    if (!val) {
      setReferralNames('');
      saveBookingField('coach_referral_asked', false);
      saveBookingField('coach_referral_names', null);
    } else {
      saveBookingField('coach_referral_asked', true);
    }
  };

  const handleReferralNamesChange = (val: string) => {
    setReferralNames(val);
    debounceSave('referralNames', () => {
      saveBookingField('coach_referral_names', val || null);
      // Create leads for each name
      if (val.trim()) createReferralLeads(val);
    });
  };

  const createReferralLeads = async (namesStr: string) => {
    const names = namesStr.split(',').map(n => n.trim()).filter(Boolean);
    for (const name of names) {
      const parts = name.split(/\s+/);
      const firstName = parts[0] || name;
      const lastName = parts.slice(1).join(' ') || '';

      // Check for existing lead (case-insensitive)
      const { data: existing } = await supabase
        .from('leads')
        .select('id')
        .ilike('first_name', firstName)
        .ilike('last_name', lastName || '')
        .limit(1);

      if (existing && existing.length > 0) continue;

      await supabase.from('leads').insert({
        first_name: firstName,
        last_name: lastName || '',
        source: 'Coach Referral at Close',
        stage: 'new',
        phone: '',
      });
    }
  };

  const isPreClassComplete = whyPlan.trim().length > 0;

  return (
    <>
      <Separator />

      {/* PRE-CLASS — shoutout consent only (WHY plan moved to THEIR STORY) */}
      <div>
        <h4 className="font-bold text-sm mb-2">PRE-CLASS</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Label className="text-sm font-medium">Shoutout consent</Label>
              <SavedIndicator show={savedField === 'shoutout_consent'} />
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("text-xs", !consent && "font-semibold")}>No</span>
              <Switch checked={consent} onCheckedChange={handleConsentChange} />
              <span className={cn("text-xs", consent && "font-semibold")}>Yes</span>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* POST-CLASS */}
      {!isPreClassComplete ? (
        <p className="text-xs text-muted-foreground italic">Complete Pre-Class to unlock post-class debrief.</p>
      ) : (
        <div>
          <h4 className="font-bold text-sm mb-2">POST-CLASS</h4>
          <div className="space-y-3">
            {/* Shoutout start */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Label className="text-sm">Did you shout them out at the start of class?</Label>
                <SavedIndicator show={savedField === 'coach_shoutout_start'} />
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs", !shoutoutStart && "font-semibold")}>No</span>
                <Switch checked={shoutoutStart} onCheckedChange={handleShoutoutStart} />
                <span className={cn("text-xs", shoutoutStart && "font-semibold")}>Yes</span>
              </div>
            </div>

            {/* Shoutout end */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Label className="text-sm">Did you shout them out at the end of class?</Label>
                <SavedIndicator show={savedField === 'coach_shoutout_end'} />
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs", !shoutoutEnd && "font-semibold")}>No</span>
                <Switch checked={shoutoutEnd} onCheckedChange={handleShoutoutEnd} />
                <span className={cn("text-xs", shoutoutEnd && "font-semibold")}>Yes</span>
              </div>
            </div>

            {/* Used WHY */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Label className="text-sm">Did you use their WHY during class?</Label>
                <SavedIndicator show={savedField === 'goal_why_captured'} />
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs", !usedWhy && "font-semibold")}>No</span>
                <Switch checked={usedWhy} onCheckedChange={handleUsedWhy} />
                <span className={cn("text-xs", usedWhy && "font-semibold")}>Yes</span>
              </div>
            </div>

            {/* Introduced member */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Label className="text-sm">Did you introduce them to a member?</Label>
                  <SavedIndicator show={savedField === 'made_a_friend'} />
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs", !introducedMember && "font-semibold")}>No</span>
                  <Switch checked={introducedMember} onCheckedChange={handleIntroducedMember} />
                  <span className={cn("text-xs", introducedMember && "font-semibold")}>Yes</span>
                </div>
              </div>
              {introducedMember && (
                <div className="pl-4">
                  <div className="flex items-center">
                    <Label className="text-xs text-muted-foreground">Which member?</Label>
                    <SavedIndicator show={savedField === 'relationship_experience'} />
                  </div>
                  <Input
                    value={memberName}
                    onChange={e => handleMemberNameChange(e.target.value)}
                    placeholder="Member name"
                    className="h-8 text-sm mt-1"
                  />
                </div>
              )}
            </div>

            {/* Referral ask */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Label className="text-sm">Did you ask for referral names?</Label>
                  <SavedIndicator show={savedField === 'coach_referral_asked'} />
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs", !referralAsked && "font-semibold")}>No</span>
                  <Switch checked={referralAsked} onCheckedChange={handleReferralAsked} />
                  <span className={cn("text-xs", referralAsked && "font-semibold")}>Yes</span>
                </div>
              </div>
              {referralAsked && (
                <div className="pl-4">
                  <div className="flex items-center">
                    <Label className="text-xs text-muted-foreground">Names given (optional)</Label>
                    <SavedIndicator show={savedField === 'coach_referral_names'} />
                  </div>
                  <Input
                    value={referralNames}
                    onChange={e => handleReferralNamesChange(e.target.value)}
                    placeholder="Comma-separated names"
                    className="h-8 text-sm mt-1"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
