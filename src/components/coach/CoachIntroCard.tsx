import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FileEdit, Plus } from 'lucide-react';

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

export function CoachIntroCard({ booking, questionnaire, onUpdateBooking, userName }: Props) {
  const [editBriefOpen, setEditBriefOpen] = useState(false);
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [briefLookingFor, setBriefLookingFor] = useState(booking.sa_buying_criteria || '');
  const [briefComeDownTo, setBriefComeDownTo] = useState(booking.sa_objection || '');
  const [noteText, setNoteText] = useState(booking.coach_notes || '');
  const [saving, setSaving] = useState(false);

  const firstName = booking.member_name.split(' ')[0];
  const isSecondIntro = !!booking.originating_booking_id;
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

  const levelDesc = fitnessLevel != null ? (() => {
    if (fitnessLevel <= 1) return 'Haven\'t worked out in a long time';
    if (fitnessLevel <= 2) return 'Occasional activity';
    if (fitnessLevel <= 3) return 'Somewhat active';
    if (fitnessLevel <= 4) return 'Regular exerciser';
    return 'Very fit, consistent routine';
  })() : '';

  const handleSaveBrief = useCallback(async () => {
    setSaving(true);
    const now = new Date().toISOString();
    await supabase.from('intros_booked').update({
      sa_buying_criteria: briefLookingFor,
      sa_objection: briefComeDownTo,
      last_edited_by: userName,
      last_edited_at: now,
    } as any).eq('id', booking.id);
    onUpdateBooking(booking.id, {
      sa_buying_criteria: briefLookingFor,
      sa_objection: briefComeDownTo,
      last_edited_by: userName,
      last_edited_at: now,
    });
    setSaving(false);
    setEditBriefOpen(false);
    toast.success('Brief updated ✓');
  }, [booking.id, briefLookingFor, briefComeDownTo, userName]);

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
              <p>Would come down to: <strong>{booking.sa_objection || <span className="text-muted-foreground italic">SA fills in after dig deeper</span>}</strong></p>
              {fitnessLevel != null && (
                <p>Gap: <strong>{fitnessLevel}/5</strong> → "{levelDesc}"</p>
              )}
            </div>
          </div>

          <Separator />

          {/* WHAT THEY TOLD US */}
          <div>
            <h4 className="font-bold text-sm mb-1">WHAT THEY TOLD US</h4>
            {hasQ ? (
              <div className="text-sm space-y-0.5">
                {fitnessLevel != null && <p>Level: {fitnessLevel}/5</p>}
                {goal && <p>Goal: "{goal}"</p>}
                {why && <p>Why: "{why}"</p>}
                {obstacle && <p>Obstacle: "{obstacle}"</p>}
                {commitment && (
                  <p>
                    Commit: {commitment} days/week
                    {availDays ? ` | Days: ${availDays}` : ''}
                  </p>
                )}
                {coachNotes && <p>Notes: "{coachNotes}"</p>}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground italic space-y-0.5">
                <p>No questionnaire on file.</p>
                <p>SA conducting dig deeper during tour.</p>
                <p>Brief will update when filled in.</p>
              </div>
            )}
          </div>

          <Separator />

          {/* PRE-ENTRY */}
          <div>
            <h4 className="font-bold text-sm mb-1">PRE-ENTRY</h4>
            <CueLine>While intro is on tour — Koa or SA briefs the room:</CueLine>
            <ScriptLine>First-timer today. When they hit their all-out — make some noise. Make them feel like they belong.</ScriptLine>
            <CueLine>Raffle is live.</CueLine>
          </div>

          <Separator />

          {/* THE FOURTH QUARTER */}
          <div>
            <h4 className="font-bold text-sm mb-1">THE FOURTH QUARTER — ALL-OUT CALLOUT</h4>
            <CueLine>Non-negotiable — every intro — every class.</CueLine>
            <div className="text-sm space-y-2 mt-2">
              <div>
                <p className="font-bold text-xs text-primary">DRUMROLL</p>
                <ScriptLine>First-timer in the house — {firstName} let's go.</ScriptLine>
              </div>
              <div>
                <p className="font-bold text-xs text-primary">DURING</p>
                <ScriptLine>{firstName} — this is what {booking.sa_buying_criteria || '[their words]'} looks like. Don't stop.</ScriptLine>
              </div>
              <div>
                <p className="font-bold text-xs text-primary">SEED 1</p>
                <CueLine>Quietly under the noise:</CueLine>
                <ScriptLine>Remember this feeling. This is what you came for.</ScriptLine>
                <p className="text-sm font-bold text-foreground ml-4">or</p>
                <ScriptLine>Remember this. Right here.</ScriptLine>
                <CueLine>Use A if you know why they came. Use B if you don't.</CueLine>
              </div>
              <div>
                <p className="font-bold text-xs text-primary">CALLOUT</p>
                <ScriptLine>Everybody — {firstName} just hit their first all-out. Let's go.</ScriptLine>
                <CueLine>Hold the mic. Let the room respond fully. Don't rush it. Studio-wide celebration. Let it sink in before moving on.</CueLine>
              </div>
              <div>
                <p className="font-bold text-xs text-primary">AFTERGLOW</p>
                <ScriptLine>Lock in what you just felt. That's all you.</ScriptLine>
              </div>
            </div>
            <CueLine>No traditional all-out → final 30-60 sec of last tread block. Same sequence.</CueLine>
          </div>

          <Separator />

          {/* VETERAN TORCH PASS */}
          <div>
            <h4 className="font-bold text-sm mb-1">VETERAN TORCH PASS</h4>
            <CueLine>Before class — pull one member aside. Best pick: someone who joined in the last 90 days and is still coming consistently. They remember the feeling. Their credibility with the intro is highest.</CueLine>
            <ScriptLine>Would you say one thing to our first-timer at the end? Just: I remember my first. Welcome.</ScriptLine>
          </div>

          <Separator />

          {/* THE PERFORMANCE SUMMARY */}
          <div>
            <h4 className="font-bold text-sm mb-1">THE PERFORMANCE SUMMARY</h4>
            <CueLine>TV screen. Intro + SA both present.</CueLine>
            <div className="mt-1">
              <ScriptLine>You came in looking for {booking.sa_buying_criteria || '[their words]'}. You found it in that [moment].</ScriptLine>
              <CueLine>[moment] = the all-out callout if it was the clear peak. If a different moment defined their class — name that instead. Use what you actually saw.</CueLine>
              <ScriptLine>That's you.</ScriptLine>
              <CueLine>Stop. Stay silent. Do not fill the silence. Let it land completely before moving to the handoff.</CueLine>
            </div>
          </div>

          <Separator />

          {/* SEED 2 — HANDOFF */}
          <div>
            <h4 className="font-bold text-sm mb-1">SEED 2 — HANDOFF</h4>
            <CueLine>After performance summary. Go straight to handoff. No pause.</CueLine>
            <ScriptLine>{saName} — this one's special.</ScriptLine>
          </div>

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

          <Separator />

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setAddNoteOpen(true); setNoteText(booking.coach_notes || ''); }} className="flex-1 gap-1">
              <Plus className="w-4 h-4" /> Add Note
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              setBriefLookingFor(booking.sa_buying_criteria || '');
              setBriefComeDownTo(booking.sa_objection || '');
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
              <Label className="text-sm font-semibold">Would come down to</Label>
              <Textarea value={briefComeDownTo} onChange={e => setBriefComeDownTo(e.target.value)} placeholder="Use their exact words…" className="min-h-[60px] text-sm" />
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
