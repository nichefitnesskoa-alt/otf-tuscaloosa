import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import otfLogo from '@/assets/otf-logo-orange.png.asset.json';

// OTF brand palette (locked)
const ORANGE = '#FF6F0D';
const BONE = '#FDF7EA';
const DARK = '#0A0A0A';

const brandFont = {
  fontFamily: "'PP Right Grotesk', 'Arial Black', 'Helvetica Neue', Arial, sans-serif",
  letterSpacing: '-0.02em',
};

export default function Login() {
  const [selectedName, setSelectedName] = useState('');
  const [staff, setStaff] = useState<{ name: string; role?: string }[]>([]);
  const { login } = useAuth();
  const navigate = useNavigate();

  const staffNames = useMemo(() => staff.map(s => s.name), [staff]);

  useEffect(() => {
    const fetchStaff = async () => {
      const { data } = await supabase
        .from('staff')
        .select('name, role')
        .eq('is_active', true)
        .order('name');
      setStaff((data || []).map((s: any) => ({ name: s.name, role: s.role })));
    };
    fetchStaff();
  }, []);

  const handleLogin = () => {
    if (!selectedName) return;
    login(selectedName);
    const selectedRole = staff.find(s => s.name === selectedName)?.role;
    const isCoach = selectedRole === 'Coach';
    navigate(isCoach ? '/coach-view' : '/wig');
  };

  return (
    <div
      className="min-h-screen flex flex-col px-6 py-10"
      style={{ backgroundColor: DARK, color: BONE, ...brandFont }}
    >
      {/* Logo lockup */}
      <header className="flex flex-col items-center pt-6 pb-10">
        <img
          src={otfLogo.url}
          alt="Orangetheory Fitness"
          className="h-16 w-auto mb-6"
        />
        <p
          className="text-xs uppercase"
          style={{ color: BONE, opacity: 0.65, letterSpacing: '0.18em' }}
        >
          Shift Recap · Tuscaloosa
        </p>
      </header>

      {/* Main card */}
      <main className="flex-1 flex flex-col justify-center">
        <div className="w-full max-w-sm mx-auto">
          {/* Headline */}
          <h1
            className="text-4xl leading-[0.95] mb-4"
            style={{ ...brandFont, fontWeight: 800 }}
          >
            Get paid for<br />every intro<br />you work.
          </h1>
          <p
            className="text-base leading-snug mb-8"
            style={{ color: BONE, opacity: 0.75 }}
          >
            The OTF system books classes. This one makes sure you get the credit.
          </p>

          {/* Reminder */}
          <div
            className="mb-6 pl-3 py-1"
            style={{ borderLeft: `2px solid ${ORANGE}` }}
          >
            <p className="text-sm" style={{ color: BONE, opacity: 0.9 }}>
              Book every intro in both Mindbody <span style={{ color: ORANGE }}>and</span> here.
            </p>
          </div>

          {/* Name select */}
          <label
            className="block text-xs uppercase mb-2"
            style={{ color: BONE, opacity: 0.6, letterSpacing: '0.14em' }}
          >
            Your name
          </label>
          <Select value={selectedName} onValueChange={setSelectedName}>
            <SelectTrigger
              className="h-14 w-full rounded-none border-0 text-base focus:ring-0 focus:ring-offset-0"
              style={{
                backgroundColor: 'transparent',
                color: BONE,
                borderBottom: `1px solid ${BONE}`,
                paddingLeft: 0,
                paddingRight: 0,
                ...brandFont,
              }}
            >
              <SelectValue placeholder="Select your name" />
            </SelectTrigger>
            <SelectContent
              style={{ backgroundColor: DARK, color: BONE, border: `1px solid ${BONE}20` }}
            >
              {staffNames.map(name => (
                <SelectItem
                  key={name}
                  value={name}
                  className="focus:bg-transparent"
                  style={{ color: BONE }}
                >
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Primary action — the ONE orange element */}
          <button
            onClick={handleLogin}
            disabled={!selectedName}
            className="w-full mt-8 h-14 text-base transition-opacity disabled:opacity-40"
            style={{
              backgroundColor: ORANGE,
              color: DARK,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              ...brandFont,
            }}
          >
            Continue →
          </button>
        </div>
      </main>

      {/* Tagline */}
      <footer className="pt-10 pb-2 text-center">
        <p
          className="text-[11px] uppercase"
          style={{ color: BONE, opacity: 0.5, letterSpacing: '0.22em' }}
        >
          More Life · More Energy · More Results
        </p>
      </footer>
    </div>
  );
}
