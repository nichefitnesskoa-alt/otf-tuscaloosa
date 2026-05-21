/**
 * Public individual VIP member registration page — /vip/:slug/register
 * No auth required. Group members fill out personal info before class.
 */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { formatDisplayTime } from '@/lib/time/timeUtils';
import { formatPhoneAsYouType, autoCapitalizeName } from '@/components/shared/FormHelpers';
import { cn } from '@/lib/utils';
import { z } from 'zod';

const sb = supabase as any;

const formSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  email: z.string().trim().email('Invalid email address').max(255),
  phone: z.string().trim().min(7, 'Phone number is required').max(20),
  fitnessLevel: z.number().min(1).max(5, 'Please select a fitness level'),
  injuries: z.string().max(1000).optional(),
  birthday: z.string().min(1, 'Date of birth is required'),
  weight: z.string().min(1, 'Weight is required'),
});

const FITNESS_LABELS = [
  'Just starting',
  'Some experience',
  'Moderately active',
  'Very active',
  'Athlete',
];

interface SessionInfo {
  id: string;
  session_date: string;
  session_time: string;
  status: string;
  reserved_by_group: string | null;
}

export default function VipMemberRegister() {
  const { slug } = useParams<{ slug: string }>();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState<number | null>(null);
  const [injuries, setInjuries] = useState('');
  const [birthday, setBirthday] = useState('');
  const [weight, setWeight] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [groupCount, setGroupCount] = useState(0);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    if (!slug) { setNotFound(true); setLoadingSession(false); return; }
    (async () => {
      const { data } = await sb
        .from('vip_sessions')
        .select('id, session_date, session_time, status, reserved_by_group')
        .eq('shareable_slug', slug)
        .is('archived_at', null)
        .single();
      if (!data || (data as any).status !== 'reserved') {
        setNotFound(true);
      } else {
        setSession(data as SessionInfo);
      }
      setLoadingSession(false);
    })();
  }, [slug]);

  // Live group registration count (excludes group-contact rows)
  useEffect(() => {
    if (!session?.id) return;
    let cancelled = false;
    const fetchCount = async () => {
      const { count } = await sb
        .from('vip_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('vip_session_id', session.id)
        .eq('is_group_contact', false);
      if (!cancelled) setGroupCount(count || 0);
    };
    fetchCount();
    const channel = sb
      .channel(`vip-reg-count-${session.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vip_registrations', filter: `vip_session_id=eq.${session.id}` },
        () => fetchCount(),
      )
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(channel); };
  }, [session?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = formSchema.safeParse({
      firstName, lastName, email, phone,
      fitnessLevel: fitnessLevel ?? 0,
      injuries, birthday, weight,
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      if (!fitnessLevel) fieldErrors.fitnessLevel = 'Please select a fitness level';
      setErrors(fieldErrors);
      return;
    }

    if (!session) return;
    setSubmitting(true);

    try {
      // Check for duplicate
      const { data: existing } = await sb
        .from('vip_registrations')
        .select('id')
        .eq('vip_session_id', session.id)
        .eq('email', email.trim().toLowerCase())
        .limit(1);

      if (existing && existing.length > 0) {
        setAlreadyRegistered(true);
        setSubmitting(false);
        return;
      }

      // Insert registration
      const { error: insertErr } = await sb
        .from('vip_registrations')
        .insert({
          vip_session_id: session.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          fitness_level: fitnessLevel,
          injuries: injuries.trim() || null,
          birthday: birthday || null,
          weight_lbs: weight ? parseInt(weight) : null,
          is_group_contact: false,
          vip_class_name: session.reserved_by_group || null,
        } as any);

      if (insertErr) throw insertErr;

      // Get count for notification
      const { count } = await sb
        .from('vip_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('vip_session_id', session.id)
        .eq('is_group_contact', false);

      const formattedDate = format(new Date(session.session_date + 'T00:00:00'), 'MMM d');
      const formattedTime = formatDisplayTime(session.session_time);

      // Notify staff with name + phone so SAs can text booking confirmation directly.
      const groupLabel = session.reserved_by_group || 'VIP';
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      await sb.from('notifications').insert({
        notification_type: 'vip_member_registered',
        title: `${fullName} — ${groupLabel}`,
        body: `Just registered for ${groupLabel} on ${formattedDate} at ${formattedTime}. Text them to confirm. (${count || 0} total registered)`,
        target_user: null,
        meta: {
          session_id: session.id,
          group_name: session.reserved_by_group,
          total_registered: count || 0,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
          session_date: session.session_date,
          session_time: session.session_time,
        },
      });

      setSubmitted(true);
    } catch (err) {
      console.error('Registration error:', err);
      setErrors({ form: 'Something went wrong. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF6900]" />
      </div>
    );
  }

  if (notFound || !session) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <div className="bg-[#FF6900] text-white w-full py-6 absolute top-0 left-0">
          <h1 className="text-xl font-bold">OTF Tuscaloosa</h1>
        </div>
        <div className="mt-20">
          <p className="text-lg font-semibold text-foreground">This registration link is not active.</p>
          <p className="text-sm text-muted-foreground mt-2">Contact your group organizer for an updated link.</p>
        </div>
      </div>
    );
  }

  const dateLabel = format(new Date(session.session_date + 'T00:00:00'), 'EEEE, MMMM d, yyyy');
  const timeLabel = formatDisplayTime(session.session_time);

  if (alreadyRegistered) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="bg-[#FF6900] text-white py-6 px-4 text-center">
          <h1 className="text-xl font-bold">OTF Tuscaloosa</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <CheckCircle className="w-16 h-16 text-success mb-4" />
          <p className="text-lg font-semibold">Looks like you've already registered for this session.</p>
          <p className="text-sm text-muted-foreground mt-2">See you there! 🧡</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    const shortDate = format(new Date(session.session_date + 'T00:00:00'), 'EEEE, MMMM d');
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F5F2EE' }}>
        <div className="text-white py-6 px-4 text-center" style={{ backgroundColor: '#E8540A' }}>
          <h1 className="text-xl font-extrabold tracking-wide">OTF TUSCALOOSA</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-2xl mx-auto">
          <p className="text-3xl md:text-4xl font-semibold leading-relaxed text-neutral">
            You just did something most people talk about but never do.
          </p>
          <p className="text-base text-neutral mt-8 leading-relaxed">
            We'll see you on {shortDate}. Come 15 minutes early and we'll get you set up.
          </p>
          <p className="text-lg font-semibold mt-6" style={{ color: '#E8540A' }}>
            See you there. 🧡
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F2EE' }}>
      {/* Header */}
      <div className="text-white py-6 px-4 text-center" style={{ backgroundColor: '#E8540A' }}>
        <h1 className="text-xl font-extrabold tracking-wide">OTF TUSCALOOSA</h1>
      </div>

      <div className="max-w-md mx-auto px-4 py-8 space-y-6">
        {/* Social proof pill */}
        {groupCount > 0 && (
          <div className="flex justify-center">
            <span
              className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: '#E8540A' }}
            >
              {groupCount} from your group {groupCount === 1 ? 'has' : 'have'} already signed up
            </span>
          </div>
        )}

        {/* Group + session details */}
        <div className="text-center space-y-1">
          {session.reserved_by_group && (
            <h2 className="text-2xl font-extrabold text-neutral">{session.reserved_by_group}</h2>
          )}
          <p className="text-base font-semibold text-neutral">
            {dateLabel} at {timeLabel}
          </p>
          <p className="text-sm text-neutral pt-2">
            Fill out your info before class.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* First / Last name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName" className="text-sm font-medium">First Name *</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={e => setFirstName(autoCapitalizeName(e.target.value))}
                placeholder="First name"
                className="h-12 text-base rounded-xl border"
                style={errors.firstName ? { borderColor: '#ef4444' } : undefined}
              />
              {errors.firstName && <p className="text-xs text-danger">{errors.firstName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName" className="text-sm font-medium">Last Name *</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={e => setLastName(autoCapitalizeName(e.target.value))}
                placeholder="Last name"
                className="h-12 text-base rounded-xl border"
                style={errors.lastName ? { borderColor: '#ef4444' } : undefined}
              />
              {errors.lastName && <p className="text-xs text-danger">{errors.lastName}</p>}
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium">Email *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="h-12 text-base rounded-xl border"
              style={errors.email ? { borderColor: '#ef4444' } : undefined}
            />
            {errors.email && <p className="text-xs text-danger">{errors.email}</p>}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-sm font-medium">Phone Number *</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={e => setPhone(formatPhoneAsYouType(e.target.value))}
              placeholder="(555) 123-4567"
              className="h-12 text-base rounded-xl border"
              style={errors.phone ? { borderColor: '#ef4444' } : undefined}
            />
            {errors.phone && <p className="text-xs text-danger">{errors.phone}</p>}
          </div>

          {/* Fitness Level */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">How would you rate your current fitness level? *</Label>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map(level => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setFitnessLevel(level)}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-xl border-2 py-3 min-h-[44px] cursor-pointer transition-colors',
                    fitnessLevel === level
                      ? 'border-[#FF6900] bg-brand-dim text-[#FF6900]'
                      : 'border-border hover:border-muted-foreground/40'
                  )}
                >
                  <span className="text-lg font-bold">{level}</span>
                  <span className="text-[9px] leading-tight text-center mt-0.5 px-0.5">
                    {FITNESS_LABELS[level - 1]}
                  </span>
                </button>
              ))}
            </div>
            {errors.fitnessLevel && <p className="text-xs text-danger">{errors.fitnessLevel}</p>}
          </div>

          {/* Injuries */}
          <div className="space-y-1.5">
            <Label htmlFor="injuries" className="text-sm font-medium">
              Anything our coach should know before class?
            </Label>
            <Textarea
              id="injuries"
              value={injuries}
              onChange={e => setInjuries(e.target.value)}
              placeholder="Previous injuries, physical limitations, etc. Leave blank if none."
              className="rounded-xl border min-h-[80px]"
            />
          </div>

          {/* HR Monitor Section */}
          <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: '#FFF5EB', border: '1px solid rgba(255,105,0,0.2)' }}>
            <p className="text-xs font-medium" style={{ color: '#FF6900' }}>
              Heart Rate Monitor Setup
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="birthday" className="text-xs">Date of Birth *</Label>
              <p className="text-[10px] text-muted-foreground">Needed to set up your heart rate monitor.</p>
              <Input
                id="birthday"
                type="date"
                value={birthday}
                onChange={e => setBirthday(e.target.value)}
                className="h-10 text-sm rounded-lg border"
                style={errors.birthday ? { borderColor: '#ef4444' } : undefined}
              />
              {errors.birthday && <p className="text-xs text-danger">{errors.birthday}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="weight" className="text-xs">Weight (lbs) *</Label>
              <p className="text-[10px] text-muted-foreground">Needed to set up your heart rate monitor.</p>
              <Input
                id="weight"
                type="number"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                placeholder="150"
                className="h-10 text-sm rounded-lg border"
                min={50}
                max={500}
                style={errors.weight ? { borderColor: '#ef4444' } : undefined}
              />
              {errors.weight && <p className="text-xs text-danger">{errors.weight}</p>}
            </div>
          </div>

          {errors.form && (
            <p className="text-sm text-center text-danger">{errors.form}</p>
          )}

          <Button
            type="submit"
            className="w-full min-h-[44px] h-14 text-lg font-semibold rounded-xl bg-[#FF6900] hover:bg-[#e55f00] text-white"
            disabled={submitting}
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit My Info'}
          </Button>
        </form>

        {/* Share with friends */}
        <div className="pt-2 text-center space-y-2">
          <p className="text-sm text-neutral font-medium">Know someone who should join?</p>
          {typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function' ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] h-12 px-6 font-semibold"
              style={{ borderColor: '#E8540A', color: '#E8540A' }}
              onClick={async () => {
                try {
                  await (navigator as any).share({
                    title: 'Private OTF class in Tuscaloosa',
                    text: 'Come to a free private OrangeTheory class with us.',
                    url: typeof window !== 'undefined' ? window.location.href : '',
                  });
                } catch { /* cancelled */ }
              }}
            >
              Share this class
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] h-12 px-6 font-semibold"
              style={{ borderColor: '#E8540A', color: '#E8540A' }}
              onClick={async () => {
                if (typeof window === 'undefined') return;
                await navigator.clipboard.writeText(window.location.href);
                setShareCopied(true);
                setTimeout(() => setShareCopied(false), 2000);
              }}
            >
              {shareCopied ? 'Copied!' : 'Copy Link'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
