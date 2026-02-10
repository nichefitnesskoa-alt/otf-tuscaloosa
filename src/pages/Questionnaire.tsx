import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { CalendarPlus, ChevronRight, ChevronLeft, Loader2, CheckCircle } from 'lucide-react';
import otfLogo from '@/assets/otf-logo.jpg';
import { format, parse } from 'date-fns';

const OTF_ORANGE = '#FF6900';
const TOTAL_STEPS = 9; // welcome + 7 questions + completion

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
  'Get more energy and feel better overall',
  'Train for something specific (race, sport, event)',
  'Get back into a routine after falling off',
  'Reduce stress and improve mental health',
];

const Q3_OPTIONS = [
  'No accountability or motivation to stay consistent',
  "Don't know what to do or how to structure workouts",
  "Schedule is too busy / can't find the time",
  'Past injuries or health concerns',
  "Tried things before that didn't work or stick",
  "Haven't found a gym or program that fits me",
];

const Q6_OPTIONS = ['1-2 days', '3-4 days', '5+ days'];

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
  const [q3, setQ3] = useState('');
  const [q3Other, setQ3Other] = useState('');
  const [q4, setQ4] = useState('');
  const [q5, setQ5] = useState('');
  const [q6, setQ6] = useState('');
  const [q7, setQ7] = useState('');

  // Validation
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (!id) { setError('Invalid link'); setLoading(false); return; }
    (async () => {
      const { data: row, error: err } = await supabase
        .from('intro_questionnaires')
        .select('id, client_first_name, client_last_name, scheduled_class_date, scheduled_class_time, status')
        .eq('id', id)
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
      case 3: return q3 !== '' && (q3 !== 'Other' || q3Other.trim() !== '');
      case 4: return q4.trim() !== '';
      case 5: return q5.trim() !== '';
      case 6: return q6 !== '';
      case 7: return true; // optional
      default: return true;
    }
  }, [step, q1, q1Other, q2, q3, q3Other, q4, q5, q6]);

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
    const finalQ3 = q3 === 'Other' ? q3Other : q3;
    const { error: err } = await supabase
      .from('intro_questionnaires')
      .update({
        q1_fitness_goal: finalQ1,
        q2_fitness_level: q2,
        q3_obstacle: finalQ3,
        q4_past_experience: q4,
        q5_emotional_driver: q5,
        q6_weekly_commitment: q6,
        q7_coach_notes: q7 || null,
        status: 'completed',
        submitted_at: new Date().toISOString(),
      })
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
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'otf-intro-class.ics'; a.click();
    URL.revokeObjectURL(url);
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
      <h1 className="text-2xl font-bold mb-2" style={{ color: '#333' }}>You already submitted your questionnaire.</h1>
      <p className="text-lg" style={{ color: '#666' }}>See you at class, {data.client_first_name}! 🧡</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <img src={otfLogo} alt="Orangetheory Fitness" className="h-12 mb-6 object-contain" />
      <h1 className="text-2xl font-bold mb-2" style={{ color: '#333' }}>Invalid Link</h1>
      <p style={{ color: '#666' }}>This questionnaire link is not valid. Please check the link you received.</p>
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

  const renderStep = () => {
    switch (step) {
      case 0: // Welcome
        return (
          <div className="text-center space-y-6">
            <h1 className="text-2xl font-bold" style={{ color: '#333' }}>Help Your Coach Help You</h1>
            <p className="text-base" style={{ color: '#666' }}>
              Answer a few quick questions so your coach can personalize your first class. Takes about 2 minutes.
            </p>
            <div className="rounded-xl p-4" style={{ backgroundColor: '#FFF5EB', border: `1px solid ${OTF_ORANGE}30` }}>
              <p className="text-lg" style={{ color: '#333' }}>
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
            <h2 className="text-xl font-bold" style={{ color: '#333' }}>What's your #1 fitness goal right now?</h2>
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

      case 2: // Q2
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-bold" style={{ color: '#333' }}>On a scale of 1 to 10, how would you rate your current fitness level?</h2>
            <div className="grid grid-cols-5 gap-2">
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button
                  key={n}
                  onClick={() => { setQ2(n); setShowError(false); }}
                  className="h-14 rounded-xl font-bold text-lg transition-all duration-200 border-2"
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
            <div className="flex justify-between text-xs px-1" style={{ color: '#999' }}>
              <span>Starting from scratch</span>
              <span>Decent but inconsistent</span>
              <span>Peak fitness</span>
            </div>
            {showError && !canProceed() && <p className="text-sm" style={{ color: '#ef4444' }}>Please select a number.</p>}
          </div>
        );

      case 3: // Q3
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold" style={{ color: '#333' }}>What's been the biggest thing stopping you from reaching your fitness goals?</h2>
            <div className="space-y-3">
              {Q3_OPTIONS.map(opt => (
                <SelectCard key={opt} label={opt} selected={q3 === opt} onSelect={() => { setQ3(opt); setShowError(false); }} />
              ))}
              <SelectCard label="Other (please share)" selected={q3 === 'Other'} onSelect={() => { setQ3('Other'); setShowError(false); }} />
              {q3 === 'Other' && (
                <Input
                  value={q3Other}
                  onChange={e => setQ3Other(e.target.value)}
                  placeholder="Tell us what's been stopping you..."
                  className="mt-2 h-12 text-base rounded-xl"
                  autoFocus
                />
              )}
            </div>
            {showError && !canProceed() && <p className="text-sm" style={{ color: '#ef4444' }}>Please select an option to continue.</p>}
          </div>
        );

      case 4: // Q4
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold" style={{ color: '#333' }}>Have you tried other gyms, programs, or fitness routines before? How did that go?</h2>
            <Textarea
              value={q4}
              onChange={e => { setQ4(e.target.value); setShowError(false); }}
              placeholder="Tell us briefly what you've tried and what happened."
              className="min-h-[120px] text-base rounded-xl"
            />
            {showError && !canProceed() && <p className="text-sm" style={{ color: '#ef4444' }}>Please share a bit about your experience.</p>}
          </div>
        );

      case 5: // Q5
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold" style={{ color: '#333' }}>If this class turns out to be exactly what you've been looking for, what would that change for you?</h2>
            <Textarea
              value={q5}
              onChange={e => { setQ5(e.target.value); setShowError(false); }}
              placeholder="What would it mean for your life if you finally found something that worked?"
              className="min-h-[120px] text-base rounded-xl"
            />
            {showError && !canProceed() && <p className="text-sm" style={{ color: '#ef4444' }}>Please share what this would mean for you.</p>}
          </div>
        );

      case 6: // Q6
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-bold" style={{ color: '#333' }}>How many days per week could you realistically commit to working out?</h2>
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
            {showError && !canProceed() && <p className="text-sm" style={{ color: '#ef4444' }}>Please select an option.</p>}
          </div>
        );

      case 7: // Q7
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold" style={{ color: '#333' }}>
              Anything else you'd like your coach to know?
              <span className="text-sm font-normal ml-2" style={{ color: '#999' }}>(Optional)</span>
            </h2>
            <p className="text-sm" style={{ color: '#999' }}>Injuries, preferences, concerns, questions — anything helps.</p>
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
            <h1 className="text-2xl font-bold" style={{ color: '#333' }}>
              You're all set, {data.client_first_name}!
            </h1>
            <p className="text-lg" style={{ color: '#666' }}>
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
            <span className="text-xs font-medium" style={{ color: '#999' }}>{step} of 7</span>
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
