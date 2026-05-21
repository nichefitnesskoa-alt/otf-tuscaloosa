import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useGiveawayStudio } from './hooks/useGiveawayStudio';
import { useGiveawayPartners } from './hooks/useGiveawayPartners';
import { getStudioCity, getStudioIgHandle, getParticipantStudioName, getAdminStudioName } from '@/lib/studioNames';
import { DEFAULT_DECK_COPY, computeBundleTotal } from './lib/partnerDeckDefaults';
import { Video, Users, Star, Share2, ExternalLink } from 'lucide-react';

export default function PartnerDeckPage() {
  const { studioSlug } = useParams<{ studioSlug: string }>();
  const [searchParams] = useSearchParams();
  const { studio } = useGiveawayStudio(studioSlug);
  const { partners } = useGiveawayPartners(studioSlug);
  const [activeSlide, setActiveSlide] = useState(0);

  const prospectName = searchParams.get('prospect')?.trim() || null;

  // Track active slide via scroll position
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
    return <div className="min-h-screen bg-surface-page text-text-primary flex items-center justify-center font-body">Loading deck…</div>;
  }

  const city = getStudioCity(studioSlug);
  const anchor = studio.deck_prize_anchor_value ?? 169;
  const bundleTotal = computeBundleTotal(anchor, partners.length, studio.deck_headline_value);
  const duration = studio.countdown_duration_days ?? 10;

  const slides = [
    { id: 'cover',     render: () => <SlideCover     studioSlug={studioSlug} city={city} prospectName={prospectName} /> },
    { id: 'concept',   render: () => <SlideConcept   intro={studio.deck_intro_copy} /> },
    { id: 'prize',     render: () => <SlidePrize     city={city} partners={partners} anchor={anchor} bundleTotal={bundleTotal} prospectName={prospectName} /> },
    { id: 'timeline',  render: () => <SlideTimeline  defaultDays={duration} /> },
    { id: 'story',     render: () => <SlideStory     prospectName={prospectName} /> },
    { id: 'tracking',  render: () => <SlideTracking  studioSlug={studioSlug} /> },
    { id: 'entry',     render: () => <SlideEntry     studioSlug={studioSlug} partners={partners} prospectName={prospectName} /> },
    { id: 'ask',       render: () => <SlideAsk       studio={studio} anchor={anchor} prospectName={prospectName} /> },
    { id: 'cta',       render: () => <SlideCta       studio={studio} city={city} /> },
  ];

  return (
    <div className="min-h-screen bg-surface-page font-body text-text-primary">
      {/* Dot nav */}
      <nav className="fixed right-3 md:right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3">
        {slides.map((s, i) => (
          <a key={s.id} href={`#slide-${i}`} aria-label={`Slide ${i + 1}`}
            onClick={() => setActiveSlide(i)}
            className={`block h-2.5 w-2.5 rounded-full transition-transform ${activeSlide === i ? 'bg-brand scale-150' : 'bg-neutral-dim hover:bg-neutral'}`} />
        ))}
      </nav>

      <div id="deck-scroll" className="h-screen overflow-y-auto snap-y snap-mandatory scroll-smooth">
        {slides.map((s, i) => (
          <section key={s.id} id={`slide-${i}`} className="snap-start min-h-screen w-full flex">
            {s.render()}
          </section>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Slide 1: Cover ---------------- */
function SlideCover({ studioSlug, city, prospectName }: { studioSlug: string; city: string; prospectName: string | null }) {
  return (
    <div className="relative w-full bg-surface-page flex flex-col">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-brand" />
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 md:px-12 py-20 max-w-5xl mx-auto">
        <p className="text-[10px] md:text-xs uppercase tracking-[0.3em] font-bold text-brand mb-6">Partnership Opportunity</p>
        <h1 className="font-display font-black text-5xl md:text-7xl leading-[0.95] text-text-primary mb-4">
          Cross-Collab
        </h1>
        <p className="font-display font-black text-4xl md:text-6xl leading-[0.95] text-brand mb-8 break-words">
          {getAdminStudioName(studioSlug)}{prospectName ? ` × ${prospectName}` : ''}
        </p>
        <p className="text-base md:text-xl text-text-secondary max-w-2xl leading-relaxed">
          A community giveaway built around {city}'s best local businesses — and the people who love them.
        </p>
      </div>
      <p className="text-center text-[9px] uppercase tracking-[0.3em] text-text-secondary pb-8">Scroll to explore</p>
    </div>
  );
}

/* ---------------- Slide 2: Concept (orange) ---------------- */
function SlideConcept({ intro }: { intro: string | null }) {
  return (
    <div className="w-full bg-brand flex items-center justify-center px-6 md:px-12 py-20" style={{ color: '#1C1C1E' }}>
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.3em] font-bold mb-6 opacity-80">The concept</p>
        <h2 className="font-display font-black text-5xl md:text-7xl leading-[0.95] mb-8">One big prize.<br/>Every brand wins.</h2>
        <p className="text-lg md:text-2xl leading-relaxed">{intro?.trim() || DEFAULT_DECK_COPY.intro}</p>
      </div>
    </div>
  );
}

/* ---------------- Slide 3: Prize ---------------- */
function SlidePrize({ city, partners, anchor, bundleTotal, prospectName }: any) {
  type Row = { tag: string; tagAccent: boolean; title: string; description: string; value?: string };
  const rows: Row[] = [
    { tag: `OrangeTheory Fitness ${city}`, tagAccent: true,
      title: 'One month free membership',
      description: 'Full access — all classes, all month. This is the anchor of the bundle.',
      value: `$${anchor}` },
  ];
  for (const p of partners) {
    if (p.prize_description) {
      rows.push({
        tag: p.partner_name, tagAccent: false,
        title: p.prize_description,
        description: `A featured experience from ${p.partner_name}.`,
      });
    } else {
      rows.push({
        tag: p.partner_name, tagAccent: false,
        title: 'Prize TBD',
        description: 'Details coming soon.',
      });
    }
  }
  if (prospectName) {
    rows.push({
      tag: prospectName, tagAccent: false,
      title: 'A gift card or signature service',
      description: `Ideally matched at $${anchor} — enough to make it feel like a real prize for your brand too.`,
      value: `~$${anchor}`,
    });
  }
  if (partners.length === 0 && !prospectName) {
    rows.push({
      tag: 'Your business', tagAccent: false,
      title: 'A gift card or signature service',
      description: `Ideally matched at $${anchor} — enough to make it feel like a real prize for your brand too.`,
      value: `~$${anchor}`,
    });
  }

  return (
    <div className="w-full bg-surface-page flex items-center justify-center px-6 md:px-12 py-20">
      <div className="max-w-4xl w-full">
        <p className="text-xs uppercase tracking-[0.3em] font-bold text-brand mb-3">The prize package</p>
        <h2 className="font-display font-black text-4xl md:text-6xl leading-[0.95] text-text-primary mb-3">One bundle, built together.</h2>
        <p className="text-sm md:text-base text-brand mb-8">Target total value: {bundleTotal} — the more partners, the bigger the prize, the more people enter.</p>

        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="rounded-xl border border-surface-border bg-surface-card p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
              <div className="md:w-56 flex items-center gap-3 flex-wrap">
                <span className={`inline-block px-3 py-1.5 rounded-md text-xs font-black uppercase tracking-wider ${r.tagAccent ? 'bg-brand text-brand-foreground' : 'bg-surface-input text-text-secondary border border-surface-border'}`}>{r.tag}</span>
                {r.value && <span className="md:hidden text-brand font-display font-black text-2xl">{r.value}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-black text-xl md:text-2xl text-text-primary">{r.title}</p>
                <p className="text-sm text-text-secondary mt-1">{r.description}</p>
              </div>
              {r.value && <p className="hidden md:block text-brand font-display font-black text-3xl">{r.value}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Slide 4: Timeline ---------------- */
function SlideTimeline({ defaultDays }: { defaultDays: number }) {
  const [days, setDays] = useState<number>(defaultDays);
  useEffect(() => setDays(defaultDays), [defaultDays]);
  return (
    <div className="w-full bg-surface-page flex items-center justify-center px-6 md:px-12 py-20">
      <div className="max-w-4xl w-full">
        <p className="text-xs uppercase tracking-[0.3em] font-bold text-brand mb-3">Campaign timeline</p>
        <h2 className="font-display font-black text-4xl md:text-6xl leading-[0.95] text-text-primary mb-6">Built around your month.</h2>

        <div className="inline-flex rounded-lg border border-surface-border overflow-hidden mb-8">
          {[7, 10, 14].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`min-h-[44px] px-5 font-bold text-sm cursor-pointer ${days === d ? 'bg-surface-card text-brand border-r border-brand last:border-r-0' : 'bg-transparent text-text-secondary hover:bg-surface-card'}`}>
              {d} days
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <Phase n={1} tag="Early in the month" title="Build the hype"
            body="Tease the bundle, the partners, and what's coming. Drop sneak previews. Build anticipation without giving away the entry yet." />
          <Phase n={2} tag={`Last ${days} days of the month`} title="Giveaway goes live"
            body={`We open entries and push hard across every platform for ${days} straight days. Stories, posts, in-studio mentions, partner cross-shares.`} />
          <Phase n={3} tag="End of the month" title="Winner announced + documented"
            body="Live draw, winner reveal video, recap content shared with every partner so they can amplify the win on their own channels." />
        </div>
      </div>
    </div>
  );
}
function Phase({ n, tag, title, body }: { n: number; tag: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5 md:p-6 flex gap-4">
      <div className="font-display font-black text-4xl md:text-5xl text-brand leading-none">{n}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs uppercase tracking-wider font-bold text-text-secondary mb-1">{tag}</p>
        <p className="font-display font-black text-xl md:text-2xl text-text-primary">{title}</p>
        <p className="text-sm text-text-secondary mt-1.5">{body}</p>
      </div>
    </div>
  );
}

/* ---------------- Slide 5: Story ---------------- */
function SlideStory({ prospectName }: { prospectName: string | null }) {
  const items = [
    { Icon: Video, title: 'We come to you first', body: 'Short on-site video at your business to introduce you to our audience before the giveaway goes live.' },
    { Icon: Users, title: prospectName ? `VIP class for the ${prospectName} team` : 'VIP class for your whole team', body: 'Bring your crew in for a private OTF class. We capture the experience together so you have content to use too.' },
    { Icon: Star,  title: "The winner's journey", body: 'We document the winner enjoying every partner prize — proof that real people show up for what you offered.' },
    { Icon: Share2, title: 'Shared across every platform', body: 'Every piece of content gets cross-shared between every partner. You get reach you couldn\'t buy.' },
  ];
  return (
    <div className="w-full bg-surface-page flex items-center justify-center px-6 md:px-12 py-20">
      <div className="max-w-5xl w-full">
        <p className="text-xs uppercase tracking-[0.3em] font-bold text-brand mb-3">How we build it together</p>
        <h2 className="font-display font-black text-4xl md:text-6xl leading-[0.95] text-text-primary mb-10">Content-first from day one.</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((it, i) => (
            <div key={i} className="rounded-xl border border-surface-border bg-surface-card p-6">
              <div className="h-10 w-10 rounded-lg bg-brand-dim text-brand flex items-center justify-center mb-3">
                <it.Icon className="h-5 w-5" />
              </div>
              <p className="font-display font-black text-xl text-text-primary">{it.title}</p>
              <p className="text-sm text-text-secondary mt-2">{it.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Slide 6: Tracking (orange) ---------------- */
function SlideTracking({ studioSlug }: { studioSlug: string }) {
  return (
    <div className="w-full bg-brand flex items-center justify-center px-6 md:px-12 py-20" style={{ color: '#1C1C1E' }}>
      <div className="max-w-4xl w-full">
        <p className="text-xs uppercase tracking-[0.3em] font-bold mb-3 opacity-80">The tracking system</p>
        <h2 className="font-display font-black text-4xl md:text-6xl leading-[0.95] mb-6">Built in. Live from day one.</h2>
        <p className="text-lg md:text-xl mb-8 leading-relaxed">
          Entries are tracked in real time through our app — you can see exactly how many people entered because of your business, any time.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LinkCard href={`/giveaway/${studioSlug}`} eyebrow="Giveaway entry" title="What entrants see" />
          <LinkCard href={`/admin/${studioSlug}`} eyebrow="Partner dashboard" title="Live entry tracker" />
        </div>
        <p className="text-sm mt-6 opacity-80">The tracker is customizable per studio, per partner, and per campaign duration.</p>
      </div>
    </div>
  );
}
function LinkCard({ href, eyebrow, title }: { href: string; eyebrow: string; title: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer"
      className="block rounded-xl p-5 cursor-pointer transition-transform hover:-translate-y-0.5"
      style={{ background: '#1C1C1E', color: '#F5F2EE' }}>
      <p className="text-[10px] uppercase tracking-[0.25em] font-bold" style={{ color: '#E8540A' }}>{eyebrow}</p>
      <div className="flex items-center justify-between mt-2 gap-3">
        <p className="font-display font-black text-xl">{title}</p>
        <ExternalLink className="h-4 w-4 opacity-60" />
      </div>
    </a>
  );
}

/* ---------------- Slide 7: Entry actions ---------------- */
function SlideEntry({ studioSlug, partners, prospectName }: any) {
  const handles: string[] = [getStudioIgHandle(studioSlug)];
  for (const p of partners) {
    if (p.partner_ig_handle) handles.push(p.partner_ig_handle.startsWith('@') ? p.partner_ig_handle : `@${p.partner_ig_handle}`);
  }
  if (prospectName) handles.push(`@${prospectName} on Instagram`);

  const visitItems: { label: string; bonus: boolean }[] = [];
  for (const p of partners) visitItems.push({ label: `Visit ${p.partner_name}`, bonus: true });
  if (prospectName) visitItems.push({ label: `Visit ${prospectName}`, bonus: true });
  if (partners.length === 0 && !prospectName) {
    visitItems.push({ label: 'Visit a partner business or try a free OTF class', bonus: false });
  }

  return (
    <div className="w-full bg-surface-card flex items-center justify-center px-6 md:px-12 py-20">
      <div className="max-w-4xl w-full">
        <p className="text-xs uppercase tracking-[0.3em] font-bold text-brand mb-3">How people enter</p>
        <h2 className="font-display font-black text-4xl md:text-6xl leading-[0.95] text-text-primary mb-10">Easy to enter.<br/>Hard to ignore.</h2>

        <ol className="space-y-4">
          <ActionRow n={1} title="Follow all participating businesses">
            <div className="flex flex-wrap gap-2 mt-2">
              {handles.map((h, i) => (
                <span key={i} className="inline-block px-2.5 py-1 rounded text-xs bg-surface-input border border-surface-border text-text-secondary">{h}</span>
              ))}
            </div>
          </ActionRow>
          <ActionRow n={2} title="Like, comment, and tag friends on posts" />
          <ActionRow n={3} title="Share the giveaway to their story" />
          <ActionRow n={4} title="Post a story of you taking a class and tag us" />
          {visitItems.map((v, i) => (
            <ActionRow key={`v-${i}`} n={5 + i} title={v.label} bonus={v.bonus} />
          ))}
        </ol>
      </div>
    </div>
  );
}
function ActionRow({ n, title, bonus, children }: { n: number; title: string; bonus?: boolean; children?: React.ReactNode }) {
  return (
    <li className="rounded-xl border border-surface-border bg-surface-page p-5 flex gap-4">
      <span className="flex-shrink-0 h-9 w-9 rounded-full bg-brand text-brand-foreground font-display font-black text-base flex items-center justify-center">{n}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-display font-black text-lg md:text-xl text-text-primary">{title}</p>
          {bonus && <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-brand-dim text-brand">Bonus entries</span>}
        </div>
        {children}
      </div>
    </li>
  );
}

/* ---------------- Slide 8: What we need ---------------- */
function SlideAsk({ studio, anchor, prospectName }: any) {
  const prizeBody = studio.deck_what_we_need_prize?.trim()
    || (prospectName
      ? `A ${prospectName} gift card or signature service at roughly $${anchor} — matched value to the OTF membership.`
      : DEFAULT_DECK_COPY.askPrize(anchor));
  const classBody = studio.deck_what_we_need_class?.trim()
    || (prospectName
      ? `Bring your ${prospectName} staff for an OTF class so we can capture and share the experience together.`
      : DEFAULT_DECK_COPY.askClass);
  const promoBody = studio.deck_what_we_need_promotion?.trim() || DEFAULT_DECK_COPY.askPromotion;
  const timeBody = studio.deck_what_we_need_time?.trim() || DEFAULT_DECK_COPY.askTime;

  return (
    <div className="w-full bg-surface-page flex items-center justify-center px-6 md:px-12 py-20">
      <div className="max-w-5xl w-full">
        <p className="text-xs uppercase tracking-[0.3em] font-bold text-brand mb-3">What we need from you</p>
        <h2 className="font-display font-black text-4xl md:text-6xl leading-[0.95] text-text-primary mb-10">Simple ask. Real return.</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AskCard label="Prize" body={prizeBody} />
          <AskCard label="Promotion" body={promoBody} />
          <AskCard label="VIP Class" body={classBody} />
          <AskCard label="15 Minutes" body={timeBody} />
        </div>
      </div>
    </div>
  );
}
function AskCard({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-6">
      <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-brand mb-3">{label}</p>
      <p className="text-base text-text-primary leading-relaxed">{body}</p>
    </div>
  );
}

/* ---------------- Slide 9: CTA ---------------- */
function SlideCta({ studio, city }: { studio: any; city: string }) {
  const hasContact = studio.deck_contact_name || studio.deck_contact_phone || studio.deck_contact_email;
  return (
    <div className="relative w-full bg-surface-card flex flex-col items-center justify-center px-6 md:px-12 py-20">
      <div className="max-w-3xl w-full text-center">
        <h2 className="font-display font-black text-5xl md:text-7xl leading-[0.95] text-text-primary mb-2">Want in?</h2>
        <p className="font-display font-black text-5xl md:text-7xl leading-[0.95] text-brand mb-8">Let's talk.</p>
        <p className="text-base md:text-lg text-text-secondary max-w-xl mx-auto mb-10">
          This works because every partner is genuinely invested. If it sounds like a fit, reach out and we'll handle the rest.
        </p>

        {hasContact && (
          <div className="rounded-2xl border border-surface-border bg-surface-page p-6 md:p-8 text-left">
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-text-secondary mb-3">
              Your contact at {getParticipantStudioName(city.toLowerCase())}
            </p>
            {studio.deck_contact_name && (
              <p className="font-display font-black text-3xl md:text-4xl text-text-primary leading-tight">{studio.deck_contact_name}</p>
            )}
            {studio.deck_contact_title && (
              <p className="text-sm text-brand font-bold mt-1">{studio.deck_contact_title}</p>
            )}
            <div className="mt-4 space-y-1.5 text-sm">
              {studio.deck_contact_phone && (
                <a href={`tel:${studio.deck_contact_phone.replace(/[^0-9+]/g, '')}`} className="block text-text-primary hover:text-brand">{studio.deck_contact_phone}</a>
              )}
              {studio.deck_contact_email && (
                <a href={`mailto:${studio.deck_contact_email}`} className="block text-text-primary hover:text-brand break-all">{studio.deck_contact_email}</a>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-brand" />
    </div>
  );
}
