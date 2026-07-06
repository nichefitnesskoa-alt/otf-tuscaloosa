/**
 * Dark-themed, inline version of the /q/[slug] questionnaire, embedded inside
 * the self-book flow (/book-intro). Same 7 questions and same DB writes:
 *   - stamps intro_questionnaires.last_opened_at on mount
 *   - on submit: writes q1..q7 answers, status='completed', submitted_at
 *   - syncs intros_booked.questionnaire_status_canon='completed' + completed_at
 *
 * Styling matches BookIntro.tsx (neutral-900 card, #E8540A accents, white text).
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const ORANGE = '#E8540A';

const Q1_OPTIONS = [
  'Lose weight / lean out',
  'Build strength and muscle',
  'Get more energy and feel better day to day',
  "Improve a health condition or follow doctor's recommendations",
  'Train for something specific (race, sport, event)',
  'Get back into a routine after falling off',
  'Reduce stress and improve mental health',
];
const Q3_OPTIONS = [
  'No accountability or motivation to stay consistent',
  "Don't know what to do or how to structure workouts",
  "Schedule is too busy / can't find the time",
  "Cost / not sure if it's worth the investment",
  'Past injuries or health concerns',
  "Tried things before that didn't work or stick",
  "Haven't found a gym or program that fits me",
];
const Q4A_OPTIONS = ['Yes', 'A few times but nothing consistent', 'No, this is my first time'];
const Q4B_OPTIONS = [
  'Yes',
  "I saw some progress but couldn't stick to it",
  'I just need something new',
  'Not really',
];
const Q5_OPTIONS = [
  'Feel more confident in how I look and feel',
  'Have more energy for my kids, family, or daily life',
  'Prove to myself I can stick with something',
  'Reduce stress and feel mentally healthier',
  'Get off medications or improve a health condition',
  'Feel strong and capable again',
  'Keep up with activities I love (sports, hiking, travel, etc.)',
];
const Q6_OPTIONS = ['1-2 days', '3-4 days', '5+ days'];
const DAY_OPTIONS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface Props {
  bookingId: string;
  firstName: string;
  onComplete: () => void;
}

export function InlineQuestionnaire({ bookingId, firstName, onComplete }: Props) {
  const [qRowId, setQRowId] = useState<string | null>(null);
  const [step, setStep] = useState(1); // 1..7
  const [submitting, setSubmitting] = useState(false);
  const [showError, setShowError] = useState(false);

  const [q1, setQ1] = useState<string[]>([]);
  const [q1Other, setQ1Other] = useState('');
  const [q2, setQ2] = useState<number | null>(null);
  const [q3, setQ3] = useState<string[]>([]);
  const [q3Other, setQ3Other] = useState('');
  const [q4a, setQ4a] = useState('');
  const [q4b, setQ4b] = useState('');
  const [q5, setQ5] = useState<string[]>([]);
  const [q5Other, setQ5Other] = useState('');
  const [q6, setQ6] = useState('');
  const [q6bDays, setQ6bDays] = useState<string[]>([]);
  const [q7, setQ7] = useState('');

  // Look up the questionnaire row (created by DB trigger on the booking) and
  // stamp last_opened_at so it reads as "opened" in MyDay.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 5; i++) {
        const { data } = await supabase
          .from('intro_questionnaires')
          .select('id')
          .eq('booking_id', bookingId)
          .maybeSingle();
        if (cancelled) return;
        const id = (data as any)?.id as string | undefined;
        if (id) {
          setQRowId(id);
          await supabase
            .from('intro_questionnaires')
            .update({ last_opened_at: new Date().toISOString() } as any)
            .eq('id', id);
          return;
        }
        await new Promise(r => setTimeout(r, 400));
      }
    })();
    return () => { cancelled = true; };
  }, [bookingId]);

  const canProceed = useMemo(() => {
    switch (step) {
      case 1: return q1.length > 0 && (!q1.includes('Other') || q1Other.trim() !== '');
      case 2: return q2 !== null;
      case 3: return q3.length > 0 && (!q3.includes('Other') || q3Other.trim() !== '');
      case 4: return q4a !== '';
      case 5: return true;
      case 6: return q6 !== '';
      case 7: return true;
      default: return true;
    }
  }, [step, q1, q1Other, q2, q3, q3Other, q4a, q6]);

  const showQ4b = q4a === 'Yes' || q4a === 'A few times but nothing consistent';

  const handleSubmit = async () => {
    if (!qRowId) {
      toast.error('Still setting up your questionnaire — try again in a moment.');
      return;
    }
    setSubmitting(true);
    const finalQ1 = q1.map(v => v === 'Other' ? q1Other : v).join(' | ');
    const finalQ3 = q3.map(v => v === 'Other' ? q3Other : v).join(' | ');
    const finalQ5 = q5.length > 0 ? q5.map(v => v === 'Other' ? q5Other : v).join(' | ') : null;
    const finalQ4 = q4b ? `${q4a} | ${q4b}` : q4a;
    const finalQ6b = q6bDays.length > 0 ? q6bDays.join(' | ') : null;
    const submittedAt = new Date().toISOString();

    const { error: err } = await supabase
      .from('intro_questionnaires')
      .update({
        q1_fitness_goal: finalQ1,
        q2_fitness_level: q2,
        q3_obstacle: finalQ3,
        q4_past_experience: finalQ4,
        q5_emotional_driver: finalQ5,
        q6_weekly_commitment: q6,
        q6b_available_days: finalQ6b,
        q7_coach_notes: q7 || null,
        status: 'completed',
        submitted_at: submittedAt,
      } as any)
      .eq('id', qRowId);

    if (err) {
      console.error('[InlineQuestionnaire] submit failed', err);
      toast.error('Could not save — please try again.');
      setSubmitting(false);
      return;
    }

    await supabase
      .from('intros_booked')
      .update({
        questionnaire_status_canon: 'completed',
        questionnaire_completed_at: submittedAt,
      } as any)
      .eq('id', bookingId);

    setSubmitting(false);
    onComplete();
  };

  const goNext = () => {
    if (!canProceed) { setShowError(true); return; }
    setShowError(false);
    if (step === 7) { handleSubmit(); return; }
    setStep(s => s + 1);
  };

  const goBack = () => {
    setShowError(false);
    setStep(s => Math.max(1, s - 1));
  };

  const progressPct = (step / 7) * 100;

  // ---- shared choice-button styles ----
  const optionBtn = (selected: boolean) =>
    `w-full text-left p-4 rounded-lg border transition flex items-center gap-3 text-white ${
      selected
        ? 'bg-[#E8540A]/15 border-[#E8540A]'
        : 'bg-neutral-800 border-neutral-700 hover:border-[#E8540A]'
    }`;

  const checkbox = (selected: boolean) => (
    <div
      className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition ${
        selected ? 'border-[#E8540A] bg-[#E8540A]' : 'border-neutral-500 bg-transparent'
      }`}
    >
      {selected && <Check className="w-3.5 h-3.5 text-white" />}
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">What are your health/fitness goals right now?</h2>
            <p className="text-sm text-neutral-400">Select all that apply.</p>
            <div className="space-y-2.5">
              {Q1_OPTIONS.map(opt => {
                const selected = q1.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => { setQ1(p => selected ? p.filter(v => v !== opt) : [...p, opt]); setShowError(false); }}
                    className={optionBtn(selected)}
                  >
                    {checkbox(selected)}<span className="text-sm">{opt}</span>
                  </button>
                );
              })}
              {(() => {
                const selected = q1.includes('Other');
                return (
                  <button
                    onClick={() => { setQ1(p => selected ? p.filter(v => v !== 'Other') : [...p, 'Other']); setShowError(false); }}
                    className={optionBtn(selected)}
                  >
                    {checkbox(selected)}<span className="text-sm">Other (please share)</span>
                  </button>
                );
              })()}
              {q1.includes('Other') && (
                <Input
                  value={q1Other}
                  onChange={e => setQ1Other(e.target.value)}
                  placeholder="Tell us your goal..."
                  className="mt-2 bg-neutral-800 border-neutral-700 text-white"
                  autoFocus
                />
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-5">
            <h2 className="text-xl font-semibold">On a scale of 1 to 5, how would you rate your current fitness level?</h2>
            <div className="flex justify-center gap-3">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => { setQ2(n); setShowError(false); }}
                  className={`w-14 h-14 rounded-xl text-xl font-bold border-2 transition ${
                    q2 === n
                      ? 'bg-[#E8540A] border-[#E8540A] text-white'
                      : 'bg-neutral-800 border-neutral-700 text-white hover:border-[#E8540A]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-3 text-xs text-neutral-400 px-1">
              <span className="text-center">Starting from<br />scratch</span>
              <span />
              <span className="text-center">Decent but<br />inconsistent</span>
              <span />
              <span className="text-center">Peak<br />fitness</span>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">What's been the biggest thing stopping you from reaching your fitness goals?</h2>
            <p className="text-sm text-neutral-400">Select all that apply.</p>
            <div className="space-y-2.5">
              {Q3_OPTIONS.map(opt => {
                const selected = q3.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => { setQ3(p => selected ? p.filter(v => v !== opt) : [...p, opt]); setShowError(false); }}
                    className={optionBtn(selected)}
                  >
                    {checkbox(selected)}<span className="text-sm">{opt}</span>
                  </button>
                );
              })}
              {(() => {
                const selected = q3.includes('Other');
                return (
                  <button
                    onClick={() => { setQ3(p => selected ? p.filter(v => v !== 'Other') : [...p, 'Other']); setShowError(false); }}
                    className={optionBtn(selected)}
                  >
                    {checkbox(selected)}<span className="text-sm">Other (please share)</span>
                  </button>
                );
              })()}
              {q3.includes('Other') && (
                <Input
                  value={q3Other}
                  onChange={e => setQ3Other(e.target.value)}
                  placeholder="Tell us what's been stopping you..."
                  className="mt-2 bg-neutral-800 border-neutral-700 text-white"
                  autoFocus
                />
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-5">
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">Have you tried other gyms or fitness programs before?</h2>
              <div className="space-y-2.5">
                {Q4A_OPTIONS.map(opt => {
                  const selected = q4a === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => { setQ4a(opt); if (opt === 'No, this is my first time') setQ4b(''); setShowError(false); }}
                      className={optionBtn(selected)}
                    >
                      <span className="text-sm">{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {showQ4b && (
              <div className="space-y-3 pt-3 border-t border-neutral-800">
                <h3 className="text-base font-semibold">Did you see the results you were hoping for?</h3>
                <div className="space-y-2.5">
                  {Q4B_OPTIONS.map(opt => {
                    const selected = q4b === opt;
                    return (
                      <button key={opt} onClick={() => setQ4b(opt)} className={optionBtn(selected)}>
                        <span className="text-sm">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">
              What would reaching your fitness/health goals actually mean for you?
              <span className="text-sm font-normal text-neutral-400 ml-2">(Optional)</span>
            </h2>
            <p className="text-sm text-neutral-400">Select all that apply. Helps your coach understand what really matters to you.</p>
            <div className="space-y-2.5">
              {Q5_OPTIONS.map(opt => {
                const selected = q5.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => setQ5(p => selected ? p.filter(v => v !== opt) : [...p, opt])}
                    className={optionBtn(selected)}
                  >
                    {checkbox(selected)}<span className="text-sm">{opt}</span>
                  </button>
                );
              })}
              {(() => {
                const selected = q5.includes('Other');
                return (
                  <button
                    onClick={() => setQ5(p => selected ? p.filter(v => v !== 'Other') : [...p, 'Other'])}
                    className={optionBtn(selected)}
                  >
                    {checkbox(selected)}<span className="text-sm">Other (please share)</span>
                  </button>
                );
              })()}
              {q5.includes('Other') && (
                <Input
                  value={q5Other}
                  onChange={e => setQ5Other(e.target.value)}
                  placeholder="Tell us what it would mean for you..."
                  className="mt-2 bg-neutral-800 border-neutral-700 text-white"
                  autoFocus
                />
              )}
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-5">
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">How many days per week could you realistically commit to working out?</h2>
              <div className="space-y-2.5">
                {Q6_OPTIONS.map(opt => {
                  const selected = q6 === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => { setQ6(opt); setShowError(false); }}
                      className={`w-full h-14 rounded-lg font-semibold text-base border transition ${
                        selected
                          ? 'bg-[#E8540A] border-[#E8540A] text-white'
                          : 'bg-neutral-800 border-neutral-700 text-white hover:border-[#E8540A]'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
            {q6 !== '' && (
              <div className="space-y-3 pt-3 border-t border-neutral-800">
                <h3 className="text-base font-semibold">What days work best for you?</h3>
                <p className="text-xs text-neutral-400">Classes run 4 AM to 7 PM, seven days a week. Tap to select.</p>
                <div className="grid grid-cols-4 gap-2">
                  {DAY_OPTIONS.map(day => {
                    const selected = q6bDays.includes(day);
                    return (
                      <button
                        key={day}
                        onClick={() => setQ6bDays(p => selected ? p.filter(d => d !== day) : [...p, day])}
                        className={`h-11 rounded-lg font-medium text-sm border transition ${
                          selected
                            ? 'bg-[#E8540A] border-[#E8540A] text-white'
                            : 'bg-neutral-800 border-neutral-700 text-white hover:border-[#E8540A]'
                        }`}
                      >
                        {day.substring(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );

      case 7:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">
              Anything else you'd like your coach to know?
              <span className="text-sm font-normal text-neutral-400 ml-2">(Optional)</span>
            </h2>
            <p className="text-sm text-neutral-400">Injuries, preferences, concerns, questions — anything helps.</p>
            <Textarea
              value={q7}
              onChange={e => setQ7(e.target.value)}
              placeholder="Totally optional, but anything you share helps us help you."
              className="min-h-[120px] bg-neutral-800 border-neutral-700 text-white"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="bg-neutral-900 border-neutral-800 p-5">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Help your coach help you, {firstName}</h2>
          <span className="text-xs text-neutral-400">{step} of 7</span>
        </div>
        <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${progressPct}%`, backgroundColor: ORANGE }}
          />
        </div>
      </div>

      {renderStep()}

      {showError && !canProceed && (
        <p className="text-sm text-red-400 mt-3">Please answer to continue.</p>
      )}

      <div className="flex gap-2 mt-6">
        {step > 1 && (
          <Button
            variant="outline"
            onClick={goBack}
            disabled={submitting}
            className="border-[#FDF7EA]/40 bg-transparent text-[#FDF7EA] hover:bg-[#FDF7EA]/10 hover:text-[#FDF7EA]"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        )}
        <Button
          onClick={goNext}
          disabled={submitting}
          className="flex-1 h-12 bg-[#E8540A] hover:bg-[#c94609] text-white font-semibold"
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
          ) : step === 7 ? (
            <>Finish <Check className="w-4 h-4 ml-2" /></>
          ) : (
            <>Continue <ArrowRight className="w-4 h-4 ml-2" /></>
          )}
        </Button>
      </div>
    </Card>
  );
}
