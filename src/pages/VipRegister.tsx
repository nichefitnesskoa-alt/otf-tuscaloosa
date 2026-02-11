import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, Star } from 'lucide-react';
import otfLogo from '@/assets/otf-logo.jpg';
import { z } from 'zod';

const OTF_ORANGE = '#FF6900';

const formSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  email: z.string().trim().email('Invalid email address').max(255),
  phone: z.string().trim().min(7, 'Phone number is required').max(20),
  birthday: z.string().optional(),
  weightLbs: z.string().optional(),
});

export default function VipRegister() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = formSchema.safeParse({ firstName, lastName, email, phone, birthday, weightLbs });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const memberName = `${firstName.trim()} ${lastName.trim()}`;
      const today = new Date().toISOString().split('T')[0];

      // Create booking in intros_booked
      const { data: booking, error: bookingError } = await supabase
        .from('intros_booked')
        .insert({
          member_name: memberName,
          class_date: today,
          coach_name: 'TBD',
          sa_working_shift: 'VIP Registration',
          lead_source: 'VIP Class',
          booked_by: 'Self (VIP Form)',
          booking_status: 'Active',
        })
        .select('id')
        .single();

      if (bookingError) throw bookingError;

      // Create vip_registration entry
      const { error: vipError } = await supabase
        .from('vip_registrations')
        .insert({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          birthday: birthday || null,
          weight_lbs: weightLbs ? parseInt(weightLbs) : null,
          booking_id: booking.id,
        });

      if (vipError) throw vipError;

      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting VIP registration:', err);
      setErrors({ form: 'Something went wrong. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <img src={otfLogo} alt="Orangetheory Fitness" className="h-12 mb-6 object-contain" />
        <CheckCircle className="w-16 h-16 mb-4" style={{ color: OTF_ORANGE }} />
        <h1 className="text-2xl font-bold mb-2" style={{ color: '#1a1a1a' }}>
          You're Registered!
        </h1>
        <p className="text-lg mb-2" style={{ color: '#555' }}>
          Thanks, {firstName}! We're excited to see you at VIP Class! 🧡
        </p>
        <p className="text-sm" style={{ color: '#888' }}>
          Our team will reach out with class details soon.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-4 py-8">
      <img src={otfLogo} alt="Orangetheory Fitness" className="h-12 mb-6 object-contain" />

      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: '#FFF5EB', color: OTF_ORANGE }}>
            <Star className="w-4 h-4" />
            VIP Class Registration
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#1a1a1a' }}>
            Register for VIP Class
          </h1>
          <p className="text-sm" style={{ color: '#555' }}>
            Fill out the form below and we'll get you set up for your VIP experience.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName" className="text-sm font-medium" style={{ color: '#333' }}>First Name *</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="First name"
                className="h-12 text-base rounded-xl"
                style={{ borderColor: errors.firstName ? '#ef4444' : '#e5e7eb' }}
              />
              {errors.firstName && <p className="text-xs" style={{ color: '#ef4444' }}>{errors.firstName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName" className="text-sm font-medium" style={{ color: '#333' }}>Last Name *</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Last name"
                className="h-12 text-base rounded-xl"
                style={{ borderColor: errors.lastName ? '#ef4444' : '#e5e7eb' }}
              />
              {errors.lastName && <p className="text-xs" style={{ color: '#ef4444' }}>{errors.lastName}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium" style={{ color: '#333' }}>Email *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="h-12 text-base rounded-xl"
              style={{ borderColor: errors.email ? '#ef4444' : '#e5e7eb' }}
            />
            {errors.email && <p className="text-xs" style={{ color: '#ef4444' }}>{errors.email}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-sm font-medium" style={{ color: '#333' }}>Phone Number *</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className="h-12 text-base rounded-xl"
              style={{ borderColor: errors.phone ? '#ef4444' : '#e5e7eb' }}
            />
            {errors.phone && <p className="text-xs" style={{ color: '#ef4444' }}>{errors.phone}</p>}
          </div>

          <div className="rounded-xl p-3" style={{ backgroundColor: '#FFF5EB', border: `1px solid ${OTF_ORANGE}30` }}>
            <p className="text-xs font-medium mb-3" style={{ color: OTF_ORANGE }}>
              ❤️ Heart Rate Monitor Setup (Optional)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="birthday" className="text-xs" style={{ color: '#555' }}>Birthday</Label>
                <Input
                  id="birthday"
                  type="date"
                  value={birthday}
                  onChange={e => setBirthday(e.target.value)}
                  className="h-10 text-sm rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="weight" className="text-xs" style={{ color: '#555' }}>Weight (lbs)</Label>
                <Input
                  id="weight"
                  type="number"
                  value={weightLbs}
                  onChange={e => setWeightLbs(e.target.value)}
                  placeholder="150"
                  className="h-10 text-sm rounded-lg"
                  min={50}
                  max={500}
                />
              </div>
            </div>
          </div>

          {errors.form && (
            <p className="text-sm text-center" style={{ color: '#ef4444' }}>{errors.form}</p>
          )}

          <Button
            type="submit"
            className="w-full h-14 text-lg font-semibold rounded-xl"
            style={{ backgroundColor: OTF_ORANGE }}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Register for VIP Class'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
