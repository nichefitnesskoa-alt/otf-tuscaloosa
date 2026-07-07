/**
 * OwnItDeckPage — fullscreen live slide deck for the Own It meeting.
 * Keyboard: ←/→ navigate, F fullscreen, D open drill, Esc exit.
 * Slide index in URL as ?slide=N (1-based).
 * Slide count is dynamic: 8 metric slides + N per-owner slides.
 */
import { useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { ScaledSlide } from './ScaledSlide';
import { useDeckData } from './useDeckData';
import { DrillProvider } from './DrillOverlay';
import { Slide01NetGain } from './slides/Slide01NetGain';
import { FunnelSlide } from './slides/FunnelSlide';
import { Slide04Soml } from './slides/Slide04Soml';
import { Slide05WigLeads } from './slides/Slide05WigLeads';
import { Slide06CoachClose } from './slides/Slide06CoachClose';
import { Slide07CoachStats } from './slides/Slide07CoachStats';
import { Slide08ActionItems } from './slides/Slide08ActionItems';
import { SlideOwner } from './slides/SlideOwner';

export default function OwnItDeckPage() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const data = useDeckData();

  const slides = useMemo(() => {
    const metric = [
      (k: number, T: number) => <Slide01NetGain data={data} slideNum={k} total={T} />,
      (k: number, T: number) => (
        <FunnelSlide
          kicker="Monthly — SGL"
          title="Self-Generated Lead Funnel"
          slideNum={k}
          total={T}
          funnel={data.sglFunnel}
          subtitle="Staff or member-sourced bookings this month (excludes online self-book)."
        />
      ),
      (k: number, T: number) => (
        <FunnelSlide
          kicker="Monthly — Non-SGL"
          title="Non-SGL Lead Funnel"
          slideNum={k}
          total={T}
          funnel={data.nonSglFunnel}
          subtitle="Passive web-form self-bookings this month."
        />
      ),
      (k: number, T: number) => <Slide04Soml data={data} slideNum={k} total={T} />,
      (k: number, T: number) => <Slide05WigLeads data={data} slideNum={k} total={T} />,
      (k: number, T: number) => <Slide06CoachClose data={data} slideNum={k} total={T} />,
      (k: number, T: number) => <Slide07CoachStats data={data} slideNum={k} total={T} />,
      (k: number, T: number) => <Slide08ActionItems data={data} slideNum={k} total={T} />,
    ];
    const ownerSlides = data.ownersFull.map(o =>
      (k: number, T: number) => <SlideOwner key={o.id} owner={o} slideNum={k} total={T} />
    );
    return [...metric, ...ownerSlides];
  }, [data]);

  const total = slides.length;
  const rawIdx = parseInt(sp.get('slide') || '1', 10);
  const idx = Math.min(Math.max(1, isNaN(rawIdx) ? 1 : rawIdx), Math.max(1, total));

  const go = useCallback((n: number) => {
    const next = Math.min(Math.max(1, n), total);
    setSp({ slide: String(next) }, { replace: true });
  }, [setSp, total]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(idx + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
      else if (e.key === 'Escape') { nav('/the-table'); }
      else if (e.key.toLowerCase() === 'f') {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [idx, go, nav]);

  useEffect(() => { document.title = `${idx}/${total} — Own It Deck`; }, [idx, total]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 50 }}>
      <ScaledSlide>
        <DrillProvider>
          {slides[idx - 1]?.(idx, total)}
        </DrillProvider>
      </ScaledSlide>

      <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8 }}>
        <button
          onClick={() => document.documentElement.requestFullscreen().catch(() => {})}
          className="p-2 rounded-md bg-black/60 hover:bg-black/80 text-white border border-white/20"
          aria-label="Fullscreen (F)"
        ><Maximize2 className="w-4 h-4" /></button>
        <button
          onClick={() => nav('/the-table')}
          className="p-2 rounded-md bg-black/60 hover:bg-black/80 text-white border border-white/20"
          aria-label="Close (Esc)"
        ><X className="w-4 h-4" /></button>
      </div>

      <div style={{
        position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <button
          onClick={() => go(idx - 1)}
          disabled={idx === 1}
          className="p-2 rounded-md bg-black/60 hover:bg-black/80 text-white border border-white/20 disabled:opacity-30"
          aria-label="Previous slide (←)"
        ><ChevronLeft className="w-4 h-4" /></button>
        <span className="px-3 py-2 rounded-md bg-black/60 text-white border border-white/20 text-xs tabular-nums">
          {idx} / {total}
        </span>
        <button
          onClick={() => go(idx + 1)}
          disabled={idx === total}
          className="p-2 rounded-md bg-black/60 hover:bg-black/80 text-white border border-white/20 disabled:opacity-30"
          aria-label="Next slide (→)"
        ><ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
