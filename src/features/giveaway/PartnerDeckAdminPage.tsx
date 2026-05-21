import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGiveawayStudio } from './hooks/useGiveawayStudio';
import { getAdminStudioName } from '@/lib/studioNames';
import { Users, Eye, Settings as SettingsIcon, Presentation, Copy, Check } from 'lucide-react';

export default function PartnerDeckAdminPage() {
  const { studioSlug } = useParams<{ studioSlug: string }>();
  const navigate = useNavigate();
  const { studio } = useGiveawayStudio(studioSlug);

  const [prospect, setProspect] = useState('');
  const [debouncedProspect, setDebouncedProspect] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedProspect(prospect.trim()), 400);
    return () => clearTimeout(t);
  }, [prospect]);

  const publicBaseUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/partner-deck/${studioSlug}`;
  }, [studioSlug]);

  const iframeSrc = useMemo(() => {
    const url = `/partner-deck/${studioSlug}`;
    return debouncedProspect ? `${url}?prospect=${encodeURIComponent(debouncedProspect)}` : url;
  }, [studioSlug, debouncedProspect]);

  const copyLink = async () => {
    const shareUrl = prospect.trim()
      ? `${publicBaseUrl}?prospect=${encodeURIComponent(prospect.trim())}`
      : publicBaseUrl;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (!studio) {
    return <div className="min-h-screen bg-surface-page text-text-primary flex items-center justify-center font-body">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-surface-page text-text-primary flex flex-col md:flex-row font-body">
      {/* Sidebar — mirrors GiveawayAdminPage so the two pages feel like one */}
      <aside className="md:w-64 md:min-h-screen border-b md:border-b-0 md:border-r border-surface-border bg-surface-card p-4 md:p-6">
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.25em] text-brand font-bold">Giveaway</p>
          <h1 className="text-xl font-black">{getAdminStudioName(studio.studio_slug)}</h1>
          <span className="inline-block mt-1 text-[10px] bg-surface-input border border-surface-border px-2 py-0.5 rounded uppercase tracking-wider">Admin</span>
        </div>
        <nav className="flex md:flex-col gap-2">
          <NavBtn onClick={() => navigate(`/admin/${studioSlug}`)} icon={<Users className="h-4 w-4" />}>Entries</NavBtn>
          <NavBtn onClick={() => navigate(`/admin/${studioSlug}/preview`)} icon={<Eye className="h-4 w-4" />}>Preview</NavBtn>
          <NavBtn active onClick={() => {}} icon={<Presentation className="h-4 w-4" />}>Partner Deck</NavBtn>
          <NavBtn onClick={() => navigate(`/admin/${studioSlug}?tab=settings`)} icon={<SettingsIcon className="h-4 w-4" />}>Settings</NavBtn>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="sticky top-0 z-20 bg-surface-page border-b border-surface-border px-4 sm:px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">Partner Deck</h2>
              <p className="text-sm text-text-secondary mt-1">Share a live, always-current pitch with prospective partners.</p>
            </div>
            <div className="flex flex-col md:flex-row gap-3 md:items-start">
              <div className="md:w-[280px]">
                <input
                  value={prospect}
                  onChange={e => setProspect(e.target.value)}
                  placeholder="Enter prospect business name (optional)"
                  className="w-full min-h-[44px] rounded-lg bg-surface-input border border-surface-border focus:border-brand focus:outline-none px-3 text-text-primary text-sm"
                />
                <p className="text-[11px] text-text-secondary mt-1.5 leading-snug">
                  Adds their name to the deck so they see how they'd appear alongside existing partners.
                </p>
              </div>
              <button
                onClick={copyLink}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 rounded-lg bg-brand hover:bg-brand-hover text-brand-foreground font-bold text-sm cursor-pointer"
              >
                {copied ? <><Check className="h-4 w-4" /> Copied!</> : <><Copy className="h-4 w-4" /> Copy Deck Link</>}
              </button>
            </div>
          </div>
        </div>

        {/* Preview banner */}
        <div className="bg-surface-card border-b border-surface-border h-10 flex items-center px-4 sm:px-6">
          <p className="text-xs text-text-secondary">
            <span className="font-bold uppercase tracking-wider mr-2">Preview</span>
            This is what your prospect will see.
          </p>
        </div>

        {/* Iframe */}
        <div className="flex-1 bg-surface-page">
          <iframe
            key={iframeSrc /* force reload on prospect change */}
            src={iframeSrc}
            title="Partner deck preview"
            className="w-full h-full block"
            style={{ minHeight: 'calc(100vh - 140px)' }}
          />
        </div>
      </main>
    </div>
  );
}

function NavBtn({ active, onClick, icon, children }: { active?: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`min-h-[44px] flex items-center gap-2 px-4 rounded-lg font-bold text-sm cursor-pointer ${active ? 'bg-brand text-brand-foreground' : 'text-text-secondary hover:bg-surface-input'}`}>
      {icon}{children}
    </button>
  );
}
