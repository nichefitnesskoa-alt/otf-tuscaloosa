import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BULLETS, COLUMNS, CLASS_TYPES, scoreToLevel, bulletsToColumnScore, type ColumnKey, type ClassType, type EvalType } from '@/lib/scorecard/levels';
import { BulletControl } from './BulletControl';
import { ScoreReveal } from './ScoreReveal';
import { COACHES } from '@/types';
import { toast } from 'sonner';

interface BodyProps {
  firstTimerId?: string | null;
  defaultMemberName?: string;
  defaultClassDate?: string;
  defaultCoachName?: string;
  defaultEvaluator?: string;
  evalType: EvalType;
  onEvalTypeChange?: (t: EvalType) => void;
  existingId?: string | null;
  onSubmitted?: (scorecardId: string, level: 1 | 2 | 3) => void;
  showEvalToggle?: boolean;
}

export function ScorecardFormBody(props: BodyProps) {
  const { user } = useAuth();
  const { firstTimerId, defaultMemberName, defaultClassDate, defaultCoachName, defaultEvaluator, evalType, onEvalTypeChange, existingId, onSubmitted, showEvalToggle } = props;
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
  const [submitting, setSubmitting] = useState(false);
  const [revealLevel, setRevealLevel] = useState<1 | 2 | 3 | null>(null);

  const coachOptions = ['TBD', ...COACHES];

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
    const newBullets = { ...bullets, [key]: val };
    const colSum = BULLETS[col].reduce((s, b) => s + (newBullets[b.key] ?? 0), 0);
    const colField = `${col}_score`;
    await supabase.from('fv_scorecards' as any).update({ [colField]: colSum }).eq('id', id);
  };

  const handleSubmit = async () => {
    if (!evaluatee || evaluatee === 'TBD') { toast.error('Pick a coach to evaluate'); return; }
    if (!isPractice && !firstTimerId) { toast.error('Missing first-timer link'); return; }
    if (isPractice && !practiceName) { toast.error('Practice name required'); return; }
    setSubmitting(true);
    try {
      const id = await ensureScorecard();
      const { error } = await supabase.from('fv_scorecards' as any).update({ submitted_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
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
    <div className="space-y-4">
      {showEvalToggle && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onEvalTypeChange?.('self_eval')}
            className={`flex-1 px-3 rounded-md border text-xs font-semibold ${evalType === 'self_eval' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input text-muted-foreground hover:bg-muted'}`}
            style={{ minHeight: '36px' }}
          >Self Eval</button>
          {user?.role === 'Admin' && (
            <button
              type="button"
              onClick={() => onEvalTypeChange?.('formal_eval')}
              className={`flex-1 px-3 rounded-md border text-xs font-semibold ${evalType === 'formal_eval' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input text-muted-foreground hover:bg-muted'}`}
              style={{ minHeight: '36px' }}
            >Formal Eval</button>
          )}
        </div>
      )}

      {/* Header inputs — table-like row */}
      <div className="border rounded-md overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border bg-muted/40">
          <div className="p-2 space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Date</Label>
            <Input type="date" value={classDate} onChange={e => setClassDate(e.target.value)} className="h-9" />
          </div>
          <div className="p-2 space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Class Type</Label>
            <Select value={classType} onValueChange={v => setClassType(v as ClassType)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CLASS_TYPES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="p-2 space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Coach</Label>
            <Select value={evaluatee} onValueChange={setEvaluatee}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select coach" /></SelectTrigger>
              <SelectContent>
                {coachOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="p-2 space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Member Count</Label>
            <Input type="number" value={memberCount} onChange={e => setMemberCount(e.target.value)} placeholder="e.g. 18" className="h-9" />
          </div>
        </div>
      </div>

      {!firstTimerId && (
        <div className="space-y-1">
          <Label className="text-xs">Practice / Subject Name</Label>
          <Input value={practiceName} onChange={e => setPracticeName(e.target.value)} placeholder="e.g. Tuesday practice run" className="h-10" />
        </div>
      )}

      {/* 5 columns — table grid */}
      <div className="border rounded-md overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-border">
          {COLUMNS.map(col => (
            <div key={col.key} className="p-3 space-y-3 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-bold text-xs tracking-wide uppercase truncate">
                  {col.label}{col.subtitle && <span className="text-[10px] text-muted-foreground ml-1">({col.subtitle})</span>}
                </h3>
                <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: 'hsl(20, 90%, 47%)' }}>
                  {colTotal(col.key)}/6
                </span>
              </div>
              <div className="space-y-2">
                {BULLETS[col.key].map(b => (
                  <BulletControl key={b.key} label={b.label} value={bullets[b.key]} onChange={v => setBullet(col.key, b.key, v)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Interactions notes</Label>
          <Textarea value={interactionsNotes} onChange={e => setInteractionsNotes(e.target.value)} onBlur={() => scorecardId && supabase.from('fv_scorecards' as any).update({ interactions_notes: interactionsNotes || null }).eq('id', scorecardId)} placeholder="What stood out about the interactions..." className="min-h-[60px]" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">OTBeat notes</Label>
          <Textarea value={otbeatNotes} onChange={e => setOtbeatNotes(e.target.value)} onBlur={() => scorecardId && supabase.from('fv_scorecards' as any).update({ otbeat_notes: otbeatNotes || null }).eq('id', scorecardId)} placeholder="Heart-rate coaching..." className="min-h-[60px]" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Handback notes</Label>
          <Textarea value={handbackNotes} onChange={e => setHandbackNotes(e.target.value)} onBlur={() => scorecardId && supabase.from('fv_scorecards' as any).update({ handback_notes: handbackNotes || null }).eq('id', scorecardId)} placeholder="Recap, recommendation, prebook..." className="min-h-[60px]" />
        </div>
      </div>

      {/* Submit row */}
      <div className="flex items-center justify-between gap-3 border-t pt-3">
        <div className="text-sm">
          <span className="text-muted-foreground mr-2">Total</span>
          <span className="text-2xl font-bold tabular-nums" style={{ color: 'hsl(20, 90%, 47%)' }}>{total}/15</span>
          <span className="text-xs text-muted-foreground ml-2">
            {total >= 11 ? 'Level 3 — Studio Best' : total >= 6 ? 'Level 2 — Standard' : 'Level 1 — Foundation'}
          </span>
        </div>
        <Button onClick={handleSubmit} disabled={submitting} className="text-white font-bold" style={{ minHeight: '44px', backgroundColor: '#E8540A' }}>
          {submitting ? 'Submitting…' : 'Submit Scorecard'}
        </Button>
      </div>

      {revealLevel && (
        <ScoreReveal level={revealLevel} total={total} onClose={() => setRevealLevel(null)} />
      )}
    </div>
  );
}

interface SheetProps extends BodyProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScorecardForm(props: SheetProps) {
  const { open, onOpenChange, evalType, ...rest } = props;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{evalType === 'self_eval' ? 'Score Yourself' : 'Evaluate Coach'} — First Visit Experience</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <ScorecardFormBody evalType={evalType} {...rest} onSubmitted={(id, lvl) => { rest.onSubmitted?.(id, lvl); }} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
