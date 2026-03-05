import { useState, useRef } from 'react';
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

export default function Apply() {
  const [step, setStep] = useState<'form' | 'submitting' | 'done' | 'duplicate'>('form');
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

  const isValid = role && fullName.trim() && email.trim() && phone.replace(/\D/g, '').length === 10 && videoFile && belongingEssay.trim() && futureResume.trim();

  const handleSubmit = async () => {
    if (!isValid || !videoFile) return;
    setStep('submitting');

    try {
      // Check for duplicate email
      const { data: existing } = await supabase
        .from('candidates')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (existing) {
        setStep('duplicate');
        return;
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

      // Insert candidate
      const { error: insertError } = await supabase.from('candidates').insert({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        role,
        video_url: urlData.publicUrl,
        belonging_essay: belongingEssay.trim(),
        future_resume: futureResume.trim(),
        three_step_complete: true,
        stage: 'applied',
      } as any);

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

      setStep('done');
    } catch (err: any) {
      setUploadProgress(false);
      toast.error(err?.message || 'Something went wrong. Please try again.');
      setStep('form');
    }
  };

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

        {/* Section 1 — Role */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="font-semibold text-lg">What role are you applying for?</h2>
            <RadioGroup value={role} onValueChange={setRole}>
              {ROLES.map((r) => (
                <div key={r} className="flex items-center space-x-2">
                  <RadioGroupItem value={r} id={r} />
                  <Label htmlFor={r} className="cursor-pointer">{r}</Label>
                </div>
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
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>
              <div>
                <Label>Email Address</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(555) 555-5555"
                />
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
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
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
              <Textarea
                value={belongingEssay}
                onChange={(e) => setBelongingEssay(e.target.value)}
                className="min-h-[200px]"
                placeholder="Write your response here..."
              />
            </div>

            {/* Step 3 — Future Resume */}
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              <h3 className="font-semibold uppercase text-sm tracking-wide">Step 3 — The Future Resume</h3>
              <p className="text-sm text-muted-foreground italic leading-relaxed">
                "Forget your past jobs. What do you want to build, become, and be known for — in your career and your life? This is your future resume. Write it like it already happened."
              </p>
              <p className="text-xs text-muted-foreground">One page maximum. Write directly below.</p>
              <Textarea
                value={futureResume}
                onChange={(e) => setFutureResume(e.target.value)}
                className="min-h-[200px]"
                placeholder="Write your response here..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 4 — Submit */}
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
