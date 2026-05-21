import { useMemo, useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useGiveawayStudio, type GiveawayStudio } from './hooks/useGiveawayStudio';
import { useGiveawayPartners } from './hooks/useGiveawayPartners';
import { supabase } from '@/integrations/supabase/client';
import { Copy, Check, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { DEFAULT_DECK, slide2AutoCopy } from './lib/partnerDeckDefaults';
import { WINNER_STRUCTURE_OPTIONS, type WinnerStructure } from './lib/winnerStructure';
import { getGiveawayTitle, type TitleFormat } from './lib/giveawayTitle';

type FieldKey = keyof GiveawayStudio;

export default function PartnerDeckAdminPage() {
  const { studioSlug } = useParams<{ studioSlug: string }>();
  const { studio, refresh } = useGiveawayStudio(studioSlug);
  const { partners } = useGiveawayPartners(studioSlug);
  const [copied, setCopied] = useState(false);
  const [iframeBust, setIframeBust] = useState<number>(() => Date.now());

  const publicBaseUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/partner-deck/${studioSlug}`;
  }, [studioSlug]);

  const iframeSrc = `/partner-deck/${studioSlug}?t=${iframeBust}`;

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(publicBaseUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  const saveField = async (field: FieldKey, value: string | number | null) => {
    if (!studio) return;
    let payload: any = value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      payload = trimmed.length ? trimmed : null;
    }
    await supabase.from('giveaway_studios' as any).update({ [field]: payload }).eq('id', studio.id);
    await refresh();
    setIframeBust(Date.now());
  };

  if (!studio) {
    return <div className="min-h-screen bg-surface-page text-text-primary flex items-center justify-center font-body">Loading…</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-surface-page text-text-primary font-body overflow-hidden">
      <div className="h-14 flex-shrink-0 border-b border-surface-border bg-surface-page flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-black">Partner Deck</h1>
          <span className="text-[10px] uppercase tracking-wider bg-surface-input border border-surface-border text-text-secondary px-2 py-0.5 rounded">{studioSlug}</span>
        </div>
        <button onClick={copyLink}
          className="min-h-[40px] inline-flex items-center justify-center gap-2 px-4 rounded-lg bg-brand hover:bg-brand-hover text-brand-foreground font-bold text-sm cursor-pointer">
          {copied ? <><Check className="h-4 w-4" /> Copied!</> : <><Copy className="h-4 w-4" /> Copy Deck Link</>}
        </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <aside className="md:w-[420px] md:min-w-[360px] md:max-w-[420px] flex-shrink-0 border-b md:border-b-0 md:border-r border-surface-border bg-surface-card overflow-y-auto p-6">
          <Editor studio={studio} partners={partners} onSave={saveField} onRefresh={refresh} setBust={setIframeBust} />
        </aside>
        <main className="flex-1 flex flex-col min-h-[60vh] md:min-h-0" style={{ background: '#111' }}>
          <div className="h-9 flex-shrink-0 flex items-center justify-between px-4 border-b border-surface-border" style={{ background: 'hsl(var(--surface-border) / 0.5)' }}>
            <span className="text-[11px] text-text-secondary">Live preview</span>
            <a href={publicBaseUrl} target="_blank" rel="noreferrer" className="text-[11px] text-brand inline-flex items-center gap-1 hover:underline">
              Open in new tab <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <iframe key={iframeSrc} src={iframeSrc} title="Partner deck preview" className="flex-1 w-full border-0" />
        </main>
      </div>
    </div>
  );
}

/* ─────────── Editor ─────────── */
function Editor({
  studio, partners, onSave, onRefresh, setBust,
}: {
  studio: GiveawayStudio;
  partners: { id: string; partner_name: string; prize_description: string | null }[];
  onSave: (field: FieldKey, value: string | number | null) => Promise<void>;
  onRefresh: () => Promise<void>;
  setBust: (n: number) => void;
}) {
  const liveAt = studio.goes_live_at ? new Date(studio.goes_live_at) : null;
  const endAt = liveAt ? new Date(liveAt.getTime() + studio.countdown_duration_days * 86400 * 1000) : null;

  const goLive = async () => {
    if (!confirm('Take the giveaway live now? This starts the countdown.')) return;
    await supabase.from('giveaway_studios' as any).update({ goes_live_at: new Date().toISOString() }).eq('id', studio.id);
    await onRefresh(); setBust(Date.now());
  };
  const endLive = async () => {
    if (!confirm('End the giveaway? This clears the live date.')) return;
    await supabase.from('giveaway_studios' as any).update({ goes_live_at: null }).eq('id', studio.id);
    await onRefresh(); setBust(Date.now());
  };

  const titleFormat: TitleFormat = (studio.title_format as TitleFormat) || 'auto_combined';
  const winnerStructure: WinnerStructure = (studio.winner_structure as WinnerStructure) || 'single';

  return (
    <div className="space-y-8">
      {/* GROUP A — GIVEAWAY SETTINGS */}
      <GroupHeader title="Giveaway Settings" subtext="These match your Settings page. Changes here update there too." />

      <Section label="Giveaway Title">
        <div className="space-y-2">
          {([
            { value: 'auto_combined' as TitleFormat,   title: 'Auto: Studio + Partners' },
            { value: 'auto_studio_only' as TitleFormat, title: 'Auto: Brand Only' },
            { value: 'custom' as TitleFormat,           title: 'Custom Title' },
          ]).map(opt => {
            const selected = titleFormat === opt.value;
            const preview = opt.value === 'custom'
              ? (studio.custom_title || 'Shown exactly as typed on the entry form.')
              : getGiveawayTitle(studio.studio_slug, opt.value === 'auto_combined' ? partners : [], opt.value, '');
            return (
              <button key={opt.value} type="button"
                onClick={() => onSave('title_format' as FieldKey, opt.value)}
                className={`w-full text-left rounded-lg border-2 px-3 py-3 min-h-[44px] flex items-start gap-3 cursor-pointer transition ${selected ? 'border-brand bg-brand/10' : 'border-surface-border bg-surface-input hover:border-brand/50'}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-text-primary">{opt.title}</p>
                  <p className="text-xs mt-1 text-text-secondary break-words">{preview}</p>
                </div>
                <div className={`flex-shrink-0 mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center ${selected ? 'border-brand bg-brand' : 'border-surface-border'}`}>
                  {selected && <Check className="h-2.5 w-2.5 text-brand-foreground" />}
                </div>
              </button>
            );
          })}
        </div>
        {titleFormat === 'custom' && (
          <SavedInput field={'custom_title' as FieldKey} label="Custom giveaway title" value={studio.custom_title}
            placeholder="e.g. Tuscaloosa Summer Giveaway" onSave={onSave} />
        )}
      </Section>

      <Section label="Winner Draw Rules">
        <div className="space-y-2">
          {WINNER_STRUCTURE_OPTIONS.map(opt => {
            const selected = winnerStructure === opt.value;
            return (
              <button key={opt.value} type="button"
                onClick={() => onSave('winner_structure' as FieldKey, opt.value)}
                className={`w-full text-left rounded-lg border-2 px-3 py-3 min-h-[44px] flex items-start gap-3 cursor-pointer transition ${selected ? 'border-brand bg-brand/10' : 'border-surface-border bg-surface-input hover:border-brand/50'}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-text-primary">{opt.title}</p>
                  <p className="text-xs mt-1 text-text-secondary">{opt.subtitle}</p>
                </div>
                <div className={`flex-shrink-0 mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center ${selected ? 'border-brand bg-brand' : 'border-surface-border'}`}>
                  {selected && <Check className="h-2.5 w-2.5 text-brand-foreground" />}
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      <Section label="Giveaway Duration">
        <div className="inline-flex rounded-lg border border-surface-border overflow-hidden">
          {[7, 10, 14].map(d => (
            <button key={d} onClick={() => onSave('countdown_duration_days' as FieldKey, d)}
              className={`min-h-[44px] px-5 font-bold text-sm cursor-pointer ${studio.countdown_duration_days === d ? 'bg-brand text-brand-foreground' : 'bg-surface-card border-surface-border text-text-secondary hover:bg-surface-input'}`}>
              {d} days
            </button>
          ))}
        </div>
      </Section>

      <Section label="Live Status">
        {!liveAt && (
          <>
            <p className="text-xs text-text-secondary mb-3">Not live yet. Participants see the Coming Soon screen.</p>
            <button onClick={goLive} className="min-h-[44px] px-5 rounded-lg bg-brand hover:bg-brand-hover text-brand-foreground font-black text-sm cursor-pointer">
              Go Live Now
            </button>
          </>
        )}
        {liveAt && endAt && (
          <>
            <p className="text-xs text-text-secondary mb-3">Live — ends <span className="text-brand font-bold">{endAt.toLocaleString()}</span></p>
            <button onClick={endLive} className="min-h-[44px] px-5 rounded-lg border border-destructive/50 text-destructive hover:bg-destructive/10 font-bold text-sm cursor-pointer">
              End Giveaway
            </button>
          </>
        )}
      </Section>

      <Section label="Partner List">
        {partners.length === 0
          ? <p className="text-xs italic text-text-secondary">No partners yet.</p>
          : (
            <ul className="space-y-1.5">
              {partners.map(p => (
                <li key={p.id} className="text-xs text-text-primary">
                  <span className="font-bold">{p.partner_name}</span>
                  {p.prize_description && <span className="text-text-secondary"> — {p.prize_description}</span>}
                </li>
              ))}
            </ul>
          )
        }
        <a href={`/admin/${studio.studio_slug}`} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 mt-3 text-xs text-brand hover:underline">
          Manage partners in Settings <ExternalLink className="h-3 w-3" />
        </a>
      </Section>

      {/* GROUP B — DECK COPY */}
      <div className="pt-4 border-t border-surface-border">
        <GroupHeader title="Deck Copy" subtext="Edit what appears on each slide of the partner deck." />
      </div>

      <Section label="Slide 1 — Cover">
        <p className="text-xs italic text-text-secondary">Title auto-builds from your partner list above.</p>
        <SizeRefine title="Title line 1 size" field={'deck_s1_title1_size' as FieldKey} value={studio.deck_s1_title1_size} min={48} max={96} onSave={onSave} />
        <SizeRefine title="Title line 2 size" field={'deck_s1_title2_size' as FieldKey} value={studio.deck_s1_title2_size} min={28} max={72} onSave={onSave} />
      </Section>

      <Section label="Slide 2 — The Concept">
        <SavedInput field={'deck_s2_headline' as FieldKey} label="Headline" value={studio.deck_s2_headline} placeholder={DEFAULT_DECK.s2_headline} onSave={onSave} />
        <SavedTextarea field={'deck_s2_body' as FieldKey} label="Body copy" value={studio.deck_s2_body ?? studio.deck_intro_copy} rows={3}
          placeholder={slide2AutoCopy(studio.winner_structure as WinnerStructure)} onSave={onSave} />
        <p className="text-[10px] italic text-text-secondary -mt-1">Leave blank to auto-fill based on Winner Draw Rules.</p>
        <SizeRefine title="Headline size" field={'deck_s2_headline_size' as FieldKey} value={studio.deck_s2_headline_size} min={32} max={88} onSave={onSave} />
      </Section>

      <Section label="Slide 3 — Prize Package">
        <p className="text-xs italic text-text-secondary">Prize rows pull from your partner list.</p>
        <SavedInput field={'deck_s3_headline' as FieldKey} label="Headline" value={studio.deck_s3_headline} placeholder={DEFAULT_DECK.s3_headline} onSave={onSave} />
        <SavedInput field={'deck_s3_value_note' as FieldKey} label="Value note" value={studio.deck_s3_value_note} placeholder="e.g. Target total value: $500+" onSave={onSave} />
        <SizeRefine title="Headline size" field={'deck_s3_headline_size' as FieldKey} value={studio.deck_s3_headline_size} min={22} max={64} onSave={onSave} />
      </Section>

      <Section label="Slide 4 — Timeline">
        <SavedInput field={'deck_s4_headline' as FieldKey} label="Headline" value={studio.deck_s4_headline} placeholder={DEFAULT_DECK.s4_headline} onSave={onSave} />
        <SavedInput field={'deck_s4_subtext' as FieldKey} label="Subtext" value={studio.deck_s4_subtext} placeholder={DEFAULT_DECK.s4_subtext} onSave={onSave} />
        <SavedInput    field={'deck_s4_phase1_title' as FieldKey} label="Phase 1 title" value={studio.deck_s4_phase1_title} placeholder={DEFAULT_DECK.s4_phase1_title} onSave={onSave} />
        <SavedTextarea field={'deck_s4_phase1_body' as FieldKey}  label="Phase 1 body"  value={studio.deck_s4_phase1_body}  rows={2} placeholder={DEFAULT_DECK.s4_phase1_body} onSave={onSave} />
        <SavedInput    field={'deck_s4_phase2_title' as FieldKey} label="Phase 2 title" value={studio.deck_s4_phase2_title} placeholder={DEFAULT_DECK.s4_phase2_title} onSave={onSave} />
        <SavedTextarea field={'deck_s4_phase2_body' as FieldKey}  label="Phase 2 body"  value={studio.deck_s4_phase2_body}  rows={2} placeholder={DEFAULT_DECK.s4_phase2_body} onSave={onSave} />
        <SavedInput    field={'deck_s4_phase3_title' as FieldKey} label="Phase 3 title" value={studio.deck_s4_phase3_title} placeholder={DEFAULT_DECK.s4_phase3_title} onSave={onSave} />
        <SavedTextarea field={'deck_s4_phase3_body' as FieldKey}  label="Phase 3 body"  value={studio.deck_s4_phase3_body}  rows={2} placeholder={DEFAULT_DECK.s4_phase3_body} onSave={onSave} />
        <SizeRefine title="Headline size"     field={'deck_s4_headline_size' as FieldKey}     value={studio.deck_s4_headline_size}     min={22} max={64} onSave={onSave} />
        <SizeRefine title="Phase title size"  field={'deck_s4_phase_title_size' as FieldKey}  value={studio.deck_s4_phase_title_size}  min={16} max={32} onSave={onSave} />
      </Section>

      <Section label="Slide 5 — How We Build It">
        <SavedInput    field={'deck_s5_headline' as FieldKey} label="Headline" value={studio.deck_s5_headline} placeholder={DEFAULT_DECK.s5_headline} onSave={onSave} />
        {[1,2,3,4].map(n => (
          <div key={n} className="space-y-2">
            <SavedInput    field={`deck_s5_c${n}_title` as FieldKey} label={`Card ${n} title`} value={(studio as any)[`deck_s5_c${n}_title`]} placeholder={(DEFAULT_DECK as any)[`s5_c${n}_title`]} onSave={onSave} />
            <SavedTextarea field={`deck_s5_c${n}_body` as FieldKey}  label={`Card ${n} body`}  value={(studio as any)[`deck_s5_c${n}_body`]} rows={2} placeholder={(DEFAULT_DECK as any)[`s5_c${n}_body`]} onSave={onSave} />
          </div>
        ))}
        <SizeRefine title="Headline size"   field={'deck_s5_headline_size' as FieldKey}   value={studio.deck_s5_headline_size}   min={22} max={64} onSave={onSave} />
        <SizeRefine title="Card title size" field={'deck_s5_card_title_size' as FieldKey} value={studio.deck_s5_card_title_size} min={16} max={28} onSave={onSave} />
      </Section>

      <Section label="Slide 6 — Tracking System">
        <SavedInput    field={'deck_s6_headline' as FieldKey} label="Headline" value={studio.deck_s6_headline} placeholder={DEFAULT_DECK.s6_headline} onSave={onSave} />
        <SavedTextarea field={'deck_s6_body' as FieldKey}     label="Body copy" value={studio.deck_s6_body}     rows={2} placeholder={DEFAULT_DECK.s6_body} onSave={onSave} />
        <SavedInput    field={'deck_s6_note' as FieldKey}     label="Note below cards" value={studio.deck_s6_note} placeholder={DEFAULT_DECK.s6_note} onSave={onSave} />
        <SizeRefine title="Headline size" field={'deck_s6_headline_size' as FieldKey} value={studio.deck_s6_headline_size} min={22} max={60} onSave={onSave} />
      </Section>

      <Section label="Slide 7 — How People Enter">
        <SavedInput field={'deck_s7_headline' as FieldKey} label="Headline" value={studio.deck_s7_headline} placeholder={DEFAULT_DECK.s7_headline} onSave={onSave} />
        <p className="text-xs italic text-text-secondary">Entry actions auto-build from your partner list.</p>
        <SizeRefine title="Headline size" field={'deck_s7_headline_size' as FieldKey} value={studio.deck_s7_headline_size} min={22} max={64} onSave={onSave} />
      </Section>

      <Section label="Slide 8 — What We Need">
        <SavedInput    field={'deck_s8_headline' as FieldKey} label="Headline" value={studio.deck_s8_headline} placeholder={DEFAULT_DECK.s8_headline} onSave={onSave} />
        <SavedTextarea field={'deck_s8_prize' as FieldKey}    label="Prize card body"     value={studio.deck_s8_prize ?? studio.deck_what_we_need_prize}    rows={2} onSave={onSave} />
        <SavedTextarea field={'deck_s8_promo' as FieldKey}    label="Promotion card body" value={studio.deck_s8_promo ?? studio.deck_what_we_need_promotion} rows={2} onSave={onSave} />
        <SavedTextarea field={'deck_s8_class' as FieldKey}    label="VIP class card body" value={studio.deck_s8_class ?? studio.deck_what_we_need_class}    rows={2} onSave={onSave} />
        <SavedTextarea field={'deck_s8_time' as FieldKey}     label="Time card body"      value={studio.deck_s8_time  ?? studio.deck_what_we_need_time}     rows={2} onSave={onSave} />
        <SizeRefine title="Headline size" field={'deck_s8_headline_size' as FieldKey} value={studio.deck_s8_headline_size} min={22} max={64} onSave={onSave} />
      </Section>

      <Section label="Slide 9 — CTA">
        <SavedInput    field={'deck_s9_headline' as FieldKey} label="Headline"        value={studio.deck_s9_headline} placeholder={DEFAULT_DECK.s9_headline} onSave={onSave} />
        <SavedInput    field={'deck_s9_subline' as FieldKey}  label="Subline (orange)" value={studio.deck_s9_subline}  placeholder={DEFAULT_DECK.s9_subline} onSave={onSave} />
        <SavedTextarea field={'deck_s9_body' as FieldKey}     label="Body copy"        value={studio.deck_s9_body} rows={2} placeholder={DEFAULT_DECK.s9_body} onSave={onSave} />
        <SavedInput    field={'deck_contact_name' as FieldKey}  label="Contact name"  value={studio.deck_contact_name}  onSave={onSave} />
        <SavedInput    field={'deck_contact_title' as FieldKey} label="Contact title" value={studio.deck_contact_title} onSave={onSave} />
        <SavedInput    field={'deck_contact_phone' as FieldKey} label="Contact phone" value={studio.deck_contact_phone} onSave={onSave} />
        <SavedInput    field={'deck_contact_email' as FieldKey} label="Contact email" value={studio.deck_contact_email} onSave={onSave} />
        <SizeRefine title="Headline size" field={'deck_s9_headline_size' as FieldKey} value={studio.deck_s9_headline_size} min={32} max={96} onSave={onSave} />
        <SizeRefine title="Subline size"  field={'deck_s9_subline_size' as FieldKey}  value={studio.deck_s9_subline_size}  min={32} max={96} onSave={onSave} />
      </Section>
    </div>
  );
}

function GroupHeader({ title, subtext }: { title: string; subtext: string }) {
  return (
    <div>
      <h2 className="text-xs font-black uppercase tracking-[0.2em] text-brand">{title}</h2>
      <p className="text-xs text-text-secondary mt-1">{subtext}</p>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-text-primary border-b border-surface-border pb-1">{label}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function SavedInput({ field, label, value, placeholder, onSave }: {
  field: FieldKey; label: string; value: string | null; placeholder?: string;
  onSave: (field: FieldKey, value: string | number | null) => Promise<void>;
}) {
  const [local, setLocal] = useState(value ?? '');
  const [saved, setSaved] = useState(false);
  const initial = useRef(value ?? '');
  useEffect(() => { setLocal(value ?? ''); initial.current = value ?? ''; }, [value]);

  const handleBlur = async () => {
    if (local === initial.current) return;
    await onSave(field, local);
    initial.current = local;
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  return (
    <label className="block">
      <span className="flex items-center justify-between mb-1">
        <span className="text-[11px] uppercase tracking-wider font-bold text-text-secondary">{label}</span>
        {saved && <span className="text-[11px] text-success">Saved</span>}
      </span>
      <input value={local} onChange={e => setLocal(e.target.value)} onBlur={handleBlur} placeholder={placeholder}
        className="w-full min-h-[44px] rounded-lg bg-surface-input border border-surface-border focus:border-brand focus:outline-none px-3 text-sm text-text-primary" />
    </label>
  );
}

function SavedTextarea({ field, label, value, rows, placeholder, onSave }: {
  field: FieldKey; label: string; value: string | null; rows?: number; placeholder?: string;
  onSave: (field: FieldKey, value: string | number | null) => Promise<void>;
}) {
  const [local, setLocal] = useState(value ?? '');
  const [saved, setSaved] = useState(false);
  const initial = useRef(value ?? '');
  useEffect(() => { setLocal(value ?? ''); initial.current = value ?? ''; }, [value]);

  const handleBlur = async () => {
    if (local === initial.current) return;
    await onSave(field, local);
    initial.current = local;
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  return (
    <label className="block">
      <span className="flex items-center justify-between mb-1">
        <span className="text-[11px] uppercase tracking-wider font-bold text-text-secondary">{label}</span>
        {saved && <span className="text-[11px] text-success">Saved</span>}
      </span>
      <textarea value={local} onChange={e => setLocal(e.target.value)} onBlur={handleBlur} rows={rows ?? 2} placeholder={placeholder}
        className="w-full rounded-lg bg-surface-input border border-surface-border focus:border-brand focus:outline-none px-3 py-2 text-sm text-text-primary resize-y" />
    </label>
  );
}

function SizeRefine({ title, field, value, min, max, onSave }: {
  title: string; field: FieldKey; value: number | null; min: number; max: number;
  onSave: (field: FieldKey, value: string | number | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<number>(value ?? min);
  const isAuto = value == null;
  useEffect(() => { if (value != null) setLocal(value); }, [value]);

  const commit = async (n: number) => {
    const clamped = Math.max(min, Math.min(max, Math.round(n)));
    setLocal(clamped);
    await onSave(field, clamped);
  };
  const setAuto = async () => { await onSave(field, null); };

  return (
    <div className="rounded border border-surface-border bg-surface-input/40">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-left cursor-pointer">
        <span className="text-[10px] uppercase tracking-wider font-bold text-text-secondary">{title}</span>
        <span className="flex items-center gap-2">
          <span className={`text-[10px] font-bold ${isAuto ? 'text-text-secondary' : 'text-brand'}`}>{isAuto ? 'Auto' : `${value}px`}</span>
          {open ? <ChevronDown className="h-3 w-3 text-text-secondary" /> : <ChevronRight className="h-3 w-3 text-text-secondary" />}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          <input type="range" min={min} max={max} step={1} value={local}
            onChange={e => setLocal(parseInt(e.target.value, 10))}
            onMouseUp={() => commit(local)} onTouchEnd={() => commit(local)}
            className="w-full accent-brand cursor-pointer" />
          <div className="flex items-center gap-2">
            <input type="number" min={min} max={max} value={local}
              onChange={e => setLocal(parseInt(e.target.value || '0', 10))}
              onBlur={() => commit(local)}
              className="w-20 min-h-[36px] rounded bg-surface-input border border-surface-border focus:border-brand focus:outline-none px-2 text-xs text-text-primary" />
            <span className="text-[10px] text-text-secondary">px</span>
            <button type="button" onClick={setAuto}
              className={`ml-auto min-h-[32px] px-3 rounded border text-[11px] font-bold cursor-pointer ${isAuto ? 'border-brand text-brand bg-brand/10' : 'border-surface-border text-text-secondary hover:border-brand hover:text-brand'}`}>
              Auto
            </button>
          </div>
          <p className="text-[10px] text-text-secondary">Range: {min}–{max}px. Auto fills width on one line.</p>
        </div>
      )}
    </div>
  );
}
