import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { CalendarPlus, ChevronRight, ChevronLeft, Loader2, CheckCircle, Check } from 'lucide-react';
import otfLogo from '@/assets/otf-logo.jpg';
import { format, parse } from 'date-fns';

const OTF_ORANGE = '#FF6900';
const TOTAL_STEPS = 9; // welcome + 7 question screens + completion

interface QuestionnaireData {
  id: string;
  client_first_name: string;
  client_last_name: string;
  scheduled_class_date: string;
  scheduled_class_time: string | null;
  status: string;
}

const Q1_OPTIONS = [
  'Lose weight / lean out',
  'Build strength and muscle',
  'Get more energy and feel better day to day',
  'Improve a health condition or follow doctor\'s recommendations',
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

const Q4A_OPTIONS = [
  'Yes',
  'A few times but nothing consistent',
  'No, this is my first time',
];

const Q4B_OPTIONS = [
  'Yes',
  'I saw some progress but couldn\'t stick to it',
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

export default function Questionnaire() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<QuestionnaireData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [direction, setDirection] = useState(1);

  // Answers
  const [q1, setQ1] = useState('');
  const [q1Other, setQ1Other] = useState('');
  const [q2, setQ2] = useState<number | null>(null);
  const [q3, setQ3] = useState<string[]>([]);
  const [q3Other, setQ3Other] = useState('');
  const [q4a, setQ4a] = useState('');
  const [q4b, setQ4b] = useState('');
  const [q5, setQ5] = useState('');
  const [q5Other, setQ5Other] = useState('');
  const [q6, setQ6] = useState('');
  const [q6bDays, setQ6bDays] = useState<string[]>([]);
  const [q7, setQ7] = useState('');

  // Validation
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (!id) { setError('Invalid link'); setLoading(false); return; }
    (async () => {
      // Try slug first, fall back to UUID for backward compat
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const { data: row, error: err } = await supabase
        .from('intro_questionnaires')
        .select('id, client_first_name, client_last_name, scheduled_class_date, scheduled_class_time, status')
        .or(isUUID ? `id.eq.${id},slug.eq.${id}` : `slug.eq.${id}`)
        .maybeSingle();
      if (err || !row) { setError('Invalid link'); setLoading(false); return; }
      if (row.status === 'completed') { setError('already_submitted'); setData(row as QuestionnaireData); setLoading(false); return; }
      setData(row as QuestionnaireData);
      setLoading(false);
    })();
  }, [id]);

  const formatClassDate = useCallback(() => {
    if (!data) return '';
    try {
      const d = parse(data.scheduled_class_date, 'yyyy-MM-dd', new Date());
      const dayName = format(d, 'EEEE');
      const dateStr = format(d, 'MMMM d');
      let timeStr = '';
      if (data.scheduled_class_time) {
        const [h, m] = data.scheduled_class_time.split(':');
        const hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour % 12 || 12;
        timeStr = ` at ${h12}:${m} ${ampm}`;
      }
      return `${dayName}, ${dateStr}${timeStr}`;
    } catch { return data.scheduled_class_date; }
  }, [data]);

  const canProceed = useCallback(() => {
    switch (step) {
      case 1: return q1 !== '' && (q1 !== 'Other' || q1Other.trim() !== '');
      case 2: return q2 !== null;
      case 3: return q3.length > 0 && (!q3.includes('Other') || q3Other.trim() !== '');
      case 4: return q4a !== '';
      case 5: return true; // optional
      case 6: return q6 !== '';
      case 7: return true; // optional
      default: return true;
    }
  }, [step, q1, q1Other, q2, q3, q3Other, q4a, q6]);

  const goNext = () => {
    if (!canProceed()) { setShowError(true); return; }
    setShowError(false);
    setDirection(1);
    if (step === 7) { handleSubmit(); return; }
    setStep(s => s + 1);
  };

  const goBack = () => {
    setShowError(false);
    setDirection(-1);
    setStep(s => Math.max(0, s - 1));
  };

  const handleSubmit = async () => {
    if (!data) return;
    setSubmitting(true);
    const finalQ1 = q1 === 'Other' ? q1Other : q1;
    const finalQ3 = q3.map(val => val === 'Other' ? q3Other : val).join(' | ');
    const finalQ5 = q5 === 'Other' ? q5Other : (q5 || null);
    // Q4: combine Q4a and Q4b
    const finalQ4 = q4b ? `${q4a} | ${q4b}` : q4a;
    // Q6b: pipe-separated days
    const finalQ6b = q6bDays.length > 0 ? q6bDays.join(' | ') : null;

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
        submitted_at: new Date().toISOString(),
      } as any)
      .eq('id', data.id);
    setSubmitting(false);
    if (err) { console.error(err); return; }
    setDirection(1);
    setStep(8);
  };

  const downloadICS = () => {
    if (!data) return;
    const dateStr = data.scheduled_class_date.replace(/-/g, '');
    let startTime = '090000';
    let endTime = '100000';
    if (data.scheduled_class_time) {
      const [h, m] = data.scheduled_class_time.split(':');
      startTime = `${h.padStart(2, '0')}${m.padStart(2, '0')}00`;
      const endH = (parseInt(h) + 1).toString().padStart(2, '0');
      endTime = `${endH}${m.padStart(2, '0')}00`;
    }
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
      `DTSTART:${dateStr}T${startTime}`,
      `DTEND:${dateStr}T${endTime}`,
      'SUMMARY:Orangetheory Fitness - Intro Class',
      'LOCATION:Orangetheory Fitness Tuscaloosa',
      'DESCRIPTION:Your first OTF class! Arrive 15 minutes early.',
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.location.href = url;
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: OTF_ORANGE }} />
    </div>
  );

  if (error === 'already_submitted' && data) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <img src={otfLogo} alt="Orangetheory Fitness" className="h-12 mb-6 object-contain" />
      <CheckCircle className="w-16 h-16 mb-4" style={{ color: OTF_ORANGE }} />
      <h1 className="text-2xl font-bold mb-2" style={{ color: '#1a1a1a' }}>You already submitted your questionnaire.</h1>
      <p className="text-lg" style={{ color: '#555' }}>See you at class, {data.client_first_name}! 🧡</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <img src={otfLogo} alt="Orangetheory Fitness" className="h-12 mb-6 object-contain" />
      <h1 className="text-2xl font-bold mb-2" style={{ color: '#1a1a1a' }}>Invalid Link</h1>
      <p style={{ color: '#555' }}>This questionnaire link is not valid. Please check the link you received.</p>
    </div>
  );

  if (!data) return null;

  const progress = step === 0 ? 0 : step === 8 ? 100 : (step / 7) * 100;

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -300 : 300, opacity: 0 }),
  };

  const SelectCard = ({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) => (
    <button
      onClick={onSelect}
      className="w-full text-left p-4 rounded-xl border-2 transition-all duration-200"
      style={{
        borderColor: selected ? OTF_ORANGE : '#e5e7eb',
        backgroundColor: selected ? '#FFF5EB' : 'white',
        color: '#333',
        fontSize: '16px',
      }}
    >
      {label}
    </button>
  );

  const showQ4b = q4a === 'Yes' || q4a === 'A few times but nothing consistent';

  const renderStep = () => {
    switch (step) {
      case 0: // Welcome
        return (
          <div className="text-center space-y-6">
            <h1 className="text-2xl font-bold" style={{ color: '#1a1a1a' }}>Help Your Coach Help You</h1>
            <p className="text-base" style={{ color: '#555' }}>
              Answer a few quick questions so your coach can personalize your first class. Takes about 2 minutes.
            </p>
            <div className="rounded-xl p-4" style={{ backgroundColor: '#FFF5EB', border: `1px solid ${OTF_ORANGE}30` }}>
              <p className="text-lg" style={{ color: '#1a1a1a' }}>
                Welcome, <strong>{data.client_first_name}</strong>! We're excited to see you on <strong>{formatClassDate()}</strong>.
              </p>
            </div>
            <Button onClick={goNext} className="w-full h-14 text-lg font-semibold rounded-xl" style={{ backgroundColor: OTF_ORANGE }}>
              Let's Go <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        );

      case 1: // Q1
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold" style={{ color: '#1a1a1a' }}><h2 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>What's your #1 health/fitness goal right now?</h2></h2>
            <div className="space-y-3">
              {Q1_OPTIONS.map(opt => (
                <SelectCard key={opt} label={opt} selected={q1 === opt} onSelect={() => { setQ1(opt); setShowError(false); }} />
              ))}
              <SelectCard label="Other (please share)" selected={q1 === 'Other'} onSelect={() => { setQ1('Other'); setShowError(false); }} />
              {q1 === 'Other' && (
                <Input
                  value={q1Other}
                  onChange={e => setQ1Other(e.target.value)}
                  placeholder="Tell us your goal..."
                  className="mt-2 h-12 text-base rounded-xl"
                  autoFocus
                />
              )}
            </div>
            {showError && !canProceed() && <p className="text-sm" style={{ color: '#ef4444' }}>Please select an option to continue.</p>}
          </div>
        );

      case 2: // Q2 - 1-5 Tappable Buttons
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>On a scale of 1 to 5, how would you rate your current fitness level?</h2>
            <div className="flex justify-center gap-3">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => { setQ2(n); setShowError(false); }}
                  className="w-16 h-16 rounded-2xl text-2xl font-bold border-2 transition-all duration-200"
                  style={{
                    borderColor: q2 === n ? OTF_ORANGE : '#e5e7eb',
                    backgroundColor: q2 === n ? OTF_ORANGE : 'white',
                    color: q2 === n ? 'white' : '#333',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-3 text-xs px-1" style={{ color: '#777' }}>
              <span className="text-center">Starting from<br />scratch</span>
              <span></span>
              <span className="text-center">Decent but<br />inconsistent</span>
              <span></span>
              <span className="text-center">Peak<br />fitness</span>
            </div>
            {showError && !canProceed() && <p className="text-sm" style={{ color: '#ef4444' }}>Please select a number.</p>}
          </div>
        );

      case 3: // Q3 - Multi-select
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>What's been the biggest thing stopping you from reaching your fitness goals?</h2>
            <p className="text-sm" style={{ color: '#555' }}>Select all that apply.</p>
            <div className="space-y-3">
              {Q3_OPTIONS.map(opt => {
                const selected = q3.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => {
                      setQ3(prev => selected ? prev.filter(v => v !== opt) : [...prev, opt]);
                      setShowError(false);
                    }}
                    className="w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-3"
                    style={{
                      borderColor: selected ? OTF_ORANGE : '#e5e7eb',
                      backgroundColor: selected ? '#FFF5EB' : 'white',
                      color: '#333',
                      fontSize: '16px',
                    }}
                  >
                    <div
                      className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-all"
                      style={{
                        borderColor: selected ? OTF_ORANGE : '#d1d5db',
                        backgroundColor: selected ? OTF_ORANGE : 'white',
                      }}
                    >
                      {selected && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    {opt}
                  </button>
                );
              })}
              {/* Other option */}
              {(() => {
                const selected = q3.includes('Other');
                return (
                  <button
                    onClick={() => {
                      setQ3(prev => selected ? prev.filter(v => v !== 'Other') : [...prev, 'Other']);
                      setShowError(false);
                    }}
                    className="w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-3"
                    style={{
                      borderColor: selected ? OTF_ORANGE : '#e5e7eb',
                      backgroundColor: selected ? '#FFF5EB' : 'white',
                      color: '#333',
                      fontSize: '16px',
                    }}
                  >
                    <div
                      className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-all"
                      style={{
                        borderColor: selected ? OTF_ORANGE : '#d1d5db',
                        backgroundColor: selected ? OTF_ORANGE : 'white',
                      }}
                    >
                      {selected && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    Other (please share)
                  </button>
                );
              })()}
              {q3.includes('Other') && (
                <Input
                  value={q3Other}
                  onChange={e => setQ3Other(e.target.value)}
                  placeholder="Tell us what's been stopping you..."
                  className="mt-2 h-12 text-base rounded-xl"
                  autoFocus
                />
              )}
            </div>
            {showError && !canProceed() && <p className="text-sm" style={{ color: '#ef4444' }}>Please select at least one option to continue.</p>}
          </div>
        );

      case 4: // Q4a + Q4b (same screen)
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>Have you tried other gyms or fitness programs before?</h2>
              <div className="space-y-3">
                {Q4A_OPTIONS.map(opt => (
                  <SelectCard
                    key={opt}
                    label={opt}
                    selected={q4a === opt}
                    onSelect={() => {
                      setQ4a(opt);
                      if (opt === 'No, this is my first time') setQ4b('');
                      setShowError(false);
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Q4b - conditional reveal */}
            <AnimatePresence>
              {showQ4b && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="space-y-4 pt-2 border-t" style={{ borderColor: '#f3f4f6' }}>
                    <h3 className="text-lg font-semibold" style={{ color: '#1a1a1a' }}>Did you see the results you were hoping for?</h3>
                    <div className="space-y-3">
                      {Q4B_OPTIONS.map(opt => (
                        <SelectCard key={opt} label={opt} selected={q4b === opt} onSelect={() => setQ4b(opt)} />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {showError && !canProceed() && <p className="text-sm" style={{ color: '#ef4444' }}>Please select an option to continue.</p>}
          </div>
        );

      case 5: // Q5 - Single select, optional
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>
              What would reaching your fitness/health goals actually mean for you?
              <span className="text-sm font-normal ml-2" style={{ color: '#777' }}>(Optional)</span>
            </h2>
            <p className="text-sm" style={{ color: '#555' }}>Totally optional, but it helps your coach understand what really matters to you.</p>
            <div className="space-y-3">
              {Q5_OPTIONS.map(opt => (
                <SelectCard
                  key={opt}
                  label={opt}
                  selected={q5 === opt}
                  onSelect={() => setQ5(prev => prev === opt ? '' : opt)}
                />
              ))}
              <SelectCard
                label="Other (please share)"
                selected={q5 === 'Other'}
                onSelect={() => setQ5(prev => prev === 'Other' ? '' : 'Other')}
              />
              {q5 === 'Other' && (
                <Input
                  value={q5Other}
                  onChange={e => setQ5Other(e.target.value)}
                  placeholder="Tell us what it would mean for you..."
                  className="mt-2 h-12 text-base rounded-xl"
                  autoFocus
                />
              )}
            </div>
          </div>
        );

      case 6: // Q6 + Q6b day picker (same screen)
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>How many days per week could you realistically commit to working out?</h2>
              <div className="space-y-3">
                {Q6_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    onClick={() => { setQ6(opt); setShowError(false); }}
                    className="w-full h-16 rounded-xl font-semibold text-lg border-2 transition-all duration-200"
                    style={{
                      borderColor: q6 === opt ? OTF_ORANGE : '#e5e7eb',
                      backgroundColor: q6 === opt ? '#FFF5EB' : 'white',
                      color: '#333',
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Q6b - day picker reveal */}
            <AnimatePresence>
              {q6 !== '' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 pt-2 border-t" style={{ borderColor: '#f3f4f6' }}>
                    <h3 className="text-lg font-semibold" style={{ color: '#1a1a1a' }}>What days are you most likely available to block out an hour of time to work out?</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {DAY_OPTIONS.map(day => {
                        const selected = q6bDays.includes(day);
                        const short = day.substring(0, 3);
                        return (
                          <button
                            key={day}
                            onClick={() => setQ6bDays(prev => selected ? prev.filter(d => d !== day) : [...prev, day])}
                            className="h-12 rounded-xl font-medium text-sm border-2 transition-all duration-200"
                            style={{
                              borderColor: selected ? OTF_ORANGE : '#e5e7eb',
                              backgroundColor: selected ? OTF_ORANGE : 'white',
                              color: selected ? 'white' : '#333',
                            }}
                          >
                            {short}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {showError && !canProceed() && <p className="text-sm" style={{ color: '#ef4444' }}>Please select an option.</p>}
          </div>
        );

      case 7: // Q7
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>
              Anything else you'd like your coach to know?
              <span className="text-sm font-normal ml-2" style={{ color: '#777' }}>(Optional)</span>
            </h2>
            <p className="text-sm" style={{ color: '#555' }}>Injuries, preferences, concerns, questions, anything helps.</p>
            <Textarea
              value={q7}
              onChange={e => setQ7(e.target.value)}
              placeholder="Totally optional, but anything you share helps us help you."
              className="min-h-[120px] text-base rounded-xl"
            />
          </div>
        );

      case 8: // Completion
        return (
          <div className="text-center space-y-6">
            <CheckCircle className="w-20 h-20 mx-auto" style={{ color: OTF_ORANGE }} />
            <h1 className="text-2xl font-bold" style={{ color: '#1a1a1a' }}>
              You're all set, {data.client_first_name}!
            </h1>
            <p className="text-lg" style={{ color: '#555' }}>
              Your coach will use this to make your first class awesome. See you on {formatClassDate()}!
            </p>
            <Button
              onClick={downloadICS}
              variant="outline"
              className="w-full h-14 text-base font-semibold rounded-xl border-2"
              style={{ borderColor: OTF_ORANGE, color: OTF_ORANGE }}
            >
              <CalendarPlus className="w-5 h-5 mr-2" />
              Add to Calendar
            </Button>
          </div>
        );

      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <img src={otfLogo} alt="Orangetheory Fitness" className="h-8 object-contain" />
          {step > 0 && step < 8 && (
            <span className="text-xs font-medium" style={{ color: '#777' }}>{step} of 7</span>
          )}
        </div>
        {step > 0 && step < 8 && (
          <div className="max-w-lg mx-auto mt-2">
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#f3f4f6' }}>
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%`, backgroundColor: OTF_ORANGE }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-5 py-8">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        {step > 0 && step < 8 && (
          <div className="flex gap-3 mt-8">
            <Button
              variant="outline"
              onClick={goBack}
              className="h-14 px-6 rounded-xl text-base"
            >
              <ChevronLeft className="w-5 h-5 mr-1" /> Back
            </Button>
            <Button
              onClick={goNext}
              disabled={submitting}
              className="flex-1 h-14 rounded-xl text-base font-semibold"
              style={{ backgroundColor: OTF_ORANGE }}
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : step === 7 ? (
                'Submit'
              ) : (
                <>Next <ChevronRight className="w-5 h-5 ml-1" /></>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
