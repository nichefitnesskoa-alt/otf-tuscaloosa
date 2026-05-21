import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useGiveawayStudio } from './hooks/useGiveawayStudio';
import { useGiveawayPartners } from './hooks/useGiveawayPartners';
import { getStudioCity } from '@/lib/studioNames';
import { DEFAULT_DECK_COPY, DEFAULT_DECK, computeBundleTotal, pick } from './lib/partnerDeckDefaults';
import { Video, Users, Star, Share2, ArrowUpRight, Phone, Mail } from 'lucide-react';

/* ─────────── OTF Brand Constants ─────────── */
const C = {
  orange: '#FF6F0D',
  bone: '#FDF7EA',
  dark: '#0A0A0A',
  gray: '#D7D7D7',
  boneDim10: 'rgba(253,247,234,0.1)',
  boneDim08: 'rgba(253,247,234,0.08)',
  boneDim15: 'rgba(253,247,234,0.15)',
  boneDim20: 'rgba(253,247,234,0.2)',
  boneDim05: 'rgba(253,247,234,0.05)',
  boneDim06: 'rgba(253,247,234,0.6)',
  boneDim05Text: 'rgba(253,247,234,0.5)',
  darkDim18: 'rgba(10,10,10,0.18)',
  darkDim15: 'rgba(10,10,10,0.15)',
  darkDim10: 'rgba(10,10,10,0.1)',
  darkDim08: 'rgba(10,10,10,0.08)',
  darkDim5: 'rgba(10,10,10,0.5)',
  orangeDim12: 'rgba(255,111,13,0.12)',
  orangeDim25: 'rgba(255,111,13,0.25)',
  orangeDim10: 'rgba(255,111,13,0.1)',
};

const FONT_STACK = "'PP Right Grotesk', 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
const LABEL_FONT = "system-ui, Arial, sans-serif";

const display = (size: number | string, weight = 900): React.CSSProperties => ({
  fontFamily: FONT_STACK,
  fontWeight: weight,
  letterSpacing: '-0.04em',
  lineHeight: 0.9,
  fontSize: size as any,
});

const headline = (size: number): React.CSSProperties => ({
  fontFamily: FONT_STACK,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  lineHeight: 1.05,
  fontSize: size,
});

const body = (size: number, weight: 300 | 400 = 400): React.CSSProperties => ({
  fontFamily: FONT_STACK,
  fontWeight: weight,
  letterSpacing: '-0.01em',
  lineHeight: 1.6,
  fontSize: size,
});

const label = (color: string, size = 10): React.CSSProperties => ({
  fontFamily: LABEL_FONT,
  fontWeight: 700,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  fontSize: size,
  color,
});

// Symmetric grid: 4 cards = 2x2, never an orphan row.
function gridColsFor(n: number): string {
  if (n <= 1) return '1fr';
  if (n === 2) return '1fr 1fr';
  if (n === 3) return '1fr 1fr 1fr';
  if (n === 4) return '1fr 1fr';
  return '1fr 1fr 1fr'; // 5 or 6
}

export default function PartnerDeckPage() {
  const { studioSlug } = useParams<{ studioSlug: string }>();
  const { studio } = useGiveawayStudio(studioSlug);
  const { partners } = useGiveawayPartners(studioSlug);
  const [activeSlide, setActiveSlide] = useState(0);

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
    { id: 'cover',    render: () => <SlideCover    partners={partners} /> },
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
    <div style={{ background: C.dark, color: C.bone, fontFamily: FONT_STACK, letterSpacing: '-0.02em', minHeight: '100vh' }}>
      <nav style={{ position: 'fixed', right: 24, top: '50%', transform: 'translateY(-50%)', zIndex: 100, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {slides.map((s, i) => (
          <a key={s.id} href={`#slide-${i}`} aria-label={`Slide ${i + 1}`}
            onClick={() => setActiveSlide(i)}
            style={{
              display: 'block',
              height: 6, width: 6, borderRadius: '50%',
              transition: 'all 0.25s',
              background: activeSlide === i ? C.orange : C.boneDim20,
              transform: activeSlide === i ? 'scale(1.5)' : 'scale(1)',
              cursor: 'pointer',
            }} />
        ))}
      </nav>

      <div id="deck-scroll" style={{ height: '100vh', overflowY: 'auto', scrollSnapType: 'y mandatory', scrollBehavior: 'smooth' }}>
        {slides.map((s, i) => (
          <section key={s.id} id={`slide-${i}`} style={{ scrollSnapAlign: 'start', minHeight: '100vh', width: '100%', display: 'flex' }}>
            {s.render()}
          </section>
        ))}
      </div>
    </div>
  );
}

/* ─────────── Slide 1: Cover ─────────── */
function SlideCover({ partners }: { partners: { partner_name: string }[] }) {
  // Build orange line from partners only — no city, no prospect.
  const SEP = ' \u00D7 ';
  let orangeLine = 'OrangeTheory Fitness';
  if (partners.length >= 1) {
    orangeLine = ['OrangeTheory Fitness', ...partners.map(p => p.partner_name)].join(SEP);
  }
  // clamp font-size: never below 28px, scales with viewport.
  const orangeSize = 'clamp(28px, 6.2vw, 72px)';
  return (
    <div style={{ position: 'relative', width: '100%', background: C.dark, display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: C.orange }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '80px 24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <div style={{ ...display(13), color: C.bone, opacity: 0.92, marginBottom: 28 }}>OTF</div>
        <p style={{ ...label(C.orange), marginBottom: 24 }}>Partnership opportunity</p>
        <h1 style={{ ...display('clamp(48px, 10vw, 96px)'), color: C.bone, marginBottom: 16, whiteSpace: 'nowrap' }}>Cross-collab</h1>
        <p style={{ ...display(orangeSize), color: C.orange, marginBottom: 28, whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {orangeLine}
        </p>
        <p style={{ ...body(18), color: C.gray, maxWidth: 420 }}>
          A giveaway built around the best local businesses and the people who love them.
        </p>
      </div>
      <p style={{ ...label(C.gray, 9), opacity: 0.4, textAlign: 'center', paddingBottom: 32 }}>Scroll to explore</p>
    </div>
  );
}

/* ─────────── Slide 2: Concept (orange) ─────────── */
function SlideConcept({ studio }: { studio: any }) {
  return (
    <div style={{ width: '100%', background: C.orange, color: C.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
      <div style={{ maxWidth: 720 }}>
        <p style={{ ...label(C.dark), opacity: 0.55, marginBottom: 24 }}>The concept</p>
        <h2 style={{ ...display('clamp(48px, 8vw, 88px)'), color: C.dark, marginBottom: 32, maxWidth: 720 }}>
          {pick(studio.deck_s2_headline, DEFAULT_DECK.s2_headline)}
        </h2>
        <p style={{ ...body(22), color: C.dark }}>{pick(studio.deck_s2_body ?? studio.deck_intro_copy, DEFAULT_DECK_COPY.intro)}</p>
      </div>
    </div>
  );
}

/* ─────────── Slide 3: Prize ─────────── */
function SlidePrize({ city, partners, anchor, bundleTotal, studio }: any) {
  type Row = { tag: string; tagAccent: boolean; title: string; description: string; value?: string };
  const rows: Row[] = [
    {
      tag: `OrangeTheory Fitness ${city}`, tagAccent: true,
      title: 'One month free membership',
      description: 'Full access, all classes, all month. This is the anchor of the bundle.',
      value: `$${anchor}`,
    },
  ];
  for (const p of partners) {
    rows.push({
      tag: p.partner_name,
      tagAccent: false,
      title: p.prize_description?.trim() || 'Prize coming',
      description: p.receipt_instructions?.trim() || '',
    });
  }
  const valueNote = pick(studio.deck_s3_value_note, `Target total value: ${bundleTotal}`);

  return (
    <div style={{ width: '100%', background: C.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
      <div style={{ maxWidth: 720, width: '100%' }}>
        <p style={{ ...label(C.orange), marginBottom: 12 }}>The prize package</p>
        <h2 style={{ ...display('clamp(40px, 6vw, 64px)'), color: C.bone, marginBottom: 12 }}>
          {pick(studio.deck_s3_headline, DEFAULT_DECK.s3_headline)}
        </h2>
        <p style={{ ...body(12), color: C.orange, opacity: 0.85, marginBottom: 8 }}>{valueNote}</p>
        <p style={{ ...body(12), color: C.gray, marginBottom: 32 }}>
          The more partners join, the bigger the prize. The more people enter.
        </p>

        <div style={{ maxWidth: 520, width: '100%' }}>
          {rows.map((r, i) => {
            const isLast = i === rows.length - 1;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '15px 0', borderBottom: isLast ? 'none' : `1px solid ${C.boneDim08}` }}>
                <span style={{
                  display: 'inline-block', padding: '3px 8px', borderRadius: 2,
                  fontFamily: LABEL_FONT, fontSize: 9, fontWeight: 900, letterSpacing: '0.12em',
                  textTransform: 'uppercase', whiteSpace: 'nowrap',
                  background: r.tagAccent ? C.orange : C.boneDim08,
                  color: r.tagAccent ? C.dark : C.gray,
                  border: r.tagAccent ? 'none' : `1px solid ${C.boneDim15}`,
                  flexShrink: 0,
                }}>{r.tag}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ ...headline(15), color: C.bone, fontWeight: 900 }}>{r.title}</p>
                  {r.description && (
                    <p style={{ ...body(12), color: C.boneDim05Text, lineHeight: 1.45, marginTop: 4 }}>{r.description}</p>
                  )}
                </div>
                {r.value && (
                  <p style={{ ...headline(11), color: C.orange, fontWeight: 900, marginLeft: 'auto', flexShrink: 0 }}>{r.value}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Slide 4: Timeline (Bone, light) ─────────── */
function SlideTimeline({ studio }: { studio: any }) {
  const phases = [
    { tag: DEFAULT_DECK.s4_phase1_tag, title: pick(studio.deck_s4_phase1_title, DEFAULT_DECK.s4_phase1_title), body: pick(studio.deck_s4_phase1_body, DEFAULT_DECK.s4_phase1_body) },
    { tag: DEFAULT_DECK.s4_phase2_tag, title: pick(studio.deck_s4_phase2_title, DEFAULT_DECK.s4_phase2_title), body: pick(studio.deck_s4_phase2_body, DEFAULT_DECK.s4_phase2_body) },
    { tag: DEFAULT_DECK.s4_phase3_tag, title: pick(studio.deck_s4_phase3_title, DEFAULT_DECK.s4_phase3_title), body: pick(studio.deck_s4_phase3_body, DEFAULT_DECK.s4_phase3_body) },
  ];
  return (
    <div style={{ width: '100%', background: C.bone, color: C.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
      <div style={{ maxWidth: 720, width: '100%' }}>
        <p style={{ ...label(C.orange), marginBottom: 12 }}>Campaign timeline</p>
        <h2 style={{ ...display('clamp(40px, 6vw, 64px)'), color: C.dark, marginBottom: 16 }}>
          {pick(studio.deck_s4_headline, DEFAULT_DECK.s4_headline)}
        </h2>
        <p style={{ fontFamily: LABEL_FONT, fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 24 }}>
          {pick(studio.deck_s4_subtext, DEFAULT_DECK.s4_subtext)}
        </p>

        <div>
          {phases.map((p, i) => {
            const isLast = i === phases.length - 1;
            return (
              <div key={i} style={{ display: 'flex', gap: 18, padding: '14px 0', borderBottom: isLast ? 'none' : '1px solid rgba(10,10,10,0.08)' }}>
                <div style={{ ...display(10), color: C.orange, minWidth: 26, lineHeight: 1.2 }}>{String(i + 1).padStart(2, '0')}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: 'inline-block', background: C.dark, color: C.orange,
                    fontFamily: LABEL_FONT, fontSize: 8, fontWeight: 700, letterSpacing: '0.2em',
                    textTransform: 'uppercase', padding: '3px 7px', borderRadius: 2, marginBottom: 5,
                  }}>{p.tag}</span>
                  <p style={{ ...headline(16), color: C.dark, fontWeight: 900 }}>{p.title}</p>
                  <p style={{ fontFamily: FONT_STACK, fontWeight: 400, fontSize: 12, color: '#555', lineHeight: 1.5, marginTop: 4 }}>{p.body}</p>
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
    <div style={{ width: '100%', background: C.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
      <div style={{ maxWidth: 960, width: '100%' }}>
        <p style={{ ...label(C.orange), marginBottom: 12 }}>How we build it</p>
        <h2 style={{ ...display('clamp(40px, 6vw, 64px)'), color: C.bone, marginBottom: 40 }}>
          {pick(studio.deck_s5_headline, DEFAULT_DECK.s5_headline)}
        </h2>
        <div className="deck-grid" style={{ display: 'grid', gridTemplateColumns: gridColsFor(items.length), gap: 12, alignItems: 'stretch' }}>
          {items.map((it, i) => (
            <div key={i} style={{ background: C.dark, border: `1px solid ${C.boneDim10}`, borderRadius: 6, padding: '20px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ height: 34, width: 34, borderRadius: '50%', background: C.orangeDim12, border: `1px solid ${C.orangeDim25}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <it.Icon size={15} color={C.orange} strokeWidth={2} />
              </div>
              <div>
                <p style={{ ...headline(14), color: C.bone, fontWeight: 900, letterSpacing: '-0.01em' }}>{it.title}</p>
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

/* ─────────── Slide 6: Tracking (orange) ─────────── */
function SlideTracking({ studioSlug, studio }: { studioSlug: string; studio: any }) {
  return (
    <div style={{ width: '100%', background: C.orange, color: C.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
      <div style={{ maxWidth: 720, width: '100%' }}>
        <p style={{ ...label(C.dark), opacity: 0.55, marginBottom: 12 }}>The tracking system</p>
        <h2 style={{ ...display('clamp(36px, 5.5vw, 60px)'), color: C.dark, marginBottom: 16, whiteSpace: 'nowrap' }}>
          {pick(studio.deck_s6_headline, DEFAULT_DECK.s6_headline)}
        </h2>
        <p style={{ ...body(16), color: C.dark, opacity: 0.7, maxWidth: 480, marginBottom: 32 }}>
          {pick(studio.deck_s6_body, DEFAULT_DECK.s6_body)}
        </p>
        <div className="deck-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'stretch' }}>
          <LinkCard href={`/giveaway/${studioSlug}`}              label="Giveaway entry"     title="What entrants see"      url={`/giveaway/${studioSlug}`} />
          <LinkCard href={`/admin/${studioSlug}/partner-view`}    label="Partner dashboard"  title="Your live entry tracker" url={`/admin/${studioSlug}/partner-view`} />
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
    <a href={href} target="_blank" rel="noreferrer"
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
          <p style={{ ...headline(14), color: C.dark, fontWeight: 900 }}>{title}</p>
          <p style={{ fontFamily: LABEL_FONT, fontSize: 10, color: C.darkDim5, marginTop: 2 }}>{url}</p>
        </div>
      </div>
    </a>
  );
}

/* ─────────── Slide 7: Entry actions (Bone, light) ─────────── */
function SlideEntry({ partners, studio }: any) {
  const baseActions: { text: string; bonus?: boolean }[] = [
    { text: 'Follow all participating businesses' },
    { text: 'Like, comment, tag a friend, and share to your story' },
    { text: 'Fill out the entry form' },
    { text: 'Post a story of you taking a class and tag us' },
  ];
  for (const p of partners) {
    baseActions.push({ text: `Visit ${p.partner_name}`, bonus: true });
  }

  return (
    <div style={{ width: '100%', background: C.bone, color: C.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
      <div style={{ maxWidth: 720, width: '100%' }}>
        <p style={{ ...label(C.orange), marginBottom: 12 }}>How people enter</p>
        <h2 style={{ ...display('clamp(40px, 6vw, 64px)'), color: C.dark, marginBottom: 32 }}>
          {pick(studio.deck_s7_headline, DEFAULT_DECK.s7_headline)}
        </h2>

        <div style={{ maxWidth: 560 }}>
          {baseActions.map((a, i) => {
            const isLast = i === baseActions.length - 1;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderBottom: isLast ? 'none' : '1px solid rgba(10,10,10,0.08)' }}>
                <span style={{ ...display(10), color: C.orange, minWidth: 18, lineHeight: 1.2 }}>{String(i + 1).padStart(2, '0')}</span>
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
    <div style={{ width: '100%', background: C.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
      <div style={{ maxWidth: 720, width: '100%' }}>
        <p style={{ ...label(C.orange), marginBottom: 12 }}>What we need from you</p>
        <h2 style={{ ...display('clamp(40px, 6vw, 64px)'), color: C.bone, marginBottom: 32 }}>
          {pick(studio.deck_s8_headline, DEFAULT_DECK.s8_headline)}
        </h2>
        <div className="deck-grid" style={{ display: 'grid', gridTemplateColumns: gridColsFor(cards.length), gap: 12, alignItems: 'stretch' }}>
          {cards.map((c, i) => (
            <div key={i} style={{ background: C.boneDim05, border: `1px solid ${C.boneDim10}`, borderRadius: 6, padding: '15px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <p style={{ ...label(C.orange, 9), marginBottom: 6 }}>{c.lbl}</p>
              <p style={{ fontFamily: FONT_STACK, fontWeight: 400, fontSize: 12, color: C.boneDim06, lineHeight: 1.45, letterSpacing: '-0.01em' }}>{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Slide 9: CTA (Bone) ─────────── */
function SlideCta({ studio, city }: { studio: any; city: string }) {
  const phoneClean = studio.deck_contact_phone ? String(studio.deck_contact_phone).replace(/[^0-9+]/g, '') : null;
  return (
    <div style={{ position: 'relative', width: '100%', background: C.bone, color: C.dark, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
      <div style={{ ...display(72), color: C.dark, opacity: 0.12, marginBottom: 12, lineHeight: 1 }}>OTF</div>
      <div style={{ maxWidth: 560, width: '100%', textAlign: 'center' }}>
        <h2 style={{ ...display('clamp(56px, 9vw, 96px)'), color: C.dark, whiteSpace: 'nowrap' }}>
          {pick(studio.deck_s9_headline, DEFAULT_DECK.s9_headline)}
        </h2>
        <p style={{ ...display('clamp(56px, 9vw, 96px)'), color: C.orange, marginBottom: 24, whiteSpace: 'nowrap' }}>
          {pick(studio.deck_s9_subline, DEFAULT_DECK.s9_subline)}
        </p>
        <p style={{ fontFamily: FONT_STACK, fontWeight: 400, fontSize: 13, color: '#555', lineHeight: 1.55, maxWidth: 360, margin: '0 auto 28px' }}>
          {pick(studio.deck_s9_body, DEFAULT_DECK.s9_body)}
        </p>

        {(studio.deck_contact_name || phoneClean || studio.deck_contact_email) && (
          <div style={{ background: C.dark, borderRadius: 8, padding: '22px 28px', maxWidth: 320, width: '100%', margin: '0 auto', textAlign: 'center' }}>
            <p style={{ ...label(C.gray, 9), marginBottom: 10 }}>
              Your contact at OrangeTheory Fitness {city}
            </p>
            {studio.deck_contact_name && (
              <p style={{ ...headline(20), color: C.bone, fontWeight: 900, marginBottom: 2 }}>{studio.deck_contact_name}</p>
            )}
            {studio.deck_contact_title && (
              <p style={{ fontFamily: LABEL_FONT, fontSize: 11, color: C.orange, letterSpacing: '0.04em', marginBottom: 14 }}>{studio.deck_contact_title}</p>
            )}
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
