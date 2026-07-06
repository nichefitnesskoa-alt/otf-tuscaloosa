import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useActiveStaff } from '@/hooks/useActiveStaff';
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
  const { staff, loading: staffLoading } = useActiveStaff();
  const { login } = useAuth();
  const navigate = useNavigate();

  const staffNames = useMemo(() => staff.map(s => s.name), [staff]);

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
          <div className="relative">
            <select
              value={selectedName}
              onChange={(event) => setSelectedName(event.target.value)}
              disabled={staffLoading || staffNames.length === 0}
              aria-label="Your name"
              className="h-14 w-full appearance-none rounded-none border-0 bg-transparent text-base outline-none disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
              style={{
                color: BONE,
                borderBottom: `1px solid ${BONE}`,
                paddingLeft: 0,
                paddingRight: 32,
                ...brandFont,
              }}
            >
              <option value="" disabled style={{ backgroundColor: DARK, color: BONE }}>
                {staffLoading ? 'Loading names...' : 'Select your name'}
              </option>
              {staffNames.map(name => (
                <option key={name} value={name} style={{ backgroundColor: DARK, color: BONE }}>
                  {name}
                </option>
              ))}
            </select>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm"
              style={{ color: BONE, opacity: 0.7 }}
            >
              ▾
            </span>
          </div>

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
