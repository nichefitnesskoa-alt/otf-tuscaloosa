import { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  last_edited_by: string | null;
  last_edited_at: string | null;
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

  // Fitness level descriptions
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
      <Card className="border-2 border-border">
        <CardContent className="p-4 space-y-3" style={{ fontSize: '15px' }}>
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold">{booking.member_name}</span>
            <Badge variant={isSecondIntro ? 'secondary' : 'default'} className="text-xs">
              {isSecondIntro ? '2nd Intro' : '1st Intro'}
            </Badge>
          </div>

          <div className="text-sm">
            Shoutout: <strong>{booking.shoutout_consent === true ? 'YES' : booking.shoutout_consent === false ? 'NO' : '—'}</strong>
          </div>

          <Separator />

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
          {hasQ && (
            <>
              <div>
                <h4 className="font-bold text-sm mb-1">WHAT THEY TOLD US</h4>
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
              </div>
              <Separator />
            </>
          )}

          {/* PRE-ENTRY */}
          <div>
            <h4 className="font-bold text-sm mb-1">PRE-ENTRY</h4>
            <p className="text-sm">While intro is on tour — Koa or SA briefs the room:</p>
            <p className="text-sm italic">"First-timer today. When they hit their all-out — make some noise. Make them feel like they belong."</p>
            <p className="text-sm">Raffle is live.</p>
          </div>

          <Separator />

          {/* THE FOURTH QUARTER */}
          <div>
            <h4 className="font-bold text-sm mb-1">THE FOURTH QUARTER — ALL-OUT CALLOUT</h4>
            <p className="text-xs text-muted-foreground mb-2">(non-negotiable — every intro — every class)</p>
            <div className="text-sm space-y-2">
              <p><strong>DRUMROLL:</strong> "First-timer in the house — {firstName} let's go."</p>
              <p><strong>DURING:</strong> "{firstName} — this is what {booking.sa_buying_criteria || '[their words]'} looks like. Don't stop."</p>
              <div>
                <p><strong>SEED 1</strong> — quietly under the noise:</p>
                <p>Option A: "Remember this feeling. This is what you came for."</p>
                <p>Option B: "Remember this. Right here."</p>
                <p className="text-muted-foreground text-xs">Use A if you know why they came. Use B if you don't.</p>
              </div>
              <p><strong>CALLOUT:</strong> "Everybody — {firstName} just hit their first all-out. Let's go." Hold it.</p>
              <p><strong>AFTERGLOW:</strong> "Lock in what you just felt. That's yours now."</p>
              <p className="text-xs text-muted-foreground italic mt-1">No traditional all-out → final 30-60 sec of last tread block. Same sequence.</p>
            </div>
          </div>

          <Separator />

          {/* VETERAN TORCH PASS */}
          <div>
            <h4 className="font-bold text-sm mb-1">VETERAN TORCH PASS</h4>
            <p className="text-sm">Pull one member aside before class:</p>
            <p className="text-sm italic">"Would you say one thing to our first-timer at the end? Just: I remember my first. Welcome."</p>
          </div>

          <Separator />

          {/* THE PERFORMANCE SUMMARY */}
          <div>
            <h4 className="font-bold text-sm mb-1">THE PERFORMANCE SUMMARY</h4>
            <p className="text-xs text-muted-foreground mb-1">(TV screen — intro + SA present)</p>
            <p className="text-sm italic">"You came in looking for {booking.sa_buying_criteria || '[their words]'}. You found it in that [moment]. That's you."</p>
            <p className="text-sm">Stop. Let it land.</p>
          </div>

          <Separator />

          {/* THE SEEDS */}
          <div>
            <h4 className="font-bold text-sm mb-1">THE SEEDS</h4>
            <p className="text-xs text-muted-foreground mb-2">(plant these on the floor — SA harvests at the close)</p>
            <div className="text-sm space-y-2">
              <div>
                <p><strong>SEED 1</strong> — Quietly under the noise during all-out</p>
                <p>Option A: "Remember this feeling. This is what you came for."</p>
                <p>Option B: "Remember this. Right here."</p>
                <p className="text-muted-foreground text-xs">Use A if you know why they came. Use B if you don't.</p>
              </div>
              <div>
                <p><strong>SEED 2</strong> — After performance summary. Go straight to handoff. No pause.</p>
                <p className="italic">"{saName} — this one's special."</p>
              </div>
            </div>
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
        </CardContent>
      </Card>

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
              <Textarea
                value={briefLookingFor}
                onChange={e => setBriefLookingFor(e.target.value)}
                placeholder="Use their exact words…"
                className="min-h-[60px] text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Would come down to</Label>
              <Textarea
                value={briefComeDownTo}
                onChange={e => setBriefComeDownTo(e.target.value)}
                placeholder="Use their exact words…"
                className="min-h-[60px] text-sm"
              />
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
            <Textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="What happened during class? Any observations?"
              className="min-h-[100px] text-sm"
            />
            <Button onClick={handleSaveNote} disabled={saving} className="w-full">
              {saving ? 'Saving...' : 'Save Note'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
