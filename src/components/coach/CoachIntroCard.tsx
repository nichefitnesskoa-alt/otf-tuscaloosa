import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FileEdit, Plus } from 'lucide-react';
import { CoachPrePostClass } from './CoachPrePostClass';
import { TheirStory } from '@/components/shared/TheirStory';

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

/* ── Styling helpers ── */
const ScriptLine = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm font-bold text-foreground">"{children}"</p>
);
const CueLine = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm italic text-muted-foreground">↳ {children}</p>
);

/* ── Inline coach WHY plan (sits below Field 3 in THEIR STORY) ── */
function CoachWhyPlan({ bookingId, initialValue, userName, onSaved }: {
  bookingId: string; initialValue: string; userName: string; onSaved: () => void;
}) {
  const [val, setVal] = useState(initialValue);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const save = useCallback(async (v: string) => {
    await supabase.from('intros_booked').update({
      coach_brief_why_moment: v || null,
    } as any).eq('id', bookingId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSaved();
  }, [bookingId, onSaved]);

  const handleChange = (v: string) => {
    setVal(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(v), 800);
  };

  return (
    <div className="space-y-0.5 mt-2">
      <div className="flex items-center">
        <Label className="text-xs font-medium" style={{ color: '#E8540A' }}>How you'll use it today:</Label>
        {saved && <span className="text-[10px] text-primary font-medium ml-2 animate-in fade-in">Saved</span>}
      </div>
      <Textarea
        value={val}
        onChange={e => handleChange(e.target.value)}
        placeholder="Write one sentence you'll say to this person specifically."
        className="min-h-[48px] text-sm border-[#E8540A]/30"
      />
    </div>
  );
}

export function CoachIntroCard({ booking, questionnaire, onUpdateBooking, userName }: Props) {
  const [editBriefOpen, setEditBriefOpen] = useState(false);
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [briefLookingFor, setBriefLookingFor] = useState(booking.sa_buying_criteria || '');
  const [briefObjection, setBriefObjection] = useState(booking.sa_objection || '');
  const [briefAdditionalNotes, setBriefAdditionalNotes] = useState((booking as any).coach_brief_human_detail || '');
  const [briefWhyMoment, setBriefWhyMoment] = useState((booking as any).coach_brief_why_moment || '');
  const [briefFiveVision, setBriefFiveVision] = useState((booking as any).coach_brief_five_vision || '');
  const [noteText, setNoteText] = useState(booking.coach_notes || '');
  const [saving, setSaving] = useState(false);
  const [runData, setRunData] = useState<{ id: string; goal_why_captured: string | null; made_a_friend: boolean | null; relationship_experience: string | null } | null>(null);

  const isSecondIntro = !!booking.originating_booking_id;

  // Fetch linked intros_run record for 1st intros
  useEffect(() => {
    if (isSecondIntro) return;
    (async () => {
      const { data } = await supabase
        .from('intros_run')
        .select('id, goal_why_captured, made_a_friend, relationship_experience')
        .eq('linked_intro_booked_id', booking.id)
        .limit(1)
        .maybeSingle();
      if (data) setRunData(data as any);
    })();
  }, [booking.id, isSecondIntro]);

  const firstName = booking.member_name.split(' ')[0];
  const saName = booking.intro_owner || 'SA';

  const q = questionnaire;
  const hasQ = !!q;
  const fitnessLevel = q?.q2_fitness_level ?? null;
  const goal = q?.q1_fitness_goal;
  const why = q?.q5_emotional_driver;
  const obstacle = q?.q3_obstacle;
  const commitment = q?.q6_weekly_commitment;
  const availDays = q?.q6b_available_days;
  const coachNotes = q?.q7_coach_notes;

  const qStatus = booking.questionnaire_status_canon;
  const isQComplete = qStatus === 'completed' || qStatus === 'submitted';

  const handleSaveBrief = useCallback(async () => {
    setSaving(true);
    const now = new Date().toISOString();
    await supabase.from('intros_booked').update({
      sa_buying_criteria: briefLookingFor,
      sa_objection: briefObjection,
      coach_brief_human_detail: briefAdditionalNotes || null,
      coach_brief_why_moment: briefWhyMoment || null,
      coach_brief_five_vision: briefFiveVision || null,
      last_edited_by: userName,
      last_edited_at: now,
    } as any).eq('id', booking.id);
    onUpdateBooking(booking.id, {
      sa_buying_criteria: briefLookingFor,
      sa_objection: briefObjection,
      coach_brief_human_detail: briefAdditionalNotes || null,
      coach_brief_why_moment: briefWhyMoment || null,
      coach_brief_five_vision: briefFiveVision || null,
      last_edited_by: userName,
      last_edited_at: now,
    } as any);
    setSaving(false);
    setEditBriefOpen(false);
    toast.success('Brief updated ✓');
  }, [booking.id, briefLookingFor, briefObjection, briefAdditionalNotes, briefWhyMoment, briefFiveVision, userName]);

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

  return (
    <>
      <div>
        <div className="p-4 space-y-3" style={{ fontSize: '15px' }}>

          {/* THE BRIEF */}
          <div>
            <h4 className="font-bold text-sm mb-1">THE BRIEF</h4>
            <div className="text-sm space-y-0.5">
              <p>Looking for: <strong>{booking.sa_buying_criteria || <span className="text-muted-foreground italic">SA fills in after dig deeper</span>}</strong></p>
              {fitnessLevel != null && (
                <>
                  <p>Gap: <strong>{fitnessLevel}/5</strong></p>
                  <p>What would 5/5 look like: <strong>{(booking as any).coach_brief_five_vision || <span className="text-muted-foreground italic">___________________________</span>}</strong></p>
                </>
              )}
              <p>Any additional notes: <strong>{(booking as any).coach_brief_human_detail || <span className="text-muted-foreground italic">___________________________</span>}</strong></p>
              <p className="mt-1">Shoutout: {booking.shoutout_consent === true ? '■ YES' : booking.shoutout_consent === false ? '□ NO' : '□ YES □ NO'}</p>
            </div>
          </div>

          <Separator />

          {/* THEIR STORY — with coach WHY plan integrated below Field 3 */}
          <TheirStory
            bookingId={booking.id}
            memberName={booking.member_name}
            classDate={booking.class_date}
            readOnly={true}
            onFieldSaved={() => onUpdateBooking(booking.id, {})}
            afterWhySlot={!isSecondIntro ? (
              <CoachWhyPlan
                bookingId={booking.id}
                initialValue={(booking as any).coach_brief_why_moment || ''}
                userName={userName}
                onSaved={() => onUpdateBooking(booking.id, {})}
              />
            ) : undefined}
          />

          <Separator />

          {/* PRE-ENTRY */}
          <div>
            <h4 className="font-bold text-sm mb-1">PRE-ENTRY</h4>
            <CueLine>While intro is on tour — Koa or SA briefs the room:</CueLine>
            <ScriptLine>First-timer today. When they hit their all-out — make some noise. Make them feel like they belong.</ScriptLine>
            <CueLine>Raffle is live.</CueLine>
          </div>

          {/* THE FOURTH QUARTER — hidden for now (information only when restored) */}
          {/* <Separator />
          <div>
            <h4 className="font-bold text-sm mb-1">THE FOURTH QUARTER — ALL-OUT CALLOUT</h4>
            <div className="text-sm space-y-2 mt-2">
              <div>
                <p className="font-bold text-xs text-primary">CALLOUT</p>
                <ScriptLine>Everybody — {firstName} just hit their first all-out. Let's go.</ScriptLine>
                <CueLine>Hold the mic. Let the room respond fully. Don't rush it. Studio-wide celebration. Let it sink in before moving on.</CueLine>
              </div>
            </div>
          </div> */}

          {/* THE PERFORMANCE SUMMARY — hidden for now */}
          {/* <Separator />
          <div>
            <h4 className="font-bold text-sm mb-1">THE PERFORMANCE SUMMARY</h4>
            <CueLine>TV screen. Intro + SA both present.</CueLine>
            <div className="mt-1">
              <ScriptLine>You came in looking for {booking.sa_buying_criteria || '[their words]'}. You found it in that [moment].</ScriptLine>
              <CueLine>[moment] = the all-out callout if it was the clear peak. If a different moment defined their class — name that instead. Use what you actually saw.</CueLine>
              <ScriptLine>That's you.</ScriptLine>
              <CueLine>Stop. Stay silent. Do not fill the silence. Let it land completely before moving to the handoff.</CueLine>
            </div>
          </div> */}

          {/* SEED 2 — HANDOFF — hidden for now */}
          {/* <Separator />
          <div>
            <h4 className="font-bold text-sm mb-1">SEED 2 — HANDOFF</h4>
            <CueLine>After performance summary. Go straight to handoff. No pause.</CueLine>
            <ScriptLine>{saName} — this one's special.</ScriptLine>
          </div> */}

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

          {/* Pre-Class / Post-Class — 1st intros only */}
          {!isSecondIntro && (
            <CoachPrePostClass
              bookingId={booking.id}
              coachBriefWhyMoment={(booking as any).coach_brief_why_moment ?? null}
              shoutoutConsent={booking.shoutout_consent}
              coachShoutoutStart={(booking as any).coach_shoutout_start ?? null}
              coachShoutoutEnd={(booking as any).coach_shoutout_end ?? null}
              coachReferralAsked={(booking as any).coach_referral_asked ?? null}
              coachReferralNames={(booking as any).coach_referral_names ?? null}
              runId={runData?.id ?? null}
              goalWhyCaptured={runData?.goal_why_captured ?? null}
              madeAFriend={runData?.made_a_friend ?? null}
              relationshipExperience={runData?.relationship_experience ?? null}
              onFieldSaved={() => {
                // Re-fetch run data in case it was updated
                if (!isSecondIntro) {
                  supabase
                    .from('intros_run')
                    .select('id, goal_why_captured, made_a_friend, relationship_experience')
                    .eq('linked_intro_booked_id', booking.id)
                    .limit(1)
                    .maybeSingle()
                    .then(({ data }) => { if (data) setRunData(data as any); });
                }
              }}
            />
          )}

          <Separator />

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setAddNoteOpen(true); setNoteText(booking.coach_notes || ''); }} className="flex-1 gap-1">
              <Plus className="w-4 h-4" /> Add Note
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              setBriefLookingFor(booking.sa_buying_criteria || '');
              setBriefObjection(booking.sa_objection || '');
              setBriefAdditionalNotes((booking as any).coach_brief_human_detail || '');
              setBriefWhyMoment((booking as any).coach_brief_why_moment || '');
              setBriefFiveVision((booking as any).coach_brief_five_vision || '');
              setEditBriefOpen(true);
            }} className="flex-1 gap-1">
              <FileEdit className="w-4 h-4" /> Edit Brief
            </Button>
          </div>

          {booking.last_edited_by && booking.last_edited_at && (
            <p className="text-[10px] text-muted-foreground text-right">
              Last edited by {booking.last_edited_by} · {new Date(booking.last_edited_at).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Edit Brief Sheet */}
      <Sheet open={editBriefOpen} onOpenChange={setEditBriefOpen}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader>
            <SheetTitle>Edit Brief — {booking.member_name}</SheetTitle>
            <SheetDescription>Update the brief fields for this intro</SheetDescription>
          </SheetHeader>
          <div className="p-4 space-y-4">
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Looking for</Label>
              <Textarea value={briefLookingFor} onChange={e => setBriefLookingFor(e.target.value)} placeholder="Use their exact words…" className="min-h-[60px] text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Potential Objection</Label>
              <Textarea value={briefObjection} onChange={e => setBriefObjection(e.target.value)} placeholder="Use their exact words…" className="min-h-[60px] text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-semibold">What would 5/5 look like</Label>
              <Textarea value={briefFiveVision} onChange={e => setBriefFiveVision(e.target.value)} placeholder="Their answer to 'What would being a 5 look like to you?'" className="min-h-[48px] text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Any additional notes</Label>
              <Textarea value={briefAdditionalNotes} onChange={e => setBriefAdditionalNotes(e.target.value)} placeholder="Anything else — their dog's name, where they're from, what they do…" className="min-h-[48px] text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Use their WHY at</Label>
              <Textarea value={briefWhyMoment} onChange={e => setBriefWhyMoment(e.target.value)} placeholder="Pre-plan when to weave in their WHY — e.g. 'during the all-out callout'" className="min-h-[48px] text-sm" />
            </div>
            <Button onClick={handleSaveBrief} disabled={saving} className="w-full">
              {saving ? 'Saving...' : 'Save Brief'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

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
