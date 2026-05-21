import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { GiveawayStudio } from '../hooks/useGiveawayStudio';
import { DEFAULT_DECK_COPY } from '../lib/partnerDeckDefaults';

export function PartnerDeckSettings({ studio, onSaved }: { studio: GiveawayStudio; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [contactName, setContactName] = useState(studio.deck_contact_name ?? '');
  const [contactTitle, setContactTitle] = useState(studio.deck_contact_title ?? '');
  const [contactPhone, setContactPhone] = useState(studio.deck_contact_phone ?? '');
  const [contactEmail, setContactEmail] = useState(studio.deck_contact_email ?? '');
  const [anchorValue, setAnchorValue] = useState<string>(String(studio.deck_prize_anchor_value ?? 169));
  const [headlineValue, setHeadlineValue] = useState(studio.deck_headline_value ?? '');
  const [introCopy, setIntroCopy] = useState(studio.deck_intro_copy ?? '');
  const [askPrize, setAskPrize] = useState(studio.deck_what_we_need_prize ?? '');
  const [askPromo, setAskPromo] = useState(studio.deck_what_we_need_promotion ?? '');
  const [askClass, setAskClass] = useState(studio.deck_what_we_need_class ?? '');
  const [askTime, setAskTime] = useState(studio.deck_what_we_need_time ?? '');

  useEffect(() => {
    setContactName(studio.deck_contact_name ?? '');
    setContactTitle(studio.deck_contact_title ?? '');
    setContactPhone(studio.deck_contact_phone ?? '');
    setContactEmail(studio.deck_contact_email ?? '');
    setAnchorValue(String(studio.deck_prize_anchor_value ?? 169));
    setHeadlineValue(studio.deck_headline_value ?? '');
    setIntroCopy(studio.deck_intro_copy ?? '');
    setAskPrize(studio.deck_what_we_need_prize ?? '');
    setAskPromo(studio.deck_what_we_need_promotion ?? '');
    setAskClass(studio.deck_what_we_need_class ?? '');
    setAskTime(studio.deck_what_we_need_time ?? '');
  }, [studio.id]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const parsedAnchor = parseInt(anchorValue, 10);
    const { error } = await supabase
      .from('giveaway_studios' as any)
      .update({
        deck_contact_name: contactName.trim() || null,
        deck_contact_title: contactTitle.trim() || null,
        deck_contact_phone: contactPhone.trim() || null,
        deck_contact_email: contactEmail.trim() || null,
        deck_prize_anchor_value: Number.isFinite(parsedAnchor) ? parsedAnchor : null,
        deck_headline_value: headlineValue.trim() || null,
        deck_intro_copy: introCopy.trim() || null,
        deck_what_we_need_prize: askPrize.trim() || null,
        deck_what_we_need_promotion: askPromo.trim() || null,
        deck_what_we_need_class: askClass.trim() || null,
        deck_what_we_need_time: askTime.trim() || null,
      })
      .eq('id', studio.id);
    setSaving(false);
    setMsg(error ? error.message : 'Saved');
    onSaved();
    setTimeout(() => setMsg(null), 2000);
  };

  const inputCls = 'w-full min-h-[44px] rounded-lg bg-surface-input border border-surface-border focus:border-brand focus:outline-none px-3 text-text-primary';
  const labelCls = 'block text-xs uppercase tracking-wider text-text-secondary mb-1 font-bold';
  const helperCls = 'block text-xs text-text-secondary/70 mt-1';

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card font-body">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full min-h-[56px] flex items-center justify-between gap-2 px-6 py-4 text-left cursor-pointer"
      >
        <div>
          <h2 className="text-xl font-black text-text-primary">Partner Deck Content</h2>
          <p className="text-sm text-text-secondary mt-1">Contact info, prize anchor, and editable copy used in the partner pitch deck.</p>
        </div>
        {open ? <ChevronDown className="h-5 w-5 text-text-secondary" /> : <ChevronRight className="h-5 w-5 text-text-secondary" />}
      </button>

      {open && (
        <div className="px-6 pb-6 space-y-6 border-t border-surface-border">
          <Section title="Contact Information">
            <Field label="Contact Name"><input className={inputCls} value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Koa Vincent" /></Field>
            <Field label="Contact Title"><input className={inputCls} value={contactTitle} onChange={e => setContactTitle(e.target.value)} placeholder="Studio Leader & Head Coach" /></Field>
            <Field label="Contact Phone"><input className={inputCls} value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="971-255-7185" /></Field>
            <Field label="Contact Email"><input className={inputCls} value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="studio@orangetheory.com" /></Field>
          </Section>

          <Section title="Prize Anchor">
            <label className="block">
              <span className={labelCls}>OTF Prize Value ($)</span>
              <input type="number" className={inputCls} value={anchorValue} onChange={e => setAnchorValue(e.target.value)} />
              <span className={helperCls}>Value of the OTF membership prize (used throughout the deck).</span>
            </label>
            <label className="block">
              <span className={labelCls}>Bundle Total Display</span>
              <input className={inputCls} value={headlineValue} onChange={e => setHeadlineValue(e.target.value)} placeholder="$338+" />
              <span className={helperCls}>Shown on slide 3. Leave blank to auto-calculate as prize value × (1 + number of partners).</span>
            </label>
          </Section>

          <Section title="Deck Copy">
            <Field label="Intro paragraph (slide 2)">
              <textarea className={`${inputCls} min-h-[100px] py-2`} value={introCopy} onChange={e => setIntroCopy(e.target.value)} placeholder={DEFAULT_DECK_COPY.intro} />
            </Field>
            <Field label="Prize ask (slide 8)">
              <textarea className={`${inputCls} min-h-[80px] py-2`} value={askPrize} onChange={e => setAskPrize(e.target.value)} placeholder={`A gift card or service at roughly $${anchorValue || 169} — matched value to the OTF membership`} />
            </Field>
            <Field label="Promotion ask (slide 8)">
              <textarea className={`${inputCls} min-h-[80px] py-2`} value={askPromo} onChange={e => setAskPromo(e.target.value)} placeholder={DEFAULT_DECK_COPY.askPromotion} />
            </Field>
            <Field label="VIP class ask (slide 8)">
              <textarea className={`${inputCls} min-h-[80px] py-2`} value={askClass} onChange={e => setAskClass(e.target.value)} placeholder={DEFAULT_DECK_COPY.askClass} />
            </Field>
            <Field label="Time ask (slide 8)">
              <textarea className={`${inputCls} min-h-[80px] py-2`} value={askTime} onChange={e => setAskTime(e.target.value)} placeholder={DEFAULT_DECK_COPY.askTime} />
            </Field>
          </Section>

          <div className="flex items-center gap-3 pt-2">
            <button onClick={save} disabled={saving}
              className="min-h-[44px] px-5 rounded-lg bg-brand hover:bg-brand-hover text-brand-foreground font-bold cursor-pointer disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Deck Content'}
            </button>
            {msg && <span className="text-sm text-success">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 pt-4">
      <h3 className="text-sm font-black uppercase tracking-wider text-text-secondary">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-text-secondary mb-1 font-bold">{label}</span>
      {children}
    </label>
  );
}
