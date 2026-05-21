import { useMemo, useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useGiveawayStudio, type GiveawayStudio } from './hooks/useGiveawayStudio';
import { supabase } from '@/integrations/supabase/client';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { DEFAULT_DECK } from './lib/partnerDeckDefaults';

type FieldKey = keyof GiveawayStudio;

export default function PartnerDeckAdminPage() {
  const { studioSlug } = useParams<{ studioSlug: string }>();
  const { studio, refresh } = useGiveawayStudio(studioSlug);
  const [copied, setCopied] = useState(false);
  const [iframeBust, setIframeBust] = useState<number>(() => Date.now());

  const publicBaseUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/partner-deck/${studioSlug}`;
  }, [studioSlug]);

  const iframeSrc = `/partner-deck/${studioSlug}?t=${iframeBust}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicBaseUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const saveField = async (field: FieldKey, value: string | null) => {
    if (!studio) return;
    const trimmed = (value ?? '').trim();
    await supabase
      .from('giveaway_studios' as any)
      .update({ [field]: trimmed.length ? trimmed : null })
      .eq('id', studio.id);
    await refresh();
    setIframeBust(Date.now());
  };

  if (!studio) {
    return <div className="min-h-screen bg-surface-page text-text-primary flex items-center justify-center font-body">Loading…</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-surface-page text-text-primary font-body overflow-hidden">
      {/* Top bar */}
      <div className="h-14 flex-shrink-0 border-b border-surface-border bg-surface-page flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-black">Partner Deck</h1>
          <span className="text-[10px] uppercase tracking-wider bg-surface-input border border-surface-border text-text-secondary px-2 py-0.5 rounded">{studioSlug}</span>
        </div>
        <button
          onClick={copyLink}
          className="min-h-[40px] inline-flex items-center justify-center gap-2 px-4 rounded-lg bg-brand hover:bg-brand-hover text-brand-foreground font-bold text-sm cursor-pointer"
        >
          {copied ? <><Check className="h-4 w-4" /> Copied!</> : <><Copy className="h-4 w-4" /> Copy Deck Link</>}
        </button>
      </div>

      {/* Split */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Editor */}
        <aside className="md:w-[380px] md:min-w-[320px] md:max-w-[380px] flex-shrink-0 border-b md:border-b-0 md:border-r border-surface-border bg-surface-card overflow-y-auto p-6">
          <Editor studio={studio} onSave={saveField} />
        </aside>

        {/* Preview */}
        <main className="flex-1 flex flex-col min-h-[60vh] md:min-h-0" style={{ background: '#111' }}>
          <div className="h-9 flex-shrink-0 flex items-center justify-between px-4 border-b border-surface-border" style={{ background: 'hsl(var(--surface-border) / 0.5)' }}>
            <span className="text-[11px] text-text-secondary">Live preview</span>
            <a href={publicBaseUrl} target="_blank" rel="noreferrer" className="text-[11px] text-brand inline-flex items-center gap-1 hover:underline">
              Open in new tab <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <iframe
            key={iframeSrc}
            src={iframeSrc}
            title="Partner deck preview"
            className="flex-1 w-full border-0"
          />
        </main>
      </div>
    </div>
  );
}

/* ─────────── Editor ─────────── */
function Editor({ studio, onSave }: { studio: GiveawayStudio; onSave: (field: FieldKey, value: string | null) => Promise<void> }) {
  return (
    <div className="space-y-0">
      <Section label="Slide 1" first>
        <p className="text-xs italic text-text-secondary">Title auto-builds from your partner list. Add partners in Settings to update it.</p>
      </Section>

      <Section label="Slide 2 — The Concept">
        <SavedInput  field="deck_s2_headline" label="Headline"   value={studio.deck_s2_headline}   placeholder={DEFAULT_DECK.s2_headline} onSave={onSave} />
        <SavedTextarea field="deck_s2_body"   label="Body copy"  value={studio.deck_intro_copy ?? studio.deck_s2_body} rows={3} onSave={onSave} />
      </Section>

      <Section label="Slide 3 — Prize Package">
        <p className="text-xs italic text-text-secondary mb-3">Prize rows pull from your partner list in Settings. Edit partners there.</p>
        <SavedInput field="deck_s3_headline"   label="Headline"   value={studio.deck_s3_headline}   placeholder={DEFAULT_DECK.s3_headline} onSave={onSave} />
        <SavedInput field="deck_s3_value_note" label="Value note" value={studio.deck_s3_value_note} placeholder="e.g. Target total value: $500+" onSave={onSave} />
      </Section>

      <Section label="Slide 4 — Timeline">
        <SavedInput    field="deck_s4_headline"     label="Headline"       value={studio.deck_s4_headline}     placeholder={DEFAULT_DECK.s4_headline} onSave={onSave} />
        <SavedInput    field="deck_s4_subtext"      label="Subtext"        value={studio.deck_s4_subtext}      placeholder={DEFAULT_DECK.s4_subtext} onSave={onSave} />
        <SavedInput    field="deck_s4_phase1_title" label="Phase 1 title"  value={studio.deck_s4_phase1_title} placeholder={DEFAULT_DECK.s4_phase1_title} onSave={onSave} />
        <SavedTextarea field="deck_s4_phase1_body"  label="Phase 1 body"   value={studio.deck_s4_phase1_body}  rows={2} placeholder={DEFAULT_DECK.s4_phase1_body} onSave={onSave} />
        <SavedInput    field="deck_s4_phase2_title" label="Phase 2 title"  value={studio.deck_s4_phase2_title} placeholder={DEFAULT_DECK.s4_phase2_title} onSave={onSave} />
        <SavedTextarea field="deck_s4_phase2_body"  label="Phase 2 body"   value={studio.deck_s4_phase2_body}  rows={2} placeholder={DEFAULT_DECK.s4_phase2_body} onSave={onSave} />
        <SavedInput    field="deck_s4_phase3_title" label="Phase 3 title"  value={studio.deck_s4_phase3_title} placeholder={DEFAULT_DECK.s4_phase3_title} onSave={onSave} />
        <SavedTextarea field="deck_s4_phase3_body"  label="Phase 3 body"   value={studio.deck_s4_phase3_body}  rows={2} placeholder={DEFAULT_DECK.s4_phase3_body} onSave={onSave} />
      </Section>

      <Section label="Slide 5 — How We Build It">
        <SavedInput    field="deck_s5_headline" label="Headline"      value={studio.deck_s5_headline} placeholder={DEFAULT_DECK.s5_headline} onSave={onSave} />
        <SavedInput    field="deck_s5_c1_title" label="Card 1 title"  value={studio.deck_s5_c1_title} placeholder={DEFAULT_DECK.s5_c1_title} onSave={onSave} />
        <SavedTextarea field="deck_s5_c1_body"  label="Card 1 body"   value={studio.deck_s5_c1_body}  rows={2} placeholder={DEFAULT_DECK.s5_c1_body} onSave={onSave} />
        <SavedInput    field="deck_s5_c2_title" label="Card 2 title"  value={studio.deck_s5_c2_title} placeholder={DEFAULT_DECK.s5_c2_title} onSave={onSave} />
        <SavedTextarea field="deck_s5_c2_body"  label="Card 2 body"   value={studio.deck_s5_c2_body}  rows={2} placeholder={DEFAULT_DECK.s5_c2_body} onSave={onSave} />
        <SavedInput    field="deck_s5_c3_title" label="Card 3 title"  value={studio.deck_s5_c3_title} placeholder={DEFAULT_DECK.s5_c3_title} onSave={onSave} />
        <SavedTextarea field="deck_s5_c3_body"  label="Card 3 body"   value={studio.deck_s5_c3_body}  rows={2} placeholder={DEFAULT_DECK.s5_c3_body} onSave={onSave} />
        <SavedInput    field="deck_s5_c4_title" label="Card 4 title"  value={studio.deck_s5_c4_title} placeholder={DEFAULT_DECK.s5_c4_title} onSave={onSave} />
        <SavedTextarea field="deck_s5_c4_body"  label="Card 4 body"   value={studio.deck_s5_c4_body}  rows={2} placeholder={DEFAULT_DECK.s5_c4_body} onSave={onSave} />
      </Section>

      <Section label="Slide 6 — Tracking System">
        <SavedInput    field="deck_s6_headline" label="Headline"       value={studio.deck_s6_headline} placeholder={DEFAULT_DECK.s6_headline} onSave={onSave} />
        <SavedTextarea field="deck_s6_body"     label="Body copy"      value={studio.deck_s6_body}     rows={2} placeholder={DEFAULT_DECK.s6_body} onSave={onSave} />
        <SavedInput    field="deck_s6_note"     label="Note below cards" value={studio.deck_s6_note}   placeholder={DEFAULT_DECK.s6_note} onSave={onSave} />
      </Section>

      <Section label="Slide 7 — How People Enter">
        <SavedInput field="deck_s7_headline" label="Headline" value={studio.deck_s7_headline} placeholder={DEFAULT_DECK.s7_headline} onSave={onSave} />
        <p className="text-xs italic text-text-secondary mt-2">Entry actions auto-build from your partner list. Add partners in Settings.</p>
      </Section>

      <Section label="Slide 8 — What We Need">
        <SavedInput    field="deck_s8_headline" label="Headline"           value={studio.deck_s8_headline} placeholder={DEFAULT_DECK.s8_headline} onSave={onSave} />
        <SavedTextarea field="deck_s8_prize"    label="Prize card body"     value={studio.deck_s8_prize ?? studio.deck_what_we_need_prize}    rows={2} onSave={onSave} />
        <SavedTextarea field="deck_s8_promo"    label="Promotion card body" value={studio.deck_s8_promo ?? studio.deck_what_we_need_promotion} rows={2} onSave={onSave} />
        <SavedTextarea field="deck_s8_class"    label="VIP class card body" value={studio.deck_s8_class ?? studio.deck_what_we_need_class}    rows={2} onSave={onSave} />
        <SavedTextarea field="deck_s8_time"     label="Time card body"      value={studio.deck_s8_time  ?? studio.deck_what_we_need_time}     rows={2} onSave={onSave} />
      </Section>

      <Section label="Slide 9 — CTA">
        <SavedInput    field="deck_s9_headline"     label="Headline"            value={studio.deck_s9_headline}     placeholder={DEFAULT_DECK.s9_headline} onSave={onSave} />
        <SavedInput    field="deck_s9_subline"      label="Subline (orange)"     value={studio.deck_s9_subline}      placeholder={DEFAULT_DECK.s9_subline} onSave={onSave} />
        <SavedTextarea field="deck_s9_body"         label="Body copy"            value={studio.deck_s9_body}         rows={2} placeholder={DEFAULT_DECK.s9_body} onSave={onSave} />
        <SavedInput    field="deck_contact_name"    label="Contact name"         value={studio.deck_contact_name}    onSave={onSave} />
        <SavedInput    field="deck_contact_title"   label="Contact title"        value={studio.deck_contact_title}   onSave={onSave} />
        <SavedInput    field="deck_contact_phone"   label="Contact phone"        value={studio.deck_contact_phone}   onSave={onSave} />
        <SavedInput    field="deck_contact_email"   label="Contact email"        value={studio.deck_contact_email}   onSave={onSave} />
      </Section>
    </div>
  );
}

function Section({ label, first, children }: { label: string; first?: boolean; children: React.ReactNode }) {
  return (
    <div className={`${first ? '' : 'border-t border-surface-border pt-4 mt-6'} space-y-3`}>
      <p className="text-xs font-bold uppercase tracking-wider text-brand">{label}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function SavedInput({ field, label, value, placeholder, onSave }: {
  field: FieldKey; label: string; value: string | null; placeholder?: string;
  onSave: (field: FieldKey, value: string | null) => Promise<void>;
}) {
  const [local, setLocal] = useState(value ?? '');
  const [saved, setSaved] = useState(false);
  const initial = useRef(value ?? '');

  useEffect(() => { setLocal(value ?? ''); initial.current = value ?? ''; }, [value]);

  const handleBlur = async () => {
    if (local === initial.current) return;
    await onSave(field, local);
    initial.current = local;
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <label className="block">
      <span className="flex items-center justify-between mb-1">
        <span className="text-[11px] uppercase tracking-wider font-bold text-text-secondary">{label}</span>
        {saved && <span className="text-[11px] text-success">Saved</span>}
      </span>
      <input
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="w-full min-h-[44px] rounded-lg bg-surface-input border border-surface-border focus:border-brand focus:outline-none px-3 text-sm text-text-primary"
      />
    </label>
  );
}

function SavedTextarea({ field, label, value, rows, placeholder, onSave }: {
  field: FieldKey; label: string; value: string | null; rows?: number; placeholder?: string;
  onSave: (field: FieldKey, value: string | null) => Promise<void>;
}) {
  const [local, setLocal] = useState(value ?? '');
  const [saved, setSaved] = useState(false);
  const initial = useRef(value ?? '');

  useEffect(() => { setLocal(value ?? ''); initial.current = value ?? ''; }, [value]);

  const handleBlur = async () => {
    if (local === initial.current) return;
    await onSave(field, local);
    initial.current = local;
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <label className="block">
      <span className="flex items-center justify-between mb-1">
        <span className="text-[11px] uppercase tracking-wider font-bold text-text-secondary">{label}</span>
        {saved && <span className="text-[11px] text-success">Saved</span>}
      </span>
      <textarea
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={handleBlur}
        rows={rows ?? 2}
        placeholder={placeholder}
        className="w-full rounded-lg bg-surface-input border border-surface-border focus:border-brand focus:outline-none px-3 py-2 text-sm text-text-primary resize-y"
      />
    </label>
  );
}
