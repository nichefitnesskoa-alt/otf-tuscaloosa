import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { TheirStory } from '@/components/shared/TheirStory';
import { cn } from '@/lib/utils';

interface CoachBooking {
  id: string;
  member_name: string;
  class_date: string;
  intro_time: string | null;
  coach_name: string;
  lead_source: string;
  intro_owner: string | null;
  originating_booking_id: string | null;
  sa_buying_criteria: string | null;
  sa_objection: string | null;
  shoutout_consent: boolean | null;
  coach_notes: string | null;
  booking_status_canon: string;
  is_vip: boolean;
  deleted_at: string | null;
  last_edited_by: string | null;
  last_edited_at: string | null;
  questionnaire_status_canon?: string;
  coach_brief_human_detail?: string | null;
  coach_brief_why_moment?: string | null;
  coach_brief_five_vision?: string | null;
  coach_shoutout_start?: boolean | null;
  coach_shoutout_end?: boolean | null;
  coach_referral_asked?: boolean | null;
  coach_referral_names?: string | null;
}

interface QuestionnaireData {
  q1_fitness_goal: string | null;
  q2_fitness_level: number | null;
  q3_obstacle: string | null;
  q5_emotional_driver: string | null;
  q6_weekly_commitment: string | null;
  q6b_available_days: string | null;
  q7_coach_notes: string | null;
}

interface Props {
  booking: CoachBooking;
  questionnaire: QuestionnaireData | null;
  onUpdateBooking: (id: string, updates: Partial<CoachBooking>) => void;
  userName: string;
}

function SavedIndicator({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="text-[10px] text-primary font-medium ml-2 animate-in fade-in">Saved</span>;
}

export function CoachIntroCard({ booking, questionnaire, onUpdateBooking, userName }: Props) {
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState(booking.coach_notes || '');
  const [saving, setSaving] = useState(false);
  const [runData, setRunData] = useState<{ id: string; goal_why_captured: string | null; made_a_friend: boolean | null; relationship_experience: string | null } | null>(null);

  // Post-class debrief state
  const [shoutoutStart, setShoutoutStart] = useState((booking as any).coach_shoutout_start ?? false);
  const [shoutoutEnd, setShoutoutEnd] = useState((booking as any).coach_shoutout_end ?? false);
  const [usedWhy, setUsedWhy] = useState(false);
  const [introducedMember, setIntroducedMember] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [pairPlan, setPairPlan] = useState('');
  const [savedField, setSavedField] = useState<string | null>(null);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const isSecondIntro = !!booking.originating_booking_id;

  // Fetch linked intros_run record + coach_member_pair_plan for 1st intros
  useEffect(() => {
    if (isSecondIntro) return;
    (async () => {
      const [runRes, bookingRes] = await Promise.all([
        supabase
          .from('intros_run')
          .select('id, goal_why_captured, made_a_friend, relationship_experience')
          .eq('linked_intro_booked_id', booking.id)
          .limit(1)
          .maybeSingle(),
        supabase
          .from('intros_booked')
          .select('coach_member_pair_plan')
          .eq('id', booking.id)
          .single(),
      ]);
      if (runRes.data) {
        const rd = runRes.data as any;
        setRunData(rd);
        setUsedWhy(rd.goal_why_captured === 'yes');
        setIntroducedMember(rd.made_a_friend ?? false);
        setMemberName(rd.relationship_experience || '');
      }
      if (bookingRes.data) {
        setPairPlan((bookingRes.data as any).coach_member_pair_plan || '');
      }
    })();
  }, [booking.id, isSecondIntro]);

  const flashSaved = (field: string) => {
    setSavedField(field);
    setTimeout(() => setSavedField(null), 2000);
  };

  const saveBookingField = useCallback(async (field: string, value: any) => {
    await supabase.from('intros_booked').update({ [field]: value } as any).eq('id', booking.id);
    flashSaved(field);
  }, [booking.id]);

  const saveRunField = useCallback(async (fields: Record<string, any>) => {
    if (!runData?.id) return;
    await supabase.from('intros_run').update(fields as any).eq('id', runData.id);
    flashSaved(Object.keys(fields)[0]);
  }, [runData?.id]);

  const debounceSave = useCallback((key: string, fn: () => void, delay = 800) => {
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(fn, delay);
  }, []);

  const handleSaveNote = useCallback(async () => {
    setSaving(true);
    await supabase.from('intros_booked').update({
      coach_notes: noteText,
      last_edited_by: userName,
      last_edited_at: new Date().toISOString(),
    } as any).eq('id', booking.id);
    onUpdateBooking(booking.id, { coach_notes: noteText });
    setSaving(false);
    setAddNoteOpen(false);
    toast.success('Note saved ✓');
  }, [booking.id, noteText, userName]);

  // Post-class handlers
  const handleShoutoutStart = (val: boolean) => { setShoutoutStart(val); saveBookingField('coach_shoutout_start', val); };
  const handleShoutoutEnd = (val: boolean) => { setShoutoutEnd(val); saveBookingField('coach_shoutout_end', val); };
  const handleUsedWhy = (val: boolean) => { setUsedWhy(val); saveRunField({ goal_why_captured: val ? 'yes' : 'no' }); };
  const handleIntroducedMember = (val: boolean) => {
    setIntroducedMember(val);
    if (!val) { setMemberName(''); saveRunField({ made_a_friend: false, relationship_experience: null }); }
    else { saveRunField({ made_a_friend: true }); }
  };
  const handleMemberNameChange = (val: string) => {
    setMemberName(val);
    debounceSave('memberName', () => saveRunField({ relationship_experience: val || null }));
  };
  const handlePairPlanChange = (val: string) => {
    setPairPlan(val);
    debounceSave('pairPlan', () => saveBookingField('coach_member_pair_plan', val || null));
  };

  function ToggleField({ label, checked, onChange, savedKey }: { label: string; checked: boolean; onChange: (v: boolean) => void; savedKey: string }) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Label className="text-sm">{label}</Label>
          <SavedIndicator show={savedField === savedKey} />
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-xs", !checked && "font-semibold")}>No</span>
          <Switch checked={checked} onCheckedChange={onChange} />
          <span className={cn("text-xs", checked && "font-semibold")}>Yes</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onFocus={e => e.stopPropagation()}
      >
        <div className="p-4 space-y-3" style={{ fontSize: '15px' }}>

          {/* THEIR STORY — 3-zone layout, Zone 2 always editable */}
          <TheirStory
            bookingId={booking.id}
            memberName={booking.member_name}
            classDate={booking.class_date}
            readOnly={true}
            onFieldSaved={() => onUpdateBooking(booking.id, {})}
            editedBy={userName}
          />

          {/* Coach Notes (if saved) */}
          {booking.coach_notes && (
            <>
              <Separator />
              <div>
                <h4 className="font-bold text-sm mb-1">COACH NOTES</h4>
                <p className="text-sm">{booking.coach_notes}</p>
              </div>
            </>
          )}

          {/* POST-CLASS debrief — 1st intros only */}
          {!isSecondIntro && (
            <>
              <Separator />
              <div>
                <h4 className="font-bold text-sm mb-2">POST-CLASS</h4>
                <div className="space-y-3">
                  <ToggleField label="Did you shout them out at the start of class?" checked={shoutoutStart} onChange={handleShoutoutStart} savedKey="coach_shoutout_start" />
                  <ToggleField label="Did you shout them out at the end of class?" checked={shoutoutEnd} onChange={handleShoutoutEnd} savedKey="coach_shoutout_end" />
                  <ToggleField label="Did you ask follow-up questions about their goal and give personalized advice?" checked={usedWhy} onChange={handleUsedWhy} savedKey="goal_why_captured" />

                  {/* Member introduction */}
                  <div className="space-y-1.5">
                    <ToggleField label="Did you introduce them to a current member?" checked={introducedMember} onChange={handleIntroducedMember} savedKey="made_a_friend" />
                    {introducedMember && (
                      <div className="pl-4">
                        <div className="flex items-center">
                          <Label className="text-xs text-muted-foreground">Which member from the class roster?</Label>
                          <SavedIndicator show={savedField === 'relationship_experience'} />
                        </div>
                        <Input value={memberName} onChange={e => handleMemberNameChange(e.target.value)} placeholder="Member name" className="h-8 text-sm mt-1" />
                      </div>
                    )}
                  </div>

                  {/* Member pairing plan (pre-class planning field) */}
                  <div className="space-y-1">
                    <div className="flex items-center">
                      <Label className="text-sm">Who are you planning to pair them with today?</Label>
                      <SavedIndicator show={savedField === 'coach_member_pair_plan'} />
                    </div>
                    <Input value={pairPlan} onChange={e => handlePairPlanChange(e.target.value)} placeholder="Member name" className="h-8 text-sm" />
                  </div>

                  {/* Referral ask */}
                  <div className="space-y-1.5">
                    <ToggleField label="Did you ask for referral names?" checked={referralAsked} onChange={handleReferralAsked} savedKey="coach_referral_asked" />
                    {referralAsked && (
                      <div className="pl-4">
                        <div className="flex items-center">
                          <Label className="text-xs text-muted-foreground">Names given (optional)</Label>
                          <SavedIndicator show={savedField === 'coach_referral_names'} />
                        </div>
                        <Input value={referralNames} onChange={e => handleReferralNamesChange(e.target.value)} placeholder="Comma-separated names" className="h-8 text-sm mt-1" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setAddNoteOpen(true); setNoteText(booking.coach_notes || ''); }} className="flex-1 gap-1">
              <Plus className="w-4 h-4" /> Add Note
            </Button>
          </div>

          {booking.last_edited_by && booking.last_edited_at && (
            <p className="text-[10px] text-muted-foreground text-right">
              Last edited by {booking.last_edited_by} · {new Date(booking.last_edited_at).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Add Note Sheet */}
      <Sheet open={addNoteOpen} onOpenChange={setAddNoteOpen}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader>
            <SheetTitle>Add Note — {booking.member_name}</SheetTitle>
            <SheetDescription>Post-class note for this intro</SheetDescription>
          </SheetHeader>
          <div className="p-4 space-y-4">
            <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="What happened during class? Any observations?" className="min-h-[100px] text-sm" />
            <Button onClick={handleSaveNote} disabled={saving} className="w-full">
              {saving ? 'Saving...' : 'Save Note'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
