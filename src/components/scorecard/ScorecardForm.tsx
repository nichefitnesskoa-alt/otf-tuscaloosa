import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { BULLETS, COLUMNS, CLASS_TYPES, scoreToLevel, bulletsToColumnScore, type ColumnKey, type ClassType, type EvalType } from '@/lib/scorecard/levels';
import { BulletControl } from './BulletControl';
import { ScoreReveal } from './ScoreReveal';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** First-timer subject — pass either firstTimerId or practiceName */
  firstTimerId?: string | null;
  defaultMemberName?: string;
  defaultClassDate?: string; // yyyy-MM-dd
  defaultCoachName?: string;
  defaultEvaluator?: string;
  evalType: EvalType;
  /** Existing scorecard id to edit */
  existingId?: string | null;
  onSubmitted?: (scorecardId: string, level: 1 | 2 | 3) => void;
}

export function ScorecardForm(props: Props) {
  const { user } = useAuth();
  const { open, onOpenChange, firstTimerId, defaultMemberName, defaultClassDate, defaultCoachName, defaultEvaluator, evalType, existingId, onSubmitted } = props;
  const todayStr = new Date().toISOString().slice(0, 10);

  const [scorecardId, setScorecardId] = useState<string | null>(existingId ?? null);
  const [isPractice, setIsPractice] = useState(!firstTimerId);
  const [practiceName, setPracticeName] = useState('');
  const [evaluator, setEvaluator] = useState(defaultEvaluator || user?.name || '');
  const [evaluatee, setEvaluatee] = useState(defaultCoachName || '');
  const [classType, setClassType] = useState<ClassType>('orange_60_3g');
  const [classDate, setClassDate] = useState(defaultClassDate || todayStr);
  const [memberCount, setMemberCount] = useState<string>('');
  const [bullets, setBullets] = useState<Record<string, 0 | 1 | 2>>({});
  const [interactionsNotes, setInteractionsNotes] = useState('');
  const [otbeatNotes, setOtbeatNotes] = useState('');
  const [handbackNotes, setHandbackNotes] = useState('');
  const [coaches, setCoaches] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [revealLevel, setRevealLevel] = useState<1 | 2 | 3 | null>(null);

  // Load active coaches
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('staff').select('name, role, is_active').eq('is_active', true);
      const list = (data || []).filter((s: any) => /coach/i.test(s.role || '')).map((s: any) => s.name).sort();
      setCoaches(list);
    })();
  }, []);

  // Load existing scorecard if editing
  useEffect(() => {
    if (!existingId) { setScorecardId(null); return; }
    (async () => {
      const { data: sc } = await supabase.from('fv_scorecards' as any).select('*').eq('id', existingId).maybeSingle();
      const { data: bs } = await supabase.from('fv_scorecard_bullets' as any).select('*').eq('scorecard_id', existingId);
      if (sc) {
        const c = sc as any;
        setScorecardId(c.id);
        setIsPractice(c.is_practice);
        setPracticeName(c.practice_name || '');
        setEvaluator(c.evaluator_name);
        setEvaluatee(c.evaluatee_name);
        setClassType(c.class_type);
        setClassDate(c.class_date);
        setMemberCount(c.member_count?.toString() ?? '');
        setInteractionsNotes(c.interactions_notes || '');
        setOtbeatNotes(c.otbeat_notes || '');
        setHandbackNotes(c.handback_notes || '');
      }
      const map: Record<string, 0 | 1 | 2> = {};
      (bs || []).forEach((b: any) => { map[b.bullet_key] = b.score; });
      setBullets(map);
    })();
  }, [existingId]);

  const colTotal = (k: ColumnKey) => bulletsToColumnScore(bullets, k);
  const total = (Object.keys(BULLETS) as ColumnKey[]).reduce((s, k) => s + colTotal(k), 0);
  const level = scoreToLevel(total);

  const ensureScorecard = async (): Promise<string> => {
    if (scorecardId) {
      // Persist live edits
      await supabase.from('fv_scorecards' as any).update({
        evaluator_name: evaluator,
        evaluatee_name: evaluatee,
        class_type: classType,
        class_date: classDate,
        member_count: memberCount ? parseInt(memberCount) : null,
        tread_score: colTotal('tread'),
        rower_score: colTotal('rower'),
        floor_score: colTotal('floor'),
        otbeat_score: colTotal('otbeat'),
        handback_score: colTotal('handback'),
        interactions_notes: interactionsNotes || null,
        otbeat_notes: otbeatNotes || null,
        handback_notes: handbackNotes || null,
      }).eq('id', scorecardId);
      return scorecardId;
    }
    const payload: any = {
      first_timer_id: isPractice ? null : firstTimerId,
      is_practice: isPractice,
      practice_name: isPractice ? (practiceName || 'Practice') : null,
      evaluator_name: evaluator,
      evaluatee_name: evaluatee,
      eval_type: evalType,
      class_type: classType,
      class_date: classDate,
      member_count: memberCount ? parseInt(memberCount) : null,
      tread_score: colTotal('tread'),
      rower_score: colTotal('rower'),
      floor_score: colTotal('floor'),
      otbeat_score: colTotal('otbeat'),
      handback_score: colTotal('handback'),
      interactions_notes: interactionsNotes || null,
      otbeat_notes: otbeatNotes || null,
      handback_notes: handbackNotes || null,
      created_by: user?.name || 'Unknown',
    };
    const { data, error } = await supabase.from('fv_scorecards' as any).insert(payload).select().single();
    if (error) throw error;
    setScorecardId((data as any).id);
    return (data as any).id;
  };

  const setBullet = async (col: ColumnKey, key: string, val: 0 | 1 | 2) => {
    setBullets(prev => ({ ...prev, [key]: val }));
    const id = await ensureScorecard();
    await supabase.from('fv_scorecard_bullets' as any).upsert({
      scorecard_id: id, column_key: col, bullet_key: key, score: val,
    }, { onConflict: 'scorecard_id,bullet_key' });
    // Update aggregate column score
    const newBullets = { ...bullets, [key]: val };
    const colSum = BULLETS[col].reduce((s, b) => s + (newBullets[b.key] ?? 0), 0);
    const colField = `${col}_score`;
    await supabase.from('fv_scorecards' as any).update({ [colField]: colSum }).eq('id', id);
  };

  const handleSubmit = async () => {
    if (!evaluatee) { toast.error('Pick a coach to evaluate'); return; }
    if (!isPractice && !firstTimerId) { toast.error('Missing first-timer link'); return; }
    if (isPractice && !practiceName) { toast.error('Practice name required'); return; }
    setSubmitting(true);
    try {
      const id = await ensureScorecard();
      const { error } = await supabase.from('fv_scorecards' as any).update({ submitted_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      // If linked to a first-timer & is self-eval, mark debrief done
      if (firstTimerId && evalType === 'self_eval') {
        await supabase.from('intros_booked').update({
          coach_debrief_submitted: true,
          coach_debrief_submitted_at: new Date().toISOString(),
          coach_debrief_submitted_by: evaluator,
        }).eq('id', firstTimerId);
      }
      setRevealLevel(level);
      onSubmitted?.(id, level);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{evalType === 'self_eval' ? 'Score Yourself' : 'Evaluate Coach'} — First Visit Experience</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {/* Header inputs */}
            <Card className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={classDate} onChange={e => setClassDate(e.target.value)} className="h-10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Class Type</Label>
                  <Select value={classType} onValueChange={v => setClassType(v as ClassType)}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CLASS_TYPES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Coach</Label>
                  <Select value={evaluatee} onValueChange={setEvaluatee}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Select coach" /></SelectTrigger>
                    <SelectContent>
                      {coaches.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Member Count</Label>
                  <Input type="number" value={memberCount} onChange={e => setMemberCount(e.target.value)} placeholder="e.g. 18" className="h-10" />
                </div>
              </div>
              {!firstTimerId && (
                <div className="space-y-1">
                  <Label className="text-xs">Practice / Subject Name</Label>
                  <Input value={practiceName} onChange={e => setPracticeName(e.target.value)} placeholder="e.g. Tuesday practice run" className="h-10" />
                </div>
              )}
              {defaultMemberName && (
                <p className="text-xs text-muted-foreground">First-timer: <span className="font-medium text-foreground">{defaultMemberName}</span></p>
              )}
            </Card>

            {/* 5 columns */}
            {COLUMNS.map(col => (
              <Card key={col.key} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm tracking-wide">
                    {col.label.toUpperCase()}{col.subtitle && <span className="text-xs text-muted-foreground ml-1">({col.subtitle})</span>}
                  </h3>
                  <span className="text-sm font-bold tabular-nums" style={{ color: 'hsl(20, 90%, 47%)' }}>
                    {colTotal(col.key)}/6
                  </span>
                </div>
                <div className="space-y-3">
                  {BULLETS[col.key].map(b => (
                    <BulletControl key={b.key} label={b.label} value={bullets[b.key]} onChange={v => setBullet(col.key, b.key, v)} />
                  ))}
                </div>
              </Card>
            ))}

            {/* Notes */}
            <Card className="p-4 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Interactions notes</Label>
                <Textarea value={interactionsNotes} onChange={e => setInteractionsNotes(e.target.value)} placeholder="What stood out about the interactions..." className="min-h-[60px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">OTBeat notes</Label>
                <Textarea value={otbeatNotes} onChange={e => setOtbeatNotes(e.target.value)} placeholder="Anything to call out about heart-rate coaching..." className="min-h-[60px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Handback notes</Label>
                <Textarea value={handbackNotes} onChange={e => setHandbackNotes(e.target.value)} placeholder="Recap, recommendation, prebook..." className="min-h-[60px]" />
              </div>
            </Card>

            {/* Sticky footer */}
            <div className="sticky bottom-0 bg-background border-t pt-3 pb-4 -mx-6 px-6 mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-2xl font-bold tabular-nums" style={{ color: 'hsl(20, 90%, 47%)' }}>{total}/15</span>
              </div>
              <div className="text-xs text-muted-foreground text-center">
                {total >= 11 ? 'Level 3 — Studio Best' : total >= 6 ? 'Level 2 — Standard' : 'Level 1 — Foundation'}
              </div>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full text-white font-bold"
                style={{ minHeight: '44px', backgroundColor: '#E8540A' }}
              >
                {submitting ? 'Submitting…' : 'Submit Scorecard'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {revealLevel && (
        <ScoreReveal level={revealLevel} total={total} onClose={() => { setRevealLevel(null); onOpenChange(false); }} />
      )}
    </>
  );
}
