import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useGiveawayStudio } from './hooks/useGiveawayStudio';
import { useGiveawayEntries } from './hooks/useGiveawayEntries';
import { EntriesTable } from './components/EntriesTable';
import { DrawWinner } from './components/DrawWinner';
import { SpinWheel } from './components/SpinWheel';
import { SettingsPanel } from './components/SettingsPanel';
import { downloadEntriesCsv } from './lib/csvExport';
import { Download, Users, Settings as SettingsIcon } from 'lucide-react';

export default function GiveawayAdminPage() {
  const { studioSlug } = useParams<{ studioSlug: string }>();
  const { studio, refresh: refreshStudio } = useGiveawayStudio(studioSlug);
  const { entries } = useGiveawayEntries(studioSlug);
  const [tab, setTab] = useState<'entries' | 'settings'>('entries');

  const totalPool = useMemo(() => entries.reduce((s, e) => s + e.total_entries, 0), [entries]);
  const drawEntries = useMemo(() => entries.map(e => ({
    id: e.id, name: `${e.first_name} ${e.last_name}`, total_entries: e.total_entries,
  })), [entries]);

  if (!studio) {
    return <div className="min-h-screen bg-[#1C1C1E] text-[#F5F2EE] flex items-center justify-center">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#1C1C1E] text-[#F5F2EE] flex flex-col md:flex-row">
      <aside className="md:w-64 md:min-h-screen border-b md:border-b-0 md:border-r border-[#3a3a3c] bg-[#181819] p-4 md:p-6">
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#E8540A] font-bold">Giveaway</p>
          <h1 className="text-xl font-black">{studio.studio_name}</h1>
          <span className="inline-block mt-1 text-[10px] bg-[#2a2a2c] border border-[#3a3a3c] px-2 py-0.5 rounded uppercase tracking-wider">Admin</span>
        </div>
        <nav className="flex md:flex-col gap-2">
          <NavBtn active={tab === 'entries'} onClick={() => setTab('entries')} icon={<Users className="h-4 w-4" />}>Entries</NavBtn>
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
                  <span className="text-[#E8540A] font-bold text-base">{totalPool}</span> total entries in pool · {entries.length} participants
                </p>
                <p className="text-xs text-[#F5F2EE]/50 mt-1">Each entry = one ticket. Higher entries = higher chance of winning.</p>
              </div>
              <button
                onClick={() => downloadEntriesCsv(entries as any, studio.studio_slug)}
                disabled={!entries.length}
                className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg bg-[#2a2a2c] hover:bg-[#3a3a3c] border border-[#3a3a3c] text-[#F5F2EE] font-bold disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> Download CSV
              </button>
            </div>
            <EntriesTable entries={entries} />
            <DrawWinner entries={drawEntries} />
            <SpinWheel entries={drawEntries} />
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
      className={`min-h-[44px] flex items-center gap-2 px-4 rounded-lg font-bold text-sm ${active ? 'bg-[#E8540A] text-white' : 'text-[#F5F2EE]/80 hover:bg-[#2a2a2c]'}`}>
      {icon}{children}
    </button>
  );
}
