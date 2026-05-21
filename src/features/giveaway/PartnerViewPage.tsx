import { useParams } from 'react-router-dom';
import { useGiveawayStudio } from './hooks/useGiveawayStudio';
import { useGiveawayEntries } from './hooks/useGiveawayEntries';
import { useGiveawayPartners } from './hooks/useGiveawayPartners';
import { EntriesTable } from './components/EntriesTable';
import { getAdminStudioName } from '@/lib/studioNames';
import { getGiveawayTitle } from './lib/giveawayTitle';
import { useMemo } from 'react';

export default function PartnerViewPage() {
  const { studioSlug } = useParams<{ studioSlug: string }>();
  const { studio } = useGiveawayStudio(studioSlug);
  const { entries } = useGiveawayEntries(studioSlug);
  const { partners } = useGiveawayPartners(studioSlug);

  const totalPool = useMemo(() => entries.reduce((s, e) => s + e.total_entries, 0), [entries]);
  const eligibleCount = useMemo(() => entries.filter(e => e.total_entries > 0).length, [entries]);

  if (!studio || !studioSlug) {
    return <div className="min-h-screen bg-[#1C1C1E] text-[#F5F2EE] flex items-center justify-center font-body">Loading…</div>;
  }

  const title = getGiveawayTitle(studioSlug, partners, studio.title_format as any, studio.custom_title);

  return (
    <div className="min-h-screen bg-[#1C1C1E] text-[#F5F2EE] font-body">
      <header className="border-b border-[#3a3a3c] bg-[#181819] px-4 sm:px-8 py-6">
        <div className="max-w-6xl mx-auto">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#E8540A] font-bold mb-2">Partner Dashboard</p>
          <h1 className="text-2xl sm:text-3xl font-black">{getAdminStudioName(studioSlug)} — Partner Dashboard</h1>
          <p className="text-sm text-[#F5F2EE]/70 mt-2">Live entry tracker for the {title}.</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        <div className="rounded-xl border border-[#3a3a3c] bg-[#1f1f21] p-6 flex flex-wrap gap-8">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#F5F2EE]/60 font-bold">Total entries</p>
            <p className="text-4xl font-black text-[#E8540A] mt-1">{totalPool}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#F5F2EE]/60 font-bold">Eligible participants</p>
            <p className="text-4xl font-black mt-1">{eligibleCount}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#F5F2EE]/60 font-bold">Total participants</p>
            <p className="text-4xl font-black mt-1">{entries.length}</p>
          </div>
        </div>

        <EntriesTable entries={entries as any} partners={partners} />
      </main>
    </div>
  );
}
