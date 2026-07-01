import { useMemo, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGiveawayStudio } from './hooks/useGiveawayStudio';
import { useGiveawayEntries } from './hooks/useGiveawayEntries';
import { useGiveawayPartners } from './hooks/useGiveawayPartners';
import { SpinWheel } from './components/SpinWheel';
import { getAdminStudioName } from '@/lib/studioNames';
import { ArrowLeft, Maximize2 } from 'lucide-react';

/**
 * Full-page presentation view of the spin wheel — designed for showing on
 * a laptop or tablet at the drawing event / for recording video. Bigger
 * wheel, bigger buttons, no admin chrome.
 */
export default function GiveawaySpinPage() {
  const { studioSlug } = useParams<{ studioSlug: string }>();
  const navigate = useNavigate();
  const { studio } = useGiveawayStudio(studioSlug);
  const { entries } = useGiveawayEntries(studioSlug);
  const { partners } = useGiveawayPartners(studioSlug);
  const [wheelSize, setWheelSize] = useState(720);

  // Scale wheel to available viewport (leave room for pick-order sidebar + padding).
  useEffect(() => {
    const compute = () => {
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      // Reserve ~460px on wide screens for right-column, ~200px vertical chrome.
      const maxByHeight = vh - 260;
      const maxByWidth = vw >= 1024 ? vw - 500 : vw - 60;
      const size = Math.max(360, Math.min(900, Math.min(maxByHeight, maxByWidth)));
      setWheelSize(Math.round(size));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  const drawEntries = useMemo(() => entries.map(e => ({
    id: e.id, name: `${e.first_name} ${e.last_name}`, total_entries: e.total_entries,
    action_instagram_follow: e.action_instagram_follow,
  })), [entries]);

  const enterFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => { /* ignore */ });
    }
  };

  if (!studio) {
    return <div className="min-h-screen bg-[#1C1C1E] text-[#F5F2EE] flex items-center justify-center">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#0f0f10] text-[#F5F2EE] flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#3a3a3c]">
        <button
          onClick={() => navigate(`/admin/${studioSlug}`)}
          className="inline-flex items-center gap-2 min-h-[40px] px-3 rounded-lg border border-[#3a3a3c] hover:bg-[#2a2a2c] text-sm font-bold cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Admin
        </button>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#E8540A] font-bold">Live Drawing</p>
          <h1 className="text-lg sm:text-xl font-black">{getAdminStudioName(studio.studio_slug)}</h1>
        </div>
        <button
          onClick={enterFullscreen}
          className="inline-flex items-center gap-2 min-h-[40px] px-3 rounded-lg border border-[#3a3a3c] hover:bg-[#2a2a2c] text-sm font-bold cursor-pointer"
        >
          <Maximize2 className="h-4 w-4" /> Fullscreen
        </button>
      </header>

      <main className="flex-1 p-4 sm:p-8">
        <SpinWheel
          entries={drawEntries}
          partners={partners}
          winnerStructure={studio.winner_structure ?? 'single'}
          studioSlug={studio.studio_slug}
          wheelSize={wheelSize}
          fullscreen
        />
      </main>
    </div>
  );
}
