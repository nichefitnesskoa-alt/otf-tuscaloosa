import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const ROLES = [
  'Sales Associate (SA)',
  'Assistant Studio Leader (ASL)',
  'Coach',
  'Head Coach',
] as const;

const EMPLOYMENT_TYPES = ['Full time', 'Part time', 'Either, open to both'] as const;

const DAYS_CONFIG: { day: string; slots: string[] }[] = [
  { day: 'Monday', slots: Array.from({ length: 14 }, (_, i) => `${String(5 + i).padStart(2, '0')}:00`) },
  { day: 'Tuesday', slots: Array.from({ length: 14 }, (_, i) => `${String(5 + i).padStart(2, '0')}:00`) },
  { day: 'Wednesday', slots: Array.from({ length: 14 }, (_, i) => `${String(5 + i).padStart(2, '0')}:00`) },
  { day: 'Thursday', slots: Array.from({ length: 14 }, (_, i) => `${String(5 + i).padStart(2, '0')}:00`) },
  { day: 'Friday', slots: Array.from({ length: 14 }, (_, i) => `${String(5 + i).padStart(2, '0')}:00`) },
  { day: 'Saturday', slots: ['07:00', '08:00', '09:00', '10:00'] },
  { day: 'Sunday', slots: ['10:00', '11:00', '12:00', '13:00'] },
];

const ALL_SLOTS = Array.from({ length: 14 }, (_, i) => `${String(5 + i).padStart(2, '0')}:00`);

function formatSlot(s: string) {
  const h = parseInt(s);
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

/** Normalize role field: could be text[] from DB or legacy single string */
function normalizeRoles(val: unknown): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val) return [val];
  return [];
}

export default function Apply() {
  const { token } = useParams<{ token?: string }>();
  const [step, setStep] = useState<'loading' | 'form' | 'submitting' | 'done' | 'duplicate' | 'invalid' | 'expired'>('loading');
  const [tokenCandidate, setTokenCandidate] = useState<any>(null);

  // Form state
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [belongingEssay, setBelongingEssay] = useState('');
  const [futureResume, setFutureResume] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoError, setVideoError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [availability, setAvailability] = useState<Record<string, string[]>>({});
  const [employmentType, setEmploymentType] = useState('');
  const [hoursPerWeek, setHoursPerWeek] = useState('');

  // Token / slug resolution
  useEffect(() => {
    if (!token) {
      setStep('form');
      return;
    }
    (async () => {
      let candidate: any = null;
      const { data: bySlug } = await (supabase
        .from('candidates')
        .select('*') as any)
        .eq('application_slug', token)
        .maybeSingle();
      if (bySlug) {
        candidate = bySlug;
      } else {
        const { data: byToken } = await (supabase
          .from('candidates')
          .select('*') as any)
          .eq('application_token', token)
          .maybeSingle();
        candidate = byToken;
      }

      if (!candidate) {
        setStep('invalid');
        return;
      }
      if (candidate.application_submitted_at) {
        setStep('expired');
        return;
      }
      setTokenCandidate(candidate);
      setFullName(candidate.full_name || '');
      setSelectedRoles(normalizeRoles(candidate.role));
      setEmail(candidate.email || '');
      setPhone(candidate.phone || '');
      setStep('form');
    })();
  }, [token]);

  const firstName = tokenCandidate?.full_name?.split(' ')[0] || '';

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
    if (!['mp4', 'mov'].includes(ext || '')) {
      setVideoError('We need an MP4 or MOV file for this one.');
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setVideoError('That file is too big. Keep it under 500MB.');
      return;
    }
    setVideoFile(file);
  };

  const toggleSlot = (day: string, slot: string) => {
    setAvailability(prev => {
      const daySlots = prev[day] || [];
      const has = daySlots.includes(slot);
      return { ...prev, [day]: has ? daySlots.filter(s => s !== slot) : [...daySlots, slot] };
    });
  };

  // Drag-to-select state
  const dragRef = useRef<{ mode: 'add' | 'remove'; lastKey: string } | null>(null);
  const gridRef = useRef<HTMLTableElement>(null);

  const hitTestSlot = (clientX: number, clientY: number): { day: string; slot: string } | null => {
    if (!gridRef.current) return null;
    const buttons = gridRef.current.querySelectorAll<HTMLButtonElement>('[data-day][data-slot]');
    for (const btn of buttons) {
      const r = btn.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        return { day: btn.dataset.day!, slot: btn.dataset.slot! };
      }
    }
    return null;
  };

  const applyDrag = (day: string, slot: string) => {
    const key = `${day}-${slot}`;
    if (!dragRef.current || dragRef.current.lastKey === key) return;
    dragRef.current.lastKey = key;
    setAvailability(prev => {
      const daySlots = prev[day] || [];
      if (dragRef.current!.mode === 'add') {
        return daySlots.includes(slot) ? prev : { ...prev, [day]: [...daySlots, slot] };
      } else {
        return !daySlots.includes(slot) ? prev : { ...prev, [day]: daySlots.filter(s => s !== slot) };
      }
    });
  };

  const onGridPointerDown = (e: React.PointerEvent) => {
    const hit = hitTestSlot(e.clientX, e.clientY);
    if (!hit) return;
    e.preventDefault();
    const isSelected = (availability[hit.day] || []).includes(hit.slot);
    const mode = isSelected ? 'remove' : 'add';
    dragRef.current = { mode, lastKey: '' };
    applyDrag(hit.day, hit.slot);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onGridPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const hit = hitTestSlot(e.clientX, e.clientY);
    if (hit) applyDrag(hit.day, hit.slot);
  };

  const onGridPointerEnd = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const hasAnyAvailability = Object.values(availability).some(v => v.length > 0);

  const isValid = selectedRoles.length > 0 && fullName.trim() && email.trim() && phone.replace(/\D/g, '').length === 10
    && videoFile && belongingEssay.trim() && futureResume.trim()
    && hasAnyAvailability && employmentType && hoursPerWeek && parseInt(hoursPerWeek) >= 1 && parseInt(hoursPerWeek) <= 40;

  const handleSubmit = async () => {
    if (!isValid || !videoFile) return;
    setStep('submitting');

    try {
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

      setUploadProgress(true);
      const ext = videoFile.name.split('.').pop();
      const fileName = `${Date.now()}-${fullName.replace(/\s+/g, '-').toLowerCase()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('candidate-videos')
        .upload(fileName, videoFile, { cacheControl: '3600', upsert: false });
      if (uploadError) throw new Error('The video didn\'t upload. Give it another try.');

      const { data: urlData } = supabase.storage
        .from('candidate-videos')
        .getPublicUrl(fileName);
      setUploadProgress(false);

      const candidatePayload = {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        role: selectedRoles,
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
        const { error: insertError } = await supabase.from('candidates').insert(candidatePayload);
        if (insertError) {
          if (insertError.message?.includes('candidates_email_unique')) {
            setStep('duplicate');
            return;
          }
          throw insertError;
        }

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
      toast.error(err?.message || 'Something went wrong. Give it another try.');
      setStep('form');
    }
  };

  // --- Status screens ---

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
            <p className="text-lg font-semibold">This link isn't valid.</p>
            <p className="text-muted-foreground text-sm">Reach out to OTF Tuscaloosa directly if you think something went wrong.</p>
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
            <p className="text-lg font-semibold">This one's already been used.</p>
            <p className="text-muted-foreground text-sm">Reach out to OTF Tuscaloosa if you need a new link.</p>
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
            <p className="text-lg font-semibold">You did it. 🧡</p>
            <p className="text-muted-foreground">
              We read every single one of these personally. If we feel it, you'll hear from us.
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
            <p className="text-lg font-semibold">We already have yours.</p>
            <p className="text-muted-foreground">We'll be in touch.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        {/* 1. Greeting */}
        <div className="text-center space-y-3 py-4">
          <h1 className="text-3xl font-bold">
            {tokenCandidate ? `Hey ${firstName}!` : 'Hey, welcome!'}
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed max-w-md mx-auto">
            {tokenCandidate
              ? "We're really glad you're here. This isn't your typical application. We don't do those. Take your time, be yourself, and show us what you're made of. That's all we're looking for. 🧡"
              : "We're really glad you found us. This isn't your typical application. We don't do those. Take your time, be yourself, and show us what you're made of. That's all we're looking for. 🧡"
            }
          </p>
        </div>

        {/* 2. Role Selection */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <h2 className="font-semibold text-lg">What are you applying for?</h2>
              <p className="text-sm text-muted-foreground">Pick everything that fits. You can select more than one.</p>
            </div>
            <div className="space-y-2">
              {ROLES.map((r) => {
                const checked = selectedRoles.includes(r);
                return (
                  <label
                    key={r}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      checked
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30'
                        : 'border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleRole(r)}
                      className={checked ? 'text-orange-500 border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500' : ''}
                    />
                    <span className={`font-medium ${checked ? 'text-orange-700 dark:text-orange-300' : ''}`}>{r}</span>
                  </label>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 3. Basic Info */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="font-semibold text-lg">The basics</h2>
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

        {/* 4. Scheduling & Availability */}
        <Card>
          <CardContent className="pt-6 space-y-8">
            {/* Availability Grid */}
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-sm">When are you available?</h3>
                <p className="text-xs text-muted-foreground">Tap the times that work for you each week.</p>
              </div>
              <div
                className="overflow-x-auto -mx-2 px-2 touch-none select-none"
                onPointerDown={onGridPointerDown}
                onPointerMove={onGridPointerMove}
                onPointerUp={onGridPointerEnd}
                onPointerCancel={onGridPointerEnd}
              >
                <table ref={gridRef} className="border-collapse text-xs">
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
                                data-day={d.day}
                                data-slot={slot}
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
              <h3 className="font-semibold text-sm">Are you looking for full time or part time?</h3>
              <div className="space-y-2">
                {EMPLOYMENT_TYPES.map((et) => {
                  const checked = employmentType === et;
                  return (
                    <label
                      key={et}
                      className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        checked
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30'
                          : 'border-border hover:border-muted-foreground/30'
                      }`}
                      onClick={() => setEmploymentType(et)}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${checked ? 'border-orange-500' : 'border-muted-foreground/40'}`}>
                        {checked && <div className="w-2 h-2 rounded-full bg-orange-500" />}
                      </div>
                      <span className={`font-medium ${checked ? 'text-orange-700 dark:text-orange-300' : ''}`}>{et}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Hours per week */}
            <div className="space-y-2">
              <Label className="font-semibold text-sm">How many hours a week are you hoping to work?</Label>
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

        {/* 5. The Three Steps */}
        <Card>
          <CardContent className="pt-6 space-y-8">
            <h2 className="font-semibold text-lg">The three steps</h2>

            {/* Step 1 */}
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              <h3 className="font-semibold uppercase text-sm tracking-wide">STEP 1 — Video Cover Letter</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Tell me who you are, not what you've done. What lights you up and why does this place feel like your kind of place?
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp4,.mov,video/mp4,video/quicktime"
                onChange={handleVideoChange}
                className="hidden"
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
                <Upload className="w-4 h-4" />
                {videoFile ? videoFile.name : 'Upload your video here'}
              </Button>
              <p className="text-[10px] text-muted-foreground">MP4 or MOV, 500MB max</p>
              {videoError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {videoError}
                </p>
              )}
            </div>

            {/* Step 2 */}
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              <h3 className="font-semibold uppercase text-sm tracking-wide">STEP 2 — The One Person</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                My core value as the Studio Leader is that the experience should be so extraordinary and the relationships so genuine that people ask us how to join before we ever ask them to and they refer their friends before we ever suggest it.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Tell us about a specific person whose life you made better just by how you showed up for them. What did you do, what did they feel, and what happened because of it?
              </p>
              <Textarea value={belongingEssay} onChange={(e) => setBelongingEssay(e.target.value)} className="min-h-[200px]" placeholder="Start writing here..." />
            </div>

            {/* Step 3 */}
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              <h3 className="font-semibold uppercase text-sm tracking-wide">STEP 3 — Future Resume</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Forget your past. What do you want to build, become, and be known for in your career and your life? Tell me like it already happened.
              </p>
              <Textarea value={futureResume} onChange={(e) => setFutureResume(e.target.value)} className="min-h-[200px]" placeholder="Start writing here..." />
            </div>
          </CardContent>
        </Card>

        {/* 6. Submit */}
        <Button
          className="w-full"
          size="lg"
          disabled={!isValid || step === 'submitting'}
          onClick={handleSubmit}
        >
          {step === 'submitting' ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {uploadProgress ? 'Uploading your video...' : 'Almost there...'}
            </>
          ) : (
            'Submit application'
          )}
        </Button>
      </div>
    </div>
  );
}
