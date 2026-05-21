import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useGiveawayStudio } from './hooks/useGiveawayStudio';
import { useGiveawayPartners } from './hooks/useGiveawayPartners';
import { getStudioCity } from '@/lib/studioNames';
import { DEFAULT_DECK_COPY, DEFAULT_DECK, computeBundleTotal, pick, slide2AutoCopy } from './lib/partnerDeckDefaults';
import { getDeckSlide2, getDeckSlide3Framing } from './lib/winnerCopy';
import { FitText } from './components/FitText';
import { Video, Users, Star, Share2, ArrowUpRight, Phone, Mail } from 'lucide-react';

/* OTF brand */
const C = {
  orange: '#FF6F0D',
  bone: '#FDF7EA',
  dark: '#0A0A0A',
  gray: '#D7D7D7',
  boneDim08: 'rgba(253,247,234,0.08)',
  boneDim10: 'rgba(253,247,234,0.1)',
  boneDim15: 'rgba(253,247,234,0.15)',
  boneDim20: 'rgba(253,247,234,0.2)',
  boneDim05: 'rgba(253,247,234,0.05)',
  boneDim06: 'rgba(253,247,234,0.6)',
  boneDim05Text: 'rgba(253,247,234,0.5)',
  darkDim18: 'rgba(10,10,10,0.18)',
  darkDim15: 'rgba(10,10,10,0.15)',
  darkDim10: 'rgba(10,10,10,0.1)',
  darkDim5: 'rgba(10,10,10,0.5)',
  orangeDim12: 'rgba(255,111,13,0.12)',
  orangeDim25: 'rgba(255,111,13,0.25)',
  orangeDim10: 'rgba(255,111,13,0.1)',
};

const FONT_STACK = "'PP Right Grotesk', 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
const LABEL_FONT = "system-ui, Arial, sans-serif";

const displayStyle: React.CSSProperties = {
  fontFamily: FONT_STACK, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 0.95,
};
const headlineStyle: React.CSSProperties = {
  fontFamily: FONT_STACK, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.05,
};
const body = (size: number, weight: 300 | 400 = 400): React.CSSProperties => ({
  fontFamily: FONT_STACK, fontWeight: weight, letterSpacing: '-0.01em', lineHeight: 1.6, fontSize: size,
});
const label = (color: string, size = 10): React.CSSProperties => ({
  fontFamily: LABEL_FONT, fontWeight: 700, letterSpacing: '0.2em',
  textTransform: 'uppercase', fontSize: size, color,
});

// Min/max font caps per element
const SIZES = {
  s1_title1: { min: 48, max: 96 },   // Cross-collab
  s1_title2: { min: 28, max: 72 },   // partner names
  s1_subtitle: { min: 16, max: 22 },
  s2_headline: { min: 32, max: 88 },
  s3_headline: { min: 22, max: 64 },
  s4_headline: { min: 22, max: 64 },
  s4_phase_title: { min: 16, max: 32 },
  s5_headline: { min: 22, max: 64 },
  s5_card_title: { min: 16, max: 28 },
  s6_headline: { min: 22, max: 60 },
  s7_headline: { min: 22, max: 64 },
  s8_headline: { min: 22, max: 64 },
  s9_headline: { min: 32, max: 96 },
  s9_subline: { min: 32, max: 96 },
};

function gridColsFor(n: number): string {
  if (n <= 1) return '1fr';
  if (n === 2) return '1fr 1fr';
  if (n === 3) return '1fr 1fr 1fr';
  if (n === 4) return '1fr 1fr';
  return '1fr 1fr 1fr';
}

export default function PartnerDeckPage() {
  const { studioSlug } = useParams<{ studioSlug: string }>();
  const { studio } = useGiveawayStudio(studioSlug);
  const { partners } = useGiveawayPartners(studioSlug);
  const [activeSlide, setActiveSlide] = useState(0);
  const [showRotatePrompt, setShowRotatePrompt] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(orientation: portrait) and (max-width: 767px)');
    const update = () => setShowRotatePrompt(mql.matches);
    update();
    mql.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => {
      mql.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  // Lock to full screen — prevent pinch zoom, double-tap zoom, Safari text auto-adjust.
  // Scoped to the public partner deck route only; fully cleaned up on unmount.
  useEffect(() => {
    // 1. Swap viewport meta tag to disable user scaling
    const viewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    const prevViewport = viewport?.getAttribute('content') ?? null;
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }

    // 2. Safari/iOS CSS overrides on html + body
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlTextAdjust: html.style.getPropertyValue('-webkit-text-size-adjust'),
      htmlTextAdjustStd: html.style.getPropertyValue('text-size-adjust'),
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyTouchAction: body.style.touchAction,
    };
    const prevHtmlOverflowX = html.style.overflowX;
    const prevBodyOverflowX = body.style.overflowX;
    const prevHtmlMaxWidth = html.style.maxWidth;
    const prevBodyMaxWidth = body.style.maxWidth;
    html.style.setProperty('-webkit-text-size-adjust', 'none');
    html.style.setProperty('text-size-adjust', 'none');
    html.style.overflow = 'hidden';
    html.style.overflowX = 'hidden';
    html.style.maxWidth = '100vw';
    body.style.overflow = 'hidden';
    body.style.overflowX = 'hidden';
    body.style.maxWidth = '100vw';
    body.style.touchAction = 'none';

    // 3. Prevent pinch zoom
    const preventZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };

    // 4. Prevent double-tap zoom
    let lastTap = 0;
    const preventDoubleTap = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTap < 300) e.preventDefault();
      lastTap = now;
    };

    document.addEventListener('touchmove', preventZoom, { passive: false });
    document.addEventListener('touchend', preventDoubleTap, { passive: false });

    return () => {
      if (viewport && prevViewport !== null) viewport.setAttribute('content', prevViewport);
      html.style.setProperty('-webkit-text-size-adjust', prev.htmlTextAdjust);
      html.style.setProperty('text-size-adjust', prev.htmlTextAdjustStd);
      html.style.overflow = prev.htmlOverflow;
      html.style.overflowX = prevHtmlOverflowX;
      html.style.maxWidth = prevHtmlMaxWidth;
      body.style.overflow = prev.bodyOverflow;
      body.style.overflowX = prevBodyOverflowX;
      body.style.maxWidth = prevBodyMaxWidth;
      body.style.touchAction = prev.bodyTouchAction;
      document.removeEventListener('touchmove', preventZoom);
      document.removeEventListener('touchend', preventDoubleTap);
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      const container = document.getElementById('deck-scroll');
      if (!container) return;
      const idx = Math.round(container.scrollTop / container.clientHeight);
      setActiveSlide(idx);
    };
    const container = document.getElementById('deck-scroll');
    container?.addEventListener('scroll', handler, { passive: true });
    return () => container?.removeEventListener('scroll', handler);
  }, [studio?.id]);

  if (!studio || !studioSlug) {
    return (
      <div style={{ minHeight: '100vh', background: C.dark, color: C.bone, fontFamily: FONT_STACK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading deck.
      </div>
    );
  }


  const city = getStudioCity(studioSlug);
  const anchor = studio.deck_prize_anchor_value ?? 169;
  const bundleTotal = computeBundleTotal(anchor, partners.length, studio.deck_headline_value);

  const slides = [
    { id: 'cover',    render: () => <SlideCover    partners={partners} studio={studio} /> },
    { id: 'concept',  render: () => <SlideConcept  studio={studio} /> },
    { id: 'prize',    render: () => <SlidePrize    city={city} partners={partners} anchor={anchor} bundleTotal={bundleTotal} studio={studio} /> },
    { id: 'timeline', render: () => <SlideTimeline studio={studio} /> },
    { id: 'story',    render: () => <SlideStory    studio={studio} /> },
    { id: 'tracking', render: () => <SlideTracking studioSlug={studioSlug} studio={studio} /> },
    { id: 'entry',    render: () => <SlideEntry    partners={partners} studio={studio} /> },
    { id: 'ask',      render: () => <SlideAsk      studio={studio} anchor={anchor} /> },
    { id: 'cta',      render: () => <SlideCta      studio={studio} city={city} /> },
  ];

  return (
    <div className="deck-container" style={{ background: C.dark, color: C.bone, fontFamily: FONT_STACK, letterSpacing: '-0.02em', minHeight: '100vh', width: '100%', maxWidth: '100vw', overflowX: 'hidden', touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}>
      <style>{`
        .deck-container, .deck-container *, .deck-slide, .deck-slide * { box-sizing: border-box; }
        .deck-container, #deck-scroll, .deck-slide { max-width: 100vw; overflow-x: hidden; }
        .deck-slide { width: 100%; }
        @media(max-width:768px){
          .deck-slide{ padding:32px 20px !important; max-width:100vw !important; overflow-x:hidden !important; }
          .deck-eyebrow{ font-size:9px !important; letter-spacing:0.18em !important; }
          .deck-body{ font-size:13px !important; max-width:none !important; }
          .deck-phase-title{ font-size:15px !important; }
          .deck-ask-card{ padding:14px !important; }
          .deck-ask-label{ font-size:9px !important; }
          .deck-ask-body{ font-size:12px !important; }
          .deck-nav{ right:12px !important; gap:6px !important; }
          .deck-nav a{ width:5px !important; height:5px !important; }
          .deck-cover-desktop{ display:none !important; }
          .deck-cover-mobile{ display:block !important; }
          .deck-prize-row-desktop{ display:none !important; }
          .deck-prize-row-mobile{ display:flex !important; }
          .deck-story-icon-wrap{ width:32px !important; height:32px !important; }
          .deck-grid{ grid-template-columns:1fr !important; }
          .deck-grid-2{ grid-template-columns:1fr !important; }
        }
        @media(min-width:769px){
          .deck-cover-mobile{ display:none !important; }
          .deck-prize-row-mobile{ display:none !important; }
        }
      `}</style>

      {showRotatePrompt && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200, background: C.dark,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 24, textAlign: 'center',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: C.orange }} />
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 24 }} aria-hidden>
            <rect x="6" y="2" width="12" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12" y2="18" />
            <path d="M2 12a10 10 0 0 1 4-8" />
            <polyline points="2 4 2 8 6 8" />
          </svg>
          <h1 style={{ fontFamily: FONT_STACK, fontWeight: 700, color: C.bone, fontSize: 22, letterSpacing: '-0.02em', marginBottom: 8 }}>
            Rotate your phone
          </h1>
          <p style={{ fontFamily: FONT_STACK, fontWeight: 400, color: C.gray, fontSize: 14, maxWidth: 260, lineHeight: 1.45 }}>
            This deck is best viewed in landscape mode.
          </p>
          <div style={{ width: 40, height: 2, background: C.orange, margin: '32px auto 0' }} />
        </div>
      )}

      <div style={{ display: showRotatePrompt ? 'none' : 'block' }}>
        <nav className="deck-nav" style={{ position: 'fixed', right: 24, top: '50%', transform: 'translateY(-50%)', zIndex: 100, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {slides.map((s, i) => (
            <a key={s.id} href={`#slide-${i}`} aria-label={`Slide ${i + 1}`}
              onClick={() => setActiveSlide(i)}
              style={{
                display: 'block', height: 6, width: 6, borderRadius: '50%',
                transition: 'all 0.25s',
                background: activeSlide === i ? C.orange : C.boneDim20,
                transform: activeSlide === i ? 'scale(1.5)' : 'scale(1)', cursor: 'pointer',
              }} />
          ))}
        </nav>

        <div id="deck-scroll" style={{ height: '100vh', width: '100%', maxWidth: '100vw', overflowY: 'auto', overflowX: 'hidden', scrollSnapType: 'y mandatory', scrollBehavior: 'smooth' }}>
          {slides.map((s, i) => (
            <section key={s.id} id={`slide-${i}`} style={{ scrollSnapAlign: 'start', minHeight: '100vh', width: '100%', display: 'flex' }}>
              {s.render()}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}


/* ─────────── Slide 1: Cover ─────────── */
function SlideCover({ partners, studio }: { partners: { partner_name: string }[]; studio: any }) {
  const SEP = ' \u00D7 ';
  let orangeLine = 'OrangeTheory Fitness';
  if (partners.length >= 1) {
    orangeLine = ['OrangeTheory Fitness', ...partners.map(p => p.partner_name)].join(SEP);
  }
  const title1 = (studio.deck_s1_title1 && String(studio.deck_s1_title1).trim()) || 'Cross-Collab Raffle';
  return (
    <div style={{ position: 'relative', width: '100%', background: C.dark, display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: C.orange }} />
      <div className="deck-slide" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '80px 24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <p className="deck-eyebrow" style={{ ...label(C.orange), marginBottom: 24 }}>Partnership opportunity</p>
        <div style={{ width: '100%', maxWidth: 1000 }}>
          {/* Desktop: single-line auto-fit */}
          <div className="deck-cover-desktop">
            <FitText as="h1" min={SIZES.s1_title1.min} max={SIZES.s1_title1.max}
              fixed={studio.deck_s1_title1_size}
              style={{ ...displayStyle, color: C.bone, marginBottom: 16 }}>
              {title1}
            </FitText>
            <FitText as="p" min={SIZES.s1_title2.min} max={SIZES.s1_title2.max}
              fixed={studio.deck_s1_title2_size}
              style={{ ...displayStyle, color: C.orange, marginBottom: 28 }}>
              {orangeLine}
            </FitText>
          </div>
          {/* Mobile (landscape): title nowrap fills width, partner line wraps naturally */}
          <div className="deck-cover-mobile" style={{ display: 'none' }}>
            <FitText as="h1" min={24} max={72}
              style={{ ...displayStyle, color: C.bone, marginBottom: 16 }}>
              {title1}
            </FitText>
            <FitText as="p" multiline min={18} max={56}
              style={{ ...displayStyle, color: C.orange, marginBottom: 28, lineHeight: 0.95 }}>
              {orangeLine}
            </FitText>
          </div>
        </div>
        <p className="deck-body" style={{ ...body(18), color: C.gray, maxWidth: 420 }}>
          A giveaway built around the best local businesses and the people who love them.
        </p>
      </div>
      <p style={{ ...label(C.gray, 9), opacity: 0.4, textAlign: 'center', paddingBottom: 32 }}>Scroll to explore</p>
    </div>
  );
}


/* ─────────── Slide 2: Concept ─────────── */
function SlideConcept({ studio }: { studio: any }) {
  const { headline: headlineText, body: bodyText } = getDeckSlide2(
    studio.winner_structure,
    studio.deck_s2_headline,
    studio.deck_s2_body ?? studio.deck_intro_copy,
  );
  const sentences = headlineText.split(/(?<=\.)\s+/).filter(Boolean);

  return (
    <div className="deck-slide" style={{ width: '100%', background: C.orange, color: C.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
      <div style={{ maxWidth: 900, width: '100%' }}>
        <p className="deck-eyebrow" style={{ ...label(C.dark), opacity: 0.55, marginBottom: 24 }}>The concept</p>
        <div style={{ marginBottom: 32 }}>
          {sentences.map((s, i) => (
            <FitText key={i} as="div" min={SIZES.s2_headline.min} max={SIZES.s2_headline.max}
              fixed={studio.deck_s2_headline_size}
              style={{ ...displayStyle, color: C.dark }}>
              {s}
            </FitText>
          ))}
        </div>
        <p style={{ ...body(22), color: C.dark, maxWidth: 720 }}>{bodyText}</p>
      </div>
    </div>
  );
}

/* ─────────── Slide 3: Prize ─────────── */
function SlidePrize({ city, partners, anchor, bundleTotal, studio }: any) {
  type Row = { tag: string; tagAccent: boolean; title: string; description: string; value?: string };
  const rows: Row[] = [
    { tag: `OrangeTheory Fitness ${city}`, tagAccent: true, title: 'One month free membership', description: 'Full access, all classes, all month. This is the anchor of the bundle.', value: `$${anchor}` },
  ];
  for (const p of partners) {
    rows.push({ tag: p.partner_name, tagAccent: false, title: p.prize_description?.trim() || 'Prize coming', description: p.receipt_instructions?.trim() || '' });
  }
  const framing = getDeckSlide3Framing(studio.winner_structure);
  const headlineText = pick(studio.deck_s3_headline, framing.headline);
  const valueNote = `Total prize value: ${bundleTotal}`;

  const winnerBadge = (
    <span style={{
      display: 'inline-block', padding: '2px 6px', borderRadius: 2,
      fontFamily: LABEL_FONT, fontSize: 9, fontWeight: 700, letterSpacing: '0.16em',
      textTransform: 'uppercase', whiteSpace: 'nowrap',
      background: C.boneDim08, color: C.gray, border: `1px solid ${C.boneDim15}`,
      flexShrink: 0,
    }}>1 winner</span>
  );

  const footerColor = framing.footerStyle === 'brand' ? C.orange : C.gray;

  const tagPillStyle = (accent: boolean, mobileCapWidth?: boolean): React.CSSProperties => ({
    display: 'inline-block', padding: '3px 8px', borderRadius: 2,
    fontFamily: LABEL_FONT, fontSize: 9, fontWeight: 900, letterSpacing: '0.12em',
    textTransform: 'uppercase', whiteSpace: 'nowrap',
    background: accent ? C.orange : C.boneDim08,
    color: accent ? C.dark : C.gray,
    border: accent ? 'none' : `1px solid ${C.boneDim15}`,
    flexShrink: 0,
    ...(mobileCapWidth ? { maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis' } : null),
  });

  return (
    <div className="deck-slide" style={{ width: '100%', background: C.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
      <div style={{ maxWidth: 720, width: '100%' }}>
        <p className="deck-eyebrow" style={{ ...label(C.orange), marginBottom: 12 }}>The prize package</p>
        <FitText as="h2" min={SIZES.s3_headline.min} max={SIZES.s3_headline.max}
          fixed={studio.deck_s3_headline_size}
          style={{ ...displayStyle, color: C.bone, marginBottom: 12 }}>
          {headlineText}
        </FitText>
        <p style={{ ...body(12), color: C.orange, opacity: 0.85, marginBottom: 4 }}>{valueNote}</p>
        <p style={{ ...body(12), color: C.gray, marginBottom: 32 }}>{framing.bundleSubtext}</p>

        <div style={{ maxWidth: 520, width: '100%' }}>
          {rows.map((r, i) => {
            const isLast = i === rows.length - 1;
            const showValue = !!r.value && (!framing.showWinnerBadgePerRow || r.tagAccent);
            const rowBorder = isLast ? 'none' : `1px solid ${C.boneDim08}`;
            return (
              <div key={i}>
                {/* Desktop row */}
                <div className="deck-prize-row-desktop" style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '15px 0', borderBottom: rowBorder }}>
                  <span style={tagPillStyle(r.tagAccent)}>{r.tag}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ ...headlineStyle, fontSize: 15, color: C.bone, fontWeight: 900 }}>{r.title}</p>
                    {r.description && <p style={{ ...body(12), color: C.boneDim05Text, lineHeight: 1.45, marginTop: 4 }}>{r.description}</p>}
                  </div>
                  {showValue && (
                    <p style={{ ...headlineStyle, fontSize: 11, color: C.orange, fontWeight: 900, marginLeft: 'auto', flexShrink: 0 }}>{r.value}</p>
                  )}
                  {framing.showWinnerBadgePerRow && (
                    <span style={{ marginLeft: showValue ? 8 : 'auto' }}>{winnerBadge}</span>
                  )}
                </div>
                {/* Mobile row: stacked */}
                <div className="deck-prize-row-mobile" style={{ display: 'none', flexDirection: 'column', padding: '14px 0', borderBottom: rowBorder }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                    <span style={tagPillStyle(r.tagAccent, true)}>{r.tag}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {framing.showWinnerBadgePerRow && winnerBadge}
                      {showValue && (
                        <span style={{ fontFamily: FONT_STACK, fontSize: 12, fontWeight: 700, color: C.orange, flexShrink: 0 }}>{r.value}</span>
                      )}
                    </div>
                  </div>
                  <p style={{ ...headlineStyle, fontSize: 15, color: C.bone, fontWeight: 900 }}>{r.title}</p>
                  {r.description && <p style={{ ...body(12), color: C.boneDim05Text, lineHeight: 1.45, marginTop: 4 }}>{r.description}</p>}
                </div>
              </div>
            );
          })}
          <p style={{
            ...body(12), color: footerColor, fontStyle: 'italic', marginTop: 12,
          }}>
            {framing.footerLine}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Slide 4: Timeline ─────────── */
function SlideTimeline({ studio }: { studio: any }) {
  const phases = [
    { tag: DEFAULT_DECK.s4_phase1_tag, title: pick(studio.deck_s4_phase1_title, DEFAULT_DECK.s4_phase1_title), body: pick(studio.deck_s4_phase1_body, DEFAULT_DECK.s4_phase1_body) },
    { tag: DEFAULT_DECK.s4_phase2_tag, title: pick(studio.deck_s4_phase2_title, DEFAULT_DECK.s4_phase2_title), body: pick(studio.deck_s4_phase2_body, DEFAULT_DECK.s4_phase2_body) },
    { tag: DEFAULT_DECK.s4_phase3_tag, title: pick(studio.deck_s4_phase3_title, DEFAULT_DECK.s4_phase3_title), body: pick(studio.deck_s4_phase3_body, DEFAULT_DECK.s4_phase3_body) },
  ];
  return (
    <div className="deck-slide" style={{ width: '100%', background: C.bone, color: C.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
      <div style={{ maxWidth: 720, width: '100%' }}>
        <p className="deck-eyebrow" style={{ ...label(C.orange), marginBottom: 12 }}>Campaign timeline</p>
        <FitText as="h2" min={SIZES.s4_headline.min} max={SIZES.s4_headline.max}
          fixed={studio.deck_s4_headline_size}
          style={{ ...displayStyle, color: C.dark, marginBottom: 16 }}>
          {pick(studio.deck_s4_headline, DEFAULT_DECK.s4_headline)}
        </FitText>
        <p style={{ fontFamily: LABEL_FONT, fontSize: 14, color: '#555', marginBottom: 24 }}>
          {pick(studio.deck_s4_subtext, DEFAULT_DECK.s4_subtext)}
        </p>

        <div>
          {phases.map((p, i) => {
            const isLast = i === phases.length - 1;
            return (
              <div key={i} style={{ display: 'flex', gap: 18, padding: '14px 0', borderBottom: isLast ? 'none' : '1px solid rgba(10,10,10,0.08)' }}>
                <div style={{ ...displayStyle, fontSize: 10, color: C.orange, minWidth: 26, lineHeight: 1.2 }}>{String(i + 1).padStart(2, '0')}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: 'inline-block', background: C.dark, color: C.orange,
                    fontFamily: LABEL_FONT, fontSize: 8, fontWeight: 700, letterSpacing: '0.2em',
                    textTransform: 'uppercase', padding: '3px 7px', borderRadius: 2, marginBottom: 5,
                  }}>{p.tag}</span>
                  <FitText as="p" min={SIZES.s4_phase_title.min} max={SIZES.s4_phase_title.max}
                    fixed={studio.deck_s4_phase_title_size}
                    style={{ ...headlineStyle, color: C.dark, fontWeight: 900 }}>
                    {p.title}
                  </FitText>
                  <p style={{ fontFamily: FONT_STACK, fontWeight: 400, fontSize: 13, color: '#555', lineHeight: 1.5, marginTop: 4 }}>{p.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Slide 5: How we build it ─────────── */
function SlideStory({ studio }: { studio: any }) {
  const items = [
    { Icon: Video,  title: pick(studio.deck_s5_c1_title, DEFAULT_DECK.s5_c1_title), body: pick(studio.deck_s5_c1_body, DEFAULT_DECK.s5_c1_body) },
    { Icon: Users,  title: pick(studio.deck_s5_c2_title, DEFAULT_DECK.s5_c2_title), body: pick(studio.deck_s5_c2_body, DEFAULT_DECK.s5_c2_body) },
    { Icon: Star,   title: pick(studio.deck_s5_c3_title, DEFAULT_DECK.s5_c3_title), body: pick(studio.deck_s5_c3_body, DEFAULT_DECK.s5_c3_body) },
    { Icon: Share2, title: pick(studio.deck_s5_c4_title, DEFAULT_DECK.s5_c4_title), body: pick(studio.deck_s5_c4_body, DEFAULT_DECK.s5_c4_body) },
  ];
  return (
    <div className="deck-slide" style={{ width: '100%', background: C.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
      <div style={{ maxWidth: 960, width: '100%' }}>
        <p className="deck-eyebrow" style={{ ...label(C.orange), marginBottom: 12 }}>How we build it</p>
        <FitText as="h2" min={SIZES.s5_headline.min} max={SIZES.s5_headline.max}
          fixed={studio.deck_s5_headline_size}
          style={{ ...displayStyle, color: C.bone, marginBottom: 40 }}>
          {pick(studio.deck_s5_headline, DEFAULT_DECK.s5_headline)}
        </FitText>
        <div className="deck-grid" style={{ display: 'grid', gridTemplateColumns: gridColsFor(items.length), gap: 12, alignItems: 'stretch' }}>
          {items.map((it, i) => (
            <div key={i} style={{ background: C.dark, border: `1px solid ${C.boneDim10}`, borderRadius: 6, padding: '20px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div className="deck-story-icon-wrap" style={{ height: 34, width: 34, borderRadius: '50%', background: C.orangeDim12, border: `1px solid ${C.orangeDim25}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <it.Icon size={15} color={C.orange} strokeWidth={2} />
              </div>
              <div>
                <FitText as="p" min={SIZES.s5_card_title.min} max={SIZES.s5_card_title.max}
                  fixed={studio.deck_s5_card_title_size}
                  style={{ ...headlineStyle, color: C.bone, fontWeight: 900, letterSpacing: '-0.01em' }}>
                  {it.title}
                </FitText>
                <p style={{ fontFamily: FONT_STACK, fontWeight: 400, fontSize: 12, color: C.boneDim05Text, lineHeight: 1.5, marginTop: 6 }}>{it.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`@media(max-width:768px){.deck-grid{grid-template-columns:1fr !important;}}`}</style>
    </div>
  );
}

/* ─────────── Slide 6: Tracking ─────────── */
function SlideTracking({ studioSlug, studio }: { studioSlug: string; studio: any }) {
  return (
    <div className="deck-slide" style={{ width: '100%', background: C.orange, color: C.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
      <div style={{ maxWidth: 720, width: '100%' }}>
        <p className="deck-eyebrow" style={{ ...label(C.dark), opacity: 0.55, marginBottom: 12 }}>The tracking system</p>
        <FitText as="h2" min={SIZES.s6_headline.min} max={SIZES.s6_headline.max}
          fixed={studio.deck_s6_headline_size}
          style={{ ...displayStyle, color: C.dark, marginBottom: 16 }}>
          {pick(studio.deck_s6_headline, DEFAULT_DECK.s6_headline)}
        </FitText>
        <p style={{ ...body(16), color: C.dark, opacity: 0.7, maxWidth: 480, marginBottom: 32 }}>
          {pick(studio.deck_s6_body, DEFAULT_DECK.s6_body)}
        </p>
        <div className="deck-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'stretch' }}>
          <LinkCard href={`/giveaway/${studioSlug}`}           label="Giveaway entry"    title="What entrants see"       url={`/giveaway/${studioSlug}`} />
          <LinkCard href={`/admin/${studioSlug}/partner-view`} label="Partner dashboard" title="Your live entry tracker" url={`/admin/${studioSlug}/partner-view`} />
        </div>
        <p style={{ ...body(11), color: C.dark, opacity: 0.5, textAlign: 'center', marginTop: 24 }}>
          {pick(studio.deck_s6_note, DEFAULT_DECK.s6_note)}
        </p>
      </div>
      <style>{`@media(max-width:768px){.deck-grid-2{grid-template-columns:1fr !important;}}`}</style>
    </div>
  );
}

function LinkCard({ href, label: lbl, title, url }: { href: string; label: string; title: string; url: string }) {
  const [hover, setHover] = useState(false);
  return (
    <a href={href} rel="noreferrer"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'block', background: hover ? C.darkDim18 : C.darkDim10,
        borderRadius: 8, padding: '16px 20px', textDecoration: 'none', transition: 'background 0.2s',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ height: 36, width: 36, background: C.darkDim15, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ArrowUpRight size={18} color={C.dark} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ ...label(C.dark, 9), opacity: 0.55, marginBottom: 2 }}>{lbl}</p>
          <p style={{ ...headlineStyle, fontSize: 14, color: C.dark, fontWeight: 900 }}>{title}</p>
          <p style={{ fontFamily: LABEL_FONT, fontSize: 10, color: C.darkDim5, marginTop: 2 }}>{url}</p>
        </div>
      </div>
    </a>
  );
}

/* ─────────── Slide 7: Entry actions ─────────── */
function SlideEntry({ partners, studio }: any) {
  const baseActions: { text: string; bonus?: boolean }[] = [
    { text: 'Follow all participating businesses' },
    { text: 'Like, comment, tag a friend, and share to your story' },
    { text: 'Fill out the entry form' },
    { text: 'Post a story of you taking a class and tag us' },
  ];
  for (const p of partners) baseActions.push({ text: `Visit ${p.partner_name}`, bonus: true });

  return (
    <div className="deck-slide" style={{ width: '100%', background: C.bone, color: C.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
      <div style={{ maxWidth: 720, width: '100%' }}>
        <p className="deck-eyebrow" style={{ ...label(C.orange), marginBottom: 12 }}>How people enter</p>
        <FitText as="h2" min={SIZES.s7_headline.min} max={SIZES.s7_headline.max}
          fixed={studio.deck_s7_headline_size}
          style={{ ...displayStyle, color: C.dark, marginBottom: 32 }}>
          {pick(studio.deck_s7_headline, DEFAULT_DECK.s7_headline)}
        </FitText>

        <div style={{ maxWidth: 560 }}>
          {baseActions.map((a, i) => {
            const isLast = i === baseActions.length - 1;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderBottom: isLast ? 'none' : '1px solid rgba(10,10,10,0.08)' }}>
                <span style={{ ...displayStyle, fontSize: 10, color: C.orange, minWidth: 18, lineHeight: 1.2 }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontFamily: FONT_STACK, fontWeight: 400, fontSize: 13, color: C.dark, flex: 1, lineHeight: 1.35, letterSpacing: '-0.01em' }}>{a.text}</span>
                {a.bonus && (
                  <span style={{
                    background: C.orangeDim10, color: C.orange,
                    fontFamily: LABEL_FONT, fontSize: 9, fontWeight: 900, letterSpacing: '0.2em',
                    textTransform: 'uppercase', padding: '3px 7px', borderRadius: 3,
                  }}>Bonus</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Slide 8: What we need ─────────── */
function SlideAsk({ studio, anchor }: { studio: any; anchor: number }) {
  const cards = [
    { lbl: 'Prize',      body: pick(studio.deck_s8_prize ?? studio.deck_what_we_need_prize,      DEFAULT_DECK_COPY.askPrize(anchor)) },
    { lbl: 'Promotion',  body: pick(studio.deck_s8_promo ?? studio.deck_what_we_need_promotion,  DEFAULT_DECK_COPY.askPromotion) },
    { lbl: 'VIP class',  body: pick(studio.deck_s8_class ?? studio.deck_what_we_need_class,      DEFAULT_DECK_COPY.askClass) },
    { lbl: '15 minutes', body: pick(studio.deck_s8_time  ?? studio.deck_what_we_need_time,       DEFAULT_DECK_COPY.askTime) },
  ];
  return (
    <div className="deck-slide" style={{ width: '100%', background: C.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
      <div style={{ maxWidth: 720, width: '100%' }}>
        <p className="deck-eyebrow" style={{ ...label(C.orange), marginBottom: 12 }}>What we need from you</p>
        <FitText as="h2" min={SIZES.s8_headline.min} max={SIZES.s8_headline.max}
          fixed={studio.deck_s8_headline_size}
          style={{ ...displayStyle, color: C.bone, marginBottom: 32 }}>
          {pick(studio.deck_s8_headline, DEFAULT_DECK.s8_headline)}
        </FitText>
        <div className="deck-grid" style={{ display: 'grid', gridTemplateColumns: gridColsFor(cards.length), gap: 12, alignItems: 'stretch' }}>
          {cards.map((c, i) => (
            <div key={i} className="deck-ask-card" style={{ background: C.boneDim05, border: `1px solid ${C.boneDim10}`, borderRadius: 6, padding: '15px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <p className="deck-ask-label" style={{ ...label(C.orange, 9), marginBottom: 6 }}>{c.lbl}</p>
              <p className="deck-ask-body" style={{ fontFamily: FONT_STACK, fontWeight: 400, fontSize: 12, color: C.boneDim06, lineHeight: 1.45, letterSpacing: '-0.01em' }}>{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Slide 9: CTA ─────────── */
function SlideCta({ studio, city }: { studio: any; city: string }) {
  const phoneClean = studio.deck_contact_phone ? String(studio.deck_contact_phone).replace(/[^0-9+]/g, '') : null;
  return (
    <div className="deck-slide" style={{ position: 'relative', width: '100%', background: C.bone, color: C.dark, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
      <div style={{ maxWidth: 700, width: '100%', textAlign: 'center' }}>
        <FitText as="h2" min={SIZES.s9_headline.min} max={SIZES.s9_headline.max}
          fixed={studio.deck_s9_headline_size}
          style={{ ...displayStyle, color: C.dark }}>
          {pick(studio.deck_s9_headline, DEFAULT_DECK.s9_headline)}
        </FitText>
        <FitText as="p" min={SIZES.s9_subline.min} max={SIZES.s9_subline.max}
          fixed={studio.deck_s9_subline_size}
          style={{ ...displayStyle, color: C.orange, marginBottom: 24 }}>
          {pick(studio.deck_s9_subline, DEFAULT_DECK.s9_subline)}
        </FitText>
        <p style={{ fontFamily: FONT_STACK, fontWeight: 400, fontSize: 13, color: '#555', lineHeight: 1.55, maxWidth: 360, margin: '0 auto 28px' }}>
          {pick(studio.deck_s9_body, DEFAULT_DECK.s9_body)}
        </p>

        {(studio.deck_contact_name || phoneClean || studio.deck_contact_email) && (
          <div style={{ background: C.dark, borderRadius: 8, padding: '22px 28px', maxWidth: 320, width: '100%', margin: '0 auto', textAlign: 'center' }}>
            <p style={{ ...label(C.gray, 9), marginBottom: 10 }}>Your contact at OrangeTheory Fitness {city}</p>
            {studio.deck_contact_name && <p style={{ ...headlineStyle, fontSize: 20, color: C.bone, fontWeight: 900, marginBottom: 2 }}>{studio.deck_contact_name}</p>}
            {studio.deck_contact_title && <p style={{ fontFamily: LABEL_FONT, fontSize: 11, color: C.orange, letterSpacing: '0.04em', marginBottom: 14 }}>{studio.deck_contact_title}</p>}
            {phoneClean && (
              <a href={`tel:${phoneClean}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.gray, fontSize: 11, fontFamily: FONT_STACK, marginBottom: 6, textDecoration: 'none' }}>
                <Phone size={12} color={C.gray} style={{ opacity: 0.5 }} />
                {studio.deck_contact_phone}
              </a>
            )}
            {studio.deck_contact_email && (
              <a href={`mailto:${studio.deck_contact_email}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.gray, fontSize: 11, fontFamily: FONT_STACK, textDecoration: 'none', wordBreak: 'break-all' }}>
                <Mail size={12} color={C.gray} style={{ opacity: 0.5 }} />
                {studio.deck_contact_email}
              </a>
            )}
          </div>
        )}
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: C.orange }} />
    </div>
  );
}
