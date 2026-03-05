import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const ROLES = [
  'Sales Associate (SA)',
  'Assistant Studio Leader (ASL)',
  'Coach',
  'Head Coach',
] as const;

const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Either — open to both'] as const;

const DAYS_CONFIG: { day: string; slots: string[] }[] = [
  { day: 'Monday', slots: Array.from({ length: 14 }, (_, i) => `${String(5 + i).padStart(2, '0')}:00`) },
  { day: 'Tuesday', slots: Array.from({ length: 14 }, (_, i) => `${String(5 + i).padStart(2, '0')}:00`) },
  { day: 'Wednesday', slots: Array.from({ length: 14 }, (_, i) => `${String(5 + i).padStart(2, '0')}:00`) },
  { day: 'Thursday', slots: Array.from({ length: 14 }, (_, i) => `${String(5 + i).padStart(2, '0')}:00`) },
  { day: 'Friday', slots: Array.from({ length: 14 }, (_, i) => `${String(5 + i).padStart(2, '0')}:00`) },
  { day: 'Saturday', slots: ['07:00', '08:00', '09:00', '10:00'] },
  { day: 'Sunday', slots: ['10:00', '11:00', '12:00', '13:00'] },
];

// All unique time slots across all days for rows
const ALL_SLOTS = Array.from({ length: 14 }, (_, i) => `${String(5 + i).padStart(2, '0')}:00`);

function formatSlot(s: string) {
  const h = parseInt(s);
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

export default function Apply() {
  const { token } = useParams<{ token?: string }>();
  const [step, setStep] = useState<'loading' | 'form' | 'submitting' | 'done' | 'duplicate' | 'invalid' | 'expired'>('loading');
  const [tokenCandidate, setTokenCandidate] = useState<any>(null);

  // Form state
  const [role, setRole] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [belongingEssay, setBelongingEssay] = useState('');
  const [futureResume, setFutureResume] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoError, setVideoError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New fields
  const [availability, setAvailability] = useState<Record<string, string[]>>({});
  const [employmentType, setEmploymentType] = useState('');
  const [hoursPerWeek, setHoursPerWeek] = useState('');

  // Token resolution
  useEffect(() => {
    if (!token) {
      setStep('form');
      return;
    }
    (async () => {
      const { data } = await (supabase
        .from('candidates')
        .select('*') as any)
        .eq('application_token', token)
        .maybeSingle();
      if (!data) {
        setStep('invalid');
        return;
      }
      if ((data as any).application_submitted_at) {
        setStep('expired');
        return;
      }
      setTokenCandidate(data);
      setFullName((data as any).full_name || '');
      setRole((data as any).role || '');
      setEmail((data as any).email || '');
      setPhone((data as any).phone || '');
      setStep('form');
    })();
  }, [token]);

  const formatPhone = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setVideoError('');
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['mp4', 'mov', 'heic'].includes(ext || '')) {
      setVideoError('Please upload an MP4, MOV, or HEIC file.');
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setVideoError('File must be under 500MB.');
      return;
    }
    setVideoFile(file);
  };

  const toggleSlot = (day: string, slot: string) => {
    setAvailability(prev => {
      const daySlots = prev[day] || [];
      const has = daySlots.includes(slot);
      return {
        ...prev,
        [day]: has ? daySlots.filter(s => s !== slot) : [...daySlots, slot],
      };
    });
  };

  const hasAnyAvailability = Object.values(availability).some(v => v.length > 0);

  const isValid = role && fullName.trim() && email.trim() && phone.replace(/\D/g, '').length === 10
    && videoFile && belongingEssay.trim() && futureResume.trim()
    && hasAnyAvailability && employmentType && hoursPerWeek && parseInt(hoursPerWeek) >= 1 && parseInt(hoursPerWeek) <= 40;

  const handleSubmit = async () => {
    if (!isValid || !videoFile) return;
    setStep('submitting');

    try {
      // For public form (no token), check duplicate
      if (!tokenCandidate) {
        const { data: existing } = await supabase
          .from('candidates')
          .select('id')
          .eq('email', email.trim().toLowerCase())
          .maybeSingle();
        if (existing) {
          setStep('duplicate');
          return;
        }
      }

      // Upload video
      setUploadProgress(true);
      const ext = videoFile.name.split('.').pop();
      const fileName = `${Date.now()}-${fullName.replace(/\s+/g, '-').toLowerCase()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('candidate-videos')
        .upload(fileName, videoFile, { cacheControl: '3600', upsert: false });
      if (uploadError) throw new Error('Video upload failed. Please try again.');

      const { data: urlData } = supabase.storage
        .from('candidate-videos')
        .getPublicUrl(fileName);
      setUploadProgress(false);

      const candidatePayload = {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        role,
        video_url: urlData.publicUrl,
        belonging_essay: belongingEssay.trim(),
        future_resume: futureResume.trim(),
        three_step_complete: true,
        stage: 'applied',
        availability_schedule: availability,
        employment_type: employmentType,
        hours_per_week: parseInt(hoursPerWeek),
      } as any;

      if (tokenCandidate) {
        // Update existing candidate record
        candidatePayload.application_submitted_at = new Date().toISOString();
        const { error: updateError } = await supabase
          .from('candidates')
          .update(candidatePayload)
          .eq('id', tokenCandidate.id);
        if (updateError) throw updateError;

        await supabase.from('candidate_history').insert({
          candidate_id: tokenCandidate.id,
          action: 'Application submitted via unique link',
          performed_by: 'System',
        } as any);
      } else {
        // Insert new candidate
        const { error: insertError } = await supabase.from('candidates').insert(candidatePayload);
        if (insertError) {
          if (insertError.message?.includes('candidates_email_unique')) {
            setStep('duplicate');
            return;
          }
          throw insertError;
        }

        // Log history
        const { data: candidate } = await supabase
          .from('candidates')
          .select('id')
          .eq('email', email.trim().toLowerCase())
          .single();
        if (candidate) {
          await supabase.from('candidate_history').insert({
            candidate_id: candidate.id,
            action: 'Application received',
            performed_by: 'System',
          } as any);
        }
      }

      setStep('done');
    } catch (err: any) {
      setUploadProgress(false);
      toast.error(err?.message || 'Something went wrong. Please try again.');
      setStep('form');
    }
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (step === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <p className="text-lg font-semibold">This link is not valid.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-orange-500 mx-auto" />
            <p className="text-lg font-semibold">This application link has already been used.</p>
            <p className="text-muted-foreground text-sm">Please contact OTF Tuscaloosa if you believe this is an error.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <p className="text-lg font-semibold">We got it.</p>
            <p className="text-muted-foreground">
              We review every application personally. If we feel the energy — you'll hear from us. 🧡
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'duplicate') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-orange-500 mx-auto" />
            <p className="text-lg font-semibold">We already have your application.</p>
            <p className="text-muted-foreground">We'll be in touch.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Join the Team</h1>
          <p className="text-muted-foreground">OTF Tuscaloosa — Application</p>
        </div>

        {/* Section 1 — Role (Card Radio) */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="font-semibold text-lg">What role are you applying for? <span className="text-sm font-normal text-muted-foreground">(Select one)</span></h2>
            <RadioGroup value={role} onValueChange={setRole} className="space-y-2">
              {ROLES.map((r) => (
                <label
                  key={r}
                  htmlFor={`role-${r}`}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    role === r
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30'
                      : 'border-border hover:border-muted-foreground/30'
                  }`}
                >
                  <RadioGroupItem value={r} id={`role-${r}`} className={role === r ? 'text-orange-500 border-orange-500' : ''} />
                  <span className={`font-medium ${role === r ? 'text-orange-700 dark:text-orange-300' : ''}`}>{r}</span>
                </label>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Section 2 — Basic Info */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="font-semibold text-lg">Basic Info</h2>
            <div className="space-y-3">
              <div>
                <Label>Full Name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
              </div>
              <div>
                <Label>Email Address</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(555) 555-5555" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3 — The Three Steps */}
        <Card>
          <CardContent className="pt-6 space-y-8">
            <h2 className="font-semibold text-lg">The Three Steps</h2>

            {/* Step 1 — Video */}
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              <h3 className="font-semibold uppercase text-sm tracking-wide">Step 1 — The Video Introduction</h3>
              <p className="text-sm text-muted-foreground italic leading-relaxed">
                "Tell us who you are — not what you've done. What lights you up, what drives you, and why OTF Tuscaloosa feels like your kind of place."
              </p>
              <p className="text-xs text-muted-foreground">Record a 60–90 second video and upload it here.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp4,.mov,.heic,video/mp4,video/quicktime"
                onChange={handleVideoChange}
                className="hidden"
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
                <Upload className="w-4 h-4" />
                {videoFile ? videoFile.name : 'Upload video file'}
              </Button>
              <p className="text-[10px] text-muted-foreground">Accepted formats: MP4, MOV, HEIC. Max 500MB.</p>
              {videoError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {videoError}
                </p>
              )}
            </div>

            {/* Step 2 — Belonging Essay */}
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              <h3 className="font-semibold uppercase text-sm tracking-wide">Step 2 — The Belonging Essay</h3>
              <p className="text-sm text-muted-foreground italic leading-relaxed">
                "OTF Tuscaloosa runs on two beliefs: extraordinary experience, always — and we don't sell, we belong. Describe a moment in your life, inside or outside of fitness, where you created an extraordinary experience for someone else. What did you do, why did you do it, and what happened?"
              </p>
              <p className="text-xs text-muted-foreground">One page maximum. Write directly below.</p>
              <Textarea value={belongingEssay} onChange={(e) => setBelongingEssay(e.target.value)} className="min-h-[200px]" placeholder="Write your response here..." />
            </div>

            {/* Step 3 — Future Resume */}
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              <h3 className="font-semibold uppercase text-sm tracking-wide">Step 3 — The Future Resume</h3>
              <p className="text-sm text-muted-foreground italic leading-relaxed">
                "Forget your past jobs. What do you want to build, become, and be known for — in your career and your life? This is your future resume. Write it like it already happened."
              </p>
              <p className="text-xs text-muted-foreground">One page maximum. Write directly below.</p>
              <Textarea value={futureResume} onChange={(e) => setFutureResume(e.target.value)} className="min-h-[200px]" placeholder="Write your response here..." />
            </div>
          </CardContent>
        </Card>

        {/* Section 4 — Availability, Employment, Hours */}
        <Card>
          <CardContent className="pt-6 space-y-8">
            <h2 className="font-semibold text-lg">Scheduling & Availability</h2>

            {/* Availability Grid */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">What is your availability?</h3>
              <p className="text-xs text-muted-foreground">Select all times you're available each week.</p>
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="p-1 text-left w-16"></th>
                      {DAYS_CONFIG.map(d => (
                        <th key={d.day} className="p-1 text-center font-medium" style={{ minWidth: 44 }}>
                          {d.day.slice(0, 3)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ALL_SLOTS.map(slot => (
                      <tr key={slot}>
                        <td className="p-1 text-muted-foreground whitespace-nowrap">{formatSlot(slot)}</td>
                        {DAYS_CONFIG.map(d => {
                          const available = d.slots.includes(slot);
                          if (!available) {
                            return <td key={d.day} className="p-0.5"><div className="w-11 h-11" /></td>;
                          }
                          const selected = (availability[d.day] || []).includes(slot);
                          return (
                            <td key={d.day} className="p-0.5">
                              <button
                                type="button"
                                onClick={() => toggleSlot(d.day, slot)}
                                className={`w-11 h-11 rounded transition-colors ${
                                  selected
                                    ? 'bg-orange-500 border-orange-600'
                                    : 'bg-muted border border-border hover:bg-muted-foreground/10'
                                }`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Employment Type */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Are you looking for full-time or part-time?</h3>
              <RadioGroup value={employmentType} onValueChange={setEmploymentType} className="space-y-2">
                {EMPLOYMENT_TYPES.map((et) => (
                  <label
                    key={et}
                    htmlFor={`emp-${et}`}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      employmentType === et
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30'
                        : 'border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    <RadioGroupItem value={et} id={`emp-${et}`} className={employmentType === et ? 'text-orange-500 border-orange-500' : ''} />
                    <span className={`font-medium ${employmentType === et ? 'text-orange-700 dark:text-orange-300' : ''}`}>{et}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {/* Hours per week */}
            <div className="space-y-2">
              <Label className="font-semibold text-sm">How many hours are you looking to work each week?</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={40}
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(e.target.value)}
                placeholder="e.g. 25"
                className="max-w-[120px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 5 — Submit */}
        <Button
          className="w-full"
          size="lg"
          disabled={!isValid || step === 'submitting'}
          onClick={handleSubmit}
        >
          {step === 'submitting' ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {uploadProgress ? 'Uploading video…' : 'Submitting…'}
            </>
          ) : (
            'Submit Application'
          )}
        </Button>
      </div>
    </div>
  );
}
