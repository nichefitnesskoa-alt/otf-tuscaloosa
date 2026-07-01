import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGiveawayStudio } from './hooks/useGiveawayStudio';
import { useGiveawayEntries } from './hooks/useGiveawayEntries';
import { useGiveawayPartners } from './hooks/useGiveawayPartners';
import { EntriesTable } from './components/EntriesTable';
import { SpinWheel } from './components/SpinWheel';
import { SettingsPanel } from './components/SettingsPanel';
import { downloadEntriesCsv } from './lib/csvExport';
import { effectiveWeight } from './lib/weightedDraw';
import { Download, Users, Settings as SettingsIcon, Eye, Presentation, Sparkles } from 'lucide-react';
import { getAdminStudioName } from '@/lib/studioNames';

export default function GiveawayAdminPage() {
  const { studioSlug } = useParams<{ studioSlug: string }>();
  const navigate = useNavigate();
  const { studio, refresh: refreshStudio } = useGiveawayStudio(studioSlug);
  const { entries } = useGiveawayEntries(studioSlug);
  const { partners } = useGiveawayPartners(studioSlug);
  const [tab, setTab] = useState<'entries' | 'settings'>('entries');

  const totalPool = useMemo(
    () => entries.reduce((s, e) => s + effectiveWeight(e as any), 0),
    [entries],
  );
  const eligibleCount = entries.length;
  const drawEntries = useMemo(() => entries.map(e => ({
    id: e.id, name: `${e.first_name} ${e.last_name}`, total_entries: e.total_entries,
    action_instagram_follow: e.action_instagram_follow,
  })), [entries]);


  if (!studio) {
    return <div className="min-h-screen bg-[#1C1C1E] text-[#F5F2EE] flex items-center justify-center">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#1C1C1E] text-[#F5F2EE] flex flex-col md:flex-row">
      <aside className="md:w-64 md:min-h-screen border-b md:border-b-0 md:border-r border-[#3a3a3c] bg-[#181819] p-4 md:p-6">
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#E8540A] font-bold">Giveaway</p>
          <h1 className="text-xl font-black">{getAdminStudioName(studio.studio_slug)}</h1>
          <span className="inline-block mt-1 text-[10px] bg-[#2a2a2c] border border-[#3a3a3c] px-2 py-0.5 rounded uppercase tracking-wider">Admin</span>
        </div>
        <nav className="flex md:flex-col gap-2">
          <NavBtn active={tab === 'entries'} onClick={() => setTab('entries')} icon={<Users className="h-4 w-4" />}>Entries</NavBtn>
          <NavBtn active={false} onClick={() => navigate(`/admin/${studioSlug}/spin`)} icon={<Sparkles className="h-4 w-4" />}>Full-Page Spin</NavBtn>
          <NavBtn active={false} onClick={() => navigate(`/admin/${studioSlug}/preview`)} icon={<Eye className="h-4 w-4" />}>Preview</NavBtn>
          <NavBtn active={false} onClick={() => navigate(`/admin/${studioSlug}/partner-deck`)} icon={<Presentation className="h-4 w-4" />}>Partner Deck</NavBtn>
          <NavBtn active={tab === 'settings'} onClick={() => setTab('settings')} icon={<SettingsIcon className="h-4 w-4" />}>Settings</NavBtn>
        </nav>
      </aside>

      <main className="flex-1 p-4 sm:p-6 md:p-10">
        {tab === 'entries' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black">Entries</h2>
                <p className="text-sm text-[#F5F2EE]/60 mt-1">
                  <span className="text-[#E8540A] font-bold text-base">{totalPool}</span> total entries in pool · {eligibleCount} eligible · {entries.length} participants
                </p>
                <p className="text-xs text-[#F5F2EE]/50 mt-1">Every submission is eligible. Follow verification happens in person at the drawing — disqualify + re-spin if a winner doesn't check out.</p>

              </div>
              <button
                onClick={() => downloadEntriesCsv(entries as any, studio.studio_slug, partners)}
                disabled={!entries.length}
                className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg bg-[#2a2a2c] hover:bg-[#3a3a3c] border border-[#3a3a3c] text-[#F5F2EE] font-bold disabled:opacity-50 cursor-pointer"
              >
                <Download className="h-4 w-4" /> Download CSV
              </button>
            </div>
            <EntriesTable entries={entries} partners={partners} />
            <SpinWheel
              entries={drawEntries}
              partners={partners}
              winnerStructure={studio.winner_structure ?? 'single'}
              studioSlug={studio.studio_slug}
            />
          </div>
        )}
        {tab === 'settings' && (
          <div>
            <h2 className="text-3xl font-black mb-6">Settings</h2>
            <SettingsPanel studio={studio} onSaved={refreshStudio} />
          </div>
        )}
      </main>
    </div>
  );
}

function NavBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`min-h-[44px] flex items-center gap-2 px-4 rounded-lg font-bold text-sm cursor-pointer ${active ? 'bg-[#E8540A] text-white' : 'text-[#F5F2EE]/80 hover:bg-[#2a2a2c]'}`}>
      {icon}{children}
    </button>
  );
}
