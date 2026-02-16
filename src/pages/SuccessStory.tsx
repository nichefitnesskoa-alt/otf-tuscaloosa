import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ChevronRight, ChevronLeft, Loader2, CheckCircle, Check, Camera, Share2 } from 'lucide-react';
import otfLogo from '@/assets/otf-logo.jpg';
import { toast } from 'sonner';

const OTF_ORANGE = '#FF6900';
// Steps: 0=welcome, 1=name (skippable), 2=studio/duration, ..., 10=permission, 11=completion

const DURATION_OPTIONS = [
  'Less than 3 months',
  '3-6 months',
  '6-12 months',
  '1-2 years',
  '2+ years',
];

const FAVORITE_ASPECT_OPTIONS = [
  'The community',
  'The coaches',
  'The workouts',
  'The technology (heart rate zones)',
  'The variety',
  'The accountability',
  'The results',
  'Other',
];

interface StoryData {
  id: string;
  member_first_name: string;
  member_last_name: string;
  studio_location: string | null;
  status: string;
}

export default function SuccessStory() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [direction, setDirection] = useState(1);
  const [showError, setShowError] = useState(false);
  const [namePreFilled, setNamePreFilled] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studioLocation, setStudioLocation] = useState('Tuscaloosa');
  const [duration, setDuration] = useState('');
  const [motivation, setMotivation] = useState('');
  const [overallExperience, setOverallExperience] = useState('');
  const [specificChanges, setSpecificChanges] = useState('');
  const [proudMoment, setProudMoment] = useState('');
  const [fitnessImprovement, setFitnessImprovement] = useState('');
  const [favoriteAspects, setFavoriteAspects] = useState<string[]>([]);
  const [favoriteOther, setFavoriteOther] = useState('');
  const [otherComments, setOtherComments] = useState('');
  const [socialPermission, setSocialPermission] = useState<boolean | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setError('Invalid link'); setLoading(false); return; }
    (async () => {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const { data: row, error: err } = await supabase
        .from('success_stories')
        .select('id, member_first_name, member_last_name, studio_location, status')
        .or(isUUID ? `id.eq.${id},slug.eq.${id}` : `slug.eq.${id}`)
        .maybeSingle();
      if (err || !row) { setError('Invalid link'); setLoading(false); return; }
      if (row.status === 'submitted') { setError('already_submitted'); setData(row as StoryData); setLoading(false); return; }
      setData(row as StoryData);
      setFirstName(row.member_first_name || '');
      setLastName(row.member_last_name || '');
      setStudioLocation(row.studio_location || 'Tuscaloosa');
      if (row.member_first_name && row.member_first_name.trim() !== '') {
        setNamePreFilled(true);
      }
      setLoading(false);
    })();
  }, [id]);

  const canProceed = useCallback(() => {
    switch (step) {
      case 1: return firstName.trim() !== '';
      case 2: return duration !== '';
      case 3: return motivation.trim() !== '';
      case 10: return socialPermission !== null;
      default: return true;
    }
  }, [step, firstName, duration, motivation, socialPermission]);

  const getNextStep = (current: number) => {
    const next = current + 1;
    if (next === 1 && namePreFilled) return 2;
    return next;
  };

  const getPrevStep = (current: number) => {
    const prev = current - 1;
    if (prev === 1 && namePreFilled) return 0;
    return prev;
  };

  const goNext = () => {
    if (!canProceed()) { setShowError(true); return; }
    setShowError(false);
    setDirection(1);
    if (step === 10) { handleSubmit(); return; }
    setStep(s => getNextStep(s));
  };

  const goBack = () => {
    setShowError(false);
    setDirection(-1);
    setStep(s => Math.max(0, getPrevStep(s)));
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!data) return;
    setSubmitting(true);

    let photoUrl: string | null = null;

    // Try uploading photo
    if (photoFile) {
      try {
        const ext = photoFile.name.split('.').pop();
        const filePath = `${data.id}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('success-story-photos')
          .upload(filePath, photoFile, { upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('success-story-photos').getPublicUrl(filePath);
          photoUrl = urlData.publicUrl;
        } else {
          toast.error('Photo upload failed, but your story will be saved.');
        }
      } catch {
        toast.error('Photo upload failed, but your story will be saved.');
      }
    }

    const finalFavorite = favoriteAspects.map(v => v === 'Other' ? favoriteOther : v).join(' | ');

    const { error: err } = await supabase
      .from('success_stories')
      .update({
        member_first_name: firstName.trim(),
        member_last_name: lastName.trim(),
        studio_location: studioLocation,
        membership_duration: duration,
        motivation,
        overall_experience: overallExperience || null,
        specific_changes: specificChanges || null,
        proud_moment: proudMoment || null,
        fitness_health_improvement: fitnessImprovement || null,
        favorite_aspect: finalFavorite || null,
        other_comments: otherComments || null,
        social_media_permission: socialPermission,
        photo_url: photoUrl,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', data.id);

    setSubmitting(false);
    if (err) { console.error(err); toast.error('Something went wrong. Please try again.'); return; }
    setDirection(1);
    setStep(11);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My OTF Success Story',
          text: `I just shared my Orangetheory Fitness success story! 🧡💪`,
        });
      } catch { /* user cancelled */ }
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: OTF_ORANGE }} />
    </div>
  );

  if (error === 'already_submitted' && data) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <img src={otfLogo} alt="Orangetheory Fitness" className="h-12 mb-6 object-contain" />
      <CheckCircle className="w-16 h-16 mb-4 text-green-500" />
      <h1 className="text-2xl font-bold mb-2" style={{ color: '#1a1a1a' }}>You've already submitted your story!</h1>
      <p className="text-lg" style={{ color: '#555' }}>Thank you, {data.member_first_name}! 🧡</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <img src={otfLogo} alt="Orangetheory Fitness" className="h-12 mb-6 object-contain" />
      <h1 className="text-2xl font-bold mb-2" style={{ color: '#1a1a1a' }}>Invalid Link</h1>
      <p style={{ color: '#555' }}>This story link is not valid. Please check the link you received.</p>
    </div>
  );

  if (!data) return null;

  const progress = step === 0 ? 0 : step === 11 ? 100 : (step / 10) * 100;

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

  const MultiSelectCard = ({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) => (
    <button
      onClick={onToggle}
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
      {label}
    </button>
  );

  const renderStep = () => {
    switch (step) {
      case 0: // Welcome
        return (
          <div className="text-center space-y-6">
            <h1 className="text-2xl font-bold" style={{ color: '#1a1a1a' }}>OTF Success Story</h1>
            <p className="text-base" style={{ color: '#555' }}>
              We create a culture where everyONE has an OTF success story
            </p>
            <div className="rounded-xl p-4" style={{ backgroundColor: '#FFF5EB', border: `1px solid ${OTF_ORANGE}30` }}>
              <p className="text-lg" style={{ color: '#1a1a1a' }}>
                Share your journey with us — your story can inspire someone to take their first step! 🧡
              </p>
            </div>
            <Button onClick={goNext} className="w-full h-14 text-lg font-semibold rounded-xl text-white" style={{ backgroundColor: OTF_ORANGE }}>
              Let's Go <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        );

      case 1: // Name
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>What's your name?</h2>
            <Input
              value={firstName}
              onChange={e => { setFirstName(e.target.value); setShowError(false); }}
              placeholder="First Name *"
              className="h-14 text-base rounded-xl"
              autoFocus
            />
            <Input
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="Last Name"
              className="h-14 text-base rounded-xl"
            />
            {showError && !firstName.trim() && <p className="text-sm text-red-500">First name is required.</p>}
          </div>
        );

      case 2: // Studio & Duration
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>Which Orangetheory studio are you a member at?</h2>
              <Input
                value={studioLocation}
                onChange={e => setStudioLocation(e.target.value)}
                placeholder="Studio location"
                className="h-14 text-base rounded-xl"
              />
            </div>
            <div className="space-y-3">
              <h2 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>How long have you been a member?</h2>
              <div className="space-y-3">
                {DURATION_OPTIONS.map(opt => (
                  <SelectCard
                    key={opt}
                    label={opt}
                    selected={duration === opt}
                    onSelect={() => { setDuration(opt); setShowError(false); }}
                  />
                ))}
              </div>
              {showError && !duration && <p className="text-sm text-red-500">Please select your membership duration.</p>}
            </div>
          </div>
        );

      case 3: // Motivation
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>What motivated you to sign up?</h2>
            <Textarea
              value={motivation}
              onChange={e => { setMotivation(e.target.value); setShowError(false); }}
              placeholder="What made you walk through the door?"
              className="min-h-[120px] text-base rounded-xl"
              autoFocus
            />
            {showError && !motivation.trim() && <p className="text-sm text-red-500">Please share what motivated you.</p>}
          </div>
        );

      case 4: // Overall Experience
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>How would you describe your overall experience at Orangetheory so far?</h2>
            <p className="text-sm" style={{ color: '#555' }}>Please share how the workouts, environment, or community have impacted you.</p>
            <Textarea
              value={overallExperience}
              onChange={e => setOverallExperience(e.target.value)}
              placeholder="Share your experience..."
              className="min-h-[120px] text-base rounded-xl"
              autoFocus
            />
          </div>
        );

      case 5: // Specific Changes
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>What specific changes have you experienced since joining?</h2>
            <p className="text-sm" style={{ color: '#555' }}>Please provide measurable changes, such as weight loss, improved endurance, increased strength, etc.</p>
            <Textarea
              value={specificChanges}
              onChange={e => setSpecificChanges(e.target.value)}
              placeholder="Share your changes..."
              className="min-h-[120px] text-base rounded-xl"
              autoFocus
            />
          </div>
        );

      case 6: // Proud Moment
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>Can you share a moment or achievement you're particularly proud of?</h2>
            <p className="text-sm" style={{ color: '#555' }}>e.g., completing a challenging workout, hitting a personal best, etc.</p>
            <Textarea
              value={proudMoment}
              onChange={e => setProudMoment(e.target.value)}
              placeholder="Share your proudest moment..."
              className="min-h-[120px] text-base rounded-xl"
              autoFocus
            />
          </div>
        );

      case 7: // Fitness & Health
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>How has your overall fitness and health improved?</h2>
            <p className="text-sm" style={{ color: '#555' }}>Please include any metrics if applicable, such as running times, strength benchmarks, etc.</p>
            <Textarea
              value={fitnessImprovement}
              onChange={e => setFitnessImprovement(e.target.value)}
              placeholder="Share your improvements..."
              className="min-h-[120px] text-base rounded-xl"
              autoFocus
            />
          </div>
        );

      case 8: // Favorite Aspect
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>What is your favorite aspect of the Orangetheory workout?</h2>
            <p className="text-sm" style={{ color: '#555' }}>Select all that apply.</p>
            <div className="space-y-3">
              {FAVORITE_ASPECT_OPTIONS.map(opt => (
                <MultiSelectCard
                  key={opt}
                  label={opt}
                  selected={favoriteAspects.includes(opt)}
                  onToggle={() => {
                    setFavoriteAspects(prev =>
                      prev.includes(opt) ? prev.filter(v => v !== opt) : [...prev, opt]
                    );
                  }}
                />
              ))}
              {favoriteAspects.includes('Other') && (
                <Input
                  value={favoriteOther}
                  onChange={e => setFavoriteOther(e.target.value)}
                  placeholder="Tell us more..."
                  className="mt-2 h-12 text-base rounded-xl"
                  autoFocus
                />
              )}
            </div>
          </div>
        );

      case 9: // Other Comments
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>Do you have any other comments or suggestions for us?</h2>
            <p className="text-sm" style={{ color: '#555' }}>Anything else you'd like to share?</p>
            <Textarea
              value={otherComments}
              onChange={e => setOtherComments(e.target.value)}
              placeholder="Optional..."
              className="min-h-[120px] text-base rounded-xl"
            />
          </div>
        );

      case 10: // Permission & Photo
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>Do we have your permission to share your OTF story on our social media channels?</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setSocialPermission(true); setShowError(false); }}
                  className="p-4 rounded-xl border-2 text-lg font-semibold transition-all"
                  style={{
                    borderColor: socialPermission === true ? '#22c55e' : '#e5e7eb',
                    backgroundColor: socialPermission === true ? '#f0fdf4' : 'white',
                    color: socialPermission === true ? '#16a34a' : '#333',
                  }}
                >
                  Yes
                </button>
                <button
                  onClick={() => { setSocialPermission(false); setShowError(false); }}
                  className="p-4 rounded-xl border-2 text-lg font-semibold transition-all"
                  style={{
                    borderColor: socialPermission === false ? '#ef4444' : '#e5e7eb',
                    backgroundColor: socialPermission === false ? '#fef2f2' : 'white',
                    color: socialPermission === false ? '#dc2626' : '#333',
                  }}
                >
                  No
                </button>
              </div>
              {showError && socialPermission === null && <p className="text-sm text-red-500">Please select an option.</p>}
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold" style={{ color: '#1a1a1a' }}>Optional: Share a photo of your journey</h3>
              <p className="text-sm" style={{ color: '#555' }}>Before/after photos are great if you have them!</p>
              <label
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:border-orange-400"
                style={{ borderColor: photoPreview ? OTF_ORANGE : '#d1d5db' }}
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="h-full w-full object-cover rounded-xl" />
                ) : (
                  <div className="flex flex-col items-center gap-2" style={{ color: '#999' }}>
                    <Camera className="w-8 h-8" />
                    <span className="text-sm">Tap to upload a photo</span>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
              </label>
            </div>
          </div>
        );

      case 11: // Completion
        return (
          <div className="text-center space-y-6">
            <CheckCircle className="w-20 h-20 mx-auto text-green-500" />
            <h1 className="text-2xl font-bold" style={{ color: '#1a1a1a' }}>Thank you, {firstName}!</h1>
            <p className="text-base" style={{ color: '#555' }}>
              Your story can inspire others to take the first step towards their fitness journey!
            </p>
            <p className="text-base" style={{ color: '#555' }}>
              We appreciate you sharing your experience with us. 🧡
            </p>
            {socialPermission && navigator.share && (
              <Button
                onClick={handleShare}
                className="w-full h-14 text-lg font-semibold rounded-xl text-white"
                style={{ backgroundColor: OTF_ORANGE }}
              >
                <Share2 className="w-5 h-5 mr-2" /> Share on Social Media
              </Button>
            )}
          </div>
        );

      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3">
        <div className="flex items-center justify-center">
          <img src={otfLogo} alt="Orangetheory Fitness" className="h-10 object-contain" />
        </div>
        {step > 0 && step < 11 && (
          <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: OTF_ORANGE }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-5 py-6 max-w-lg mx-auto w-full overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer nav */}
      {step > 0 && step < 11 && (
        <div className="sticky bottom-0 bg-white border-t px-5 py-4 flex gap-3 max-w-lg mx-auto w-full">
          <Button variant="outline" onClick={goBack} className="h-12 px-6 rounded-xl flex-1" disabled={submitting}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Button
            onClick={goNext}
            className="h-12 px-6 rounded-xl flex-[2] text-white font-semibold"
            style={{ backgroundColor: OTF_ORANGE }}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : step === 10 ? 'Submit' : <>Next <ChevronRight className="w-4 h-4 ml-1" /></>}
          </Button>
        </div>
      )}
    </div>
  );
}
