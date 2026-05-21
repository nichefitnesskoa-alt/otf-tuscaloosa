import { useEffect, useState } from 'react';
import { GiveawayStudio } from '../hooks/useGiveawayStudio';
import { useGiveawayPartners, GiveawayPartner, PartnerInput } from '../hooks/useGiveawayPartners';
import { supabase } from '@/integrations/supabase/client';
import { Pencil, Trash2, Plus, Check, X, Gift } from 'lucide-react';
import {
  WINNER_STRUCTURE_OPTIONS,
  type WinnerStructure,
} from '../lib/winnerStructure';
import { getGiveawayTitle, type TitleFormat } from '../lib/giveawayTitle';

export function SettingsPanel({ studio, onSaved }: { studio: GiveawayStudio; onSaved: () => void }) {
  const [duration, setDuration] = useState<number>(studio.countdown_duration_days);
  const [winnerStructure, setWinnerStructure] = useState<WinnerStructure>(studio.winner_structure ?? 'single');
  const [titleFormat, setTitleFormat] = useState<TitleFormat>(studio.title_format ?? 'auto_combined');
  const [customTitle, setCustomTitle] = useState<string>(studio.custom_title ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { partners } = useGiveawayPartners(studio.studio_slug);

  useEffect(() => {
    setDuration(studio.countdown_duration_days);
    setWinnerStructure(studio.winner_structure ?? 'single');
    setTitleFormat(studio.title_format ?? 'auto_combined');
    setCustomTitle(studio.custom_title ?? '');
  }, [studio.id, studio.countdown_duration_days, studio.winner_structure, studio.title_format, studio.custom_title]);

  const saveSettings = async () => {
    setSaving(true);
    setMsg(null);
    const { error } = await supabase
      .from('giveaway_studios' as any)
      .update({
        countdown_duration_days: duration,
        winner_structure: winnerStructure,
        title_format: titleFormat,
        custom_title: titleFormat === 'custom' ? (customTitle.trim() || null) : customTitle.trim() || null,
      })
      .eq('id', studio.id);
    setSaving(false);
    setMsg(error ? error.message : 'Saved');
    onSaved();
    setTimeout(() => setMsg(null), 2000);
  };

  const goLive = async () => {
    const { error } = await supabase
      .from('giveaway_studios' as any)
      .update({ goes_live_at: new Date().toISOString() })
      .eq('id', studio.id);
    if (!error) onSaved();
  };

  const reset = async () => {
    if (!confirm('End the giveaway? This clears the live date.')) return;
    const { error } = await supabase
      .from('giveaway_studios' as any)
      .update({ goes_live_at: null })
      .eq('id', studio.id);
    if (!error) onSaved();
  };

  const liveAt = studio.goes_live_at ? new Date(studio.goes_live_at) : null;
  const endAt = liveAt ? new Date(liveAt.getTime() + studio.countdown_duration_days * 86400 * 1000) : null;

  return (
    <div className="max-w-2xl space-y-6 font-body">
      <TitleFormatSection
        studioName={studio.studio_name}
        partners={partners}
        titleFormat={titleFormat}
        customTitle={customTitle}
        onChangeFormat={setTitleFormat}
        onChangeCustomTitle={setCustomTitle}
      />

      <PartnersSection slug={studio.studio_slug} />

      <WinnerStructureSection value={winnerStructure} onChange={setWinnerStructure} />


      <div className="rounded-xl border border-[#3a3a3c] bg-[#1f1f21] p-6 space-y-4">
        <h2 className="text-xl font-black">Countdown</h2>
        <div>
          <span className="block text-xs uppercase tracking-wider text-[#F5F2EE]/60 mb-2 font-bold">Duration</span>
          <div className="inline-flex rounded-lg border border-[#3a3a3c] overflow-hidden">
            {[7,10,14].map(d => (
              <button key={d} onClick={() => setDuration(d)}
                className={`min-h-[44px] px-5 font-bold cursor-pointer ${duration === d ? 'bg-[#E8540A] text-white' : 'bg-[#2a2a2c] text-[#F5F2EE]/70 hover:bg-[#3a3a3c]'}`}>
                {d} days
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={saveSettings} disabled={saving}
            className="min-h-[44px] px-5 rounded-lg bg-[#2a2a2c] hover:bg-[#3a3a3c] border border-[#3a3a3c] text-[#F5F2EE] font-bold cursor-pointer">
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          {msg && <span className="text-sm text-emerald-400">{msg}</span>}
        </div>
      </div>

      <div className="rounded-xl border border-[#3a3a3c] bg-[#1f1f21] p-6 space-y-4">
        <h2 className="text-xl font-black">Live Status</h2>
        {!liveAt && (
          <>
            <p className="text-sm text-[#F5F2EE]/70">Not live yet. Participants see the Coming Soon screen.</p>
            <button onClick={goLive}
              className="min-h-[56px] px-8 rounded-xl bg-[#E8540A] hover:bg-[#ff6a1f] text-white font-black text-lg tracking-wider cursor-pointer">
              GO LIVE NOW
            </button>
          </>
        )}
        {liveAt && endAt && (
          <>
            <p className="text-sm text-[#F5F2EE]/70">
              Live since <span className="text-[#F5F2EE]">{liveAt.toLocaleString()}</span>.<br/>
              Ends <span className="text-[#E8540A] font-bold">{endAt.toLocaleString()}</span>.
            </p>
            <button onClick={reset}
              className="min-h-[44px] px-5 rounded-lg border border-red-500/50 text-red-400 hover:bg-red-500/10 font-bold cursor-pointer">
              Reset / End Giveaway
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function WinnerStructureSection({
  value,
  onChange,
}: {
  value: WinnerStructure;
  onChange: (v: WinnerStructure) => void;
}) {
  return (
    <div className="rounded-xl border border-[#3a3a3c] bg-[#1f1f21] p-6 space-y-4">
      <div>
        <h2 className="text-xl font-black">Winner Draw Rules</h2>
        <p className="text-sm text-[#F5F2EE]/60 mt-1">How prizes get awarded. Shown plainly on the participant form.</p>
      </div>

      <div className="space-y-3">
        {WINNER_STRUCTURE_OPTIONS.map(opt => {
          const Icon = opt.icon;
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`w-full text-left rounded-lg border-2 px-4 py-4 min-h-[44px] flex items-start gap-4 cursor-pointer transition ${
                selected
                  ? 'border-[#E8540A] bg-[#E8540A]/10 text-[#F5F2EE]'
                  : 'border-[#3a3a3c] bg-[#2a2a2c] text-[#F5F2EE]/80 hover:border-[#E8540A]/50'
              }`}
            >
              <div className={`flex-shrink-0 mt-0.5 ${selected ? 'text-[#E8540A]' : 'text-[#F5F2EE]/50'}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-black text-base ${selected ? 'text-[#F5F2EE]' : 'text-[#F5F2EE]'}`}>{opt.title}</p>
                <p className="text-sm mt-1 text-[#F5F2EE]/70">{opt.subtitle}</p>
              </div>
              <div className={`flex-shrink-0 mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                selected ? 'border-[#E8540A] bg-[#E8540A]' : 'border-[#3a3a3c]'
              }`}>
                {selected && <Check className="h-3 w-3 text-white" />}
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-[#F5F2EE]/50">Saved with the Save Settings button below.</p>
    </div>
  );
}

function PartnersSection({ slug }: { slug: string }) {
  const { partners, add, update, remove } = useGiveawayPartners(slug);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="rounded-xl border border-[#3a3a3c] bg-[#1f1f21] p-6 space-y-4">
      <div>
        <h2 className="text-xl font-black">Partner Businesses</h2>
        <p className="text-sm text-[#F5F2EE]/60 mt-1">Each partner adds one bonus entry action to the participant form.</p>
      </div>

      {partners.length === 0 && !adding && (
        <p className="text-sm text-[#F5F2EE]/50 italic">No partners yet. Add your first below.</p>
      )}

      <ul className="space-y-3">
        {partners.map(p => (
          <li key={p.id}>
            {editingId === p.id ? (
              <PartnerForm
                initial={{
                  partner_name: p.partner_name,
                  partner_ig_handle: p.partner_ig_handle,
                  receipt_instructions: p.receipt_instructions,
                  prize_description: p.prize_description,
                }}
                submitLabel="Update Partner"
                onSubmit={async (input) => {
                  const { error } = await update(p.id, input);
                  if (!error) setEditingId(null);
                  return error;
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <PartnerCard
                partner={p}
                onEdit={() => setEditingId(p.id)}
                onDelete={async () => {
                  if (!confirm(`Remove ${p.partner_name} from this giveaway? This will not affect existing entries.`)) return;
                  await remove(p.id);
                }}
              />
            )}
          </li>
        ))}
      </ul>

      {adding ? (
        <PartnerForm
          submitLabel="Save Partner"
          onSubmit={async (input) => {
            const { error } = await add(input);
            if (!error) setAdding(false);
            return error;
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-lg bg-[#E8540A] hover:bg-[#ff6a1f] text-white font-bold cursor-pointer"
        >
          <Plus className="h-5 w-5" /> Add Partner
        </button>
      )}
    </div>
  );
}

function PartnerCard({ partner, onEdit, onDelete }: { partner: GiveawayPartner; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="rounded-lg border border-[#3a3a3c] bg-[#2a2a2c] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-black text-[#F5F2EE] truncate">{partner.partner_name}</p>
          {partner.prize_description && (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-bold uppercase tracking-wider text-[#E8540A] bg-[#E8540A]/10 border border-[#E8540A]/40 rounded px-2 py-0.5">
              <Gift className="h-3 w-3" /> Prize: {partner.prize_description}
            </span>
          )}
          {partner.partner_ig_handle && (
            <p className="text-sm text-[#F5F2EE]/60 mt-1.5">@{partner.partner_ig_handle}</p>
          )}
          {partner.receipt_instructions && (
            <p className="text-sm text-[#F5F2EE]/70 mt-2 line-clamp-2">{partner.receipt_instructions}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          <button onClick={onEdit}
            className="min-h-[36px] inline-flex items-center gap-1.5 px-3 rounded border border-[#3a3a3c] hover:border-[#E8540A] text-[#F5F2EE] text-sm font-bold cursor-pointer">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button onClick={onDelete}
            className="min-h-[36px] inline-flex items-center gap-1.5 px-3 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 text-sm font-bold cursor-pointer">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function PartnerForm({
  initial, submitLabel, onSubmit, onCancel,
}: {
  initial?: PartnerInput;
  submitLabel: string;
  onSubmit: (input: PartnerInput) => Promise<string | undefined>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.partner_name ?? '');
  const [ig, setIg] = useState(initial?.partner_ig_handle ?? '');
  const [instr, setInstr] = useState(initial?.receipt_instructions ?? '');
  const [prize, setPrize] = useState(initial?.prize_description ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) { setErr('Partner name is required'); return; }
    setBusy(true);
    setErr(null);
    const cleanIg = ig.trim().replace(/^@/, '');
    const error = await onSubmit({
      partner_name: name,
      partner_ig_handle: cleanIg || null,
      receipt_instructions: instr || null,
      prize_description: prize || null,
    });
    setBusy(false);
    if (error) setErr(error);
  };

  return (
    <div className="rounded-lg border-2 border-[#E8540A]/50 bg-[#181819] p-4 space-y-3">
      <label className="block">
        <span className="block text-xs uppercase tracking-wider text-[#F5F2EE]/60 mb-1 font-bold">Partner Business Name *</span>
        <input value={name} onChange={(e) => setName(e.target.value)}
          className="w-full min-h-[44px] rounded-lg bg-[#2a2a2c] border border-[#3a3a3c] focus:border-[#E8540A] focus:outline-none px-3 text-[#F5F2EE]" />
      </label>
      <label className="block">
        <span className="block text-xs uppercase tracking-wider text-[#F5F2EE]/60 mb-1 font-bold">Prize for this partner</span>
        <input value={prize} onChange={(e) => setPrize(e.target.value)}
          placeholder="e.g. One free blowout, $25 gift card, Free meal for two"
          className="w-full min-h-[44px] rounded-lg bg-[#2a2a2c] border border-[#3a3a3c] focus:border-[#E8540A] focus:outline-none px-3 text-[#F5F2EE]" />
        <span className="block text-xs text-[#F5F2EE]/50 mt-1">Shown on the entry form so participants know what they can win.</span>
      </label>
      <label className="block">
        <span className="block text-xs uppercase tracking-wider text-[#F5F2EE]/60 mb-1 font-bold">Instagram Handle</span>
        <input value={ig} onChange={(e) => setIg(e.target.value)} placeholder="@businessname"
          className="w-full min-h-[44px] rounded-lg bg-[#2a2a2c] border border-[#3a3a3c] focus:border-[#E8540A] focus:outline-none px-3 text-[#F5F2EE]" />
      </label>
      <label className="block">
        <span className="block text-xs uppercase tracking-wider text-[#F5F2EE]/60 mb-1 font-bold">Receipt Instructions</span>
        <textarea value={instr} onChange={(e) => setInstr(e.target.value)} rows={3}
          placeholder="What should participants do to earn this entry?"
          className="w-full rounded-lg bg-[#2a2a2c] border border-[#3a3a3c] focus:border-[#E8540A] focus:outline-none px-3 py-2 text-[#F5F2EE]" />
      </label>
      {err && <p className="text-sm text-red-400">{err}</p>}
      <div className="flex items-center gap-3">
        <button onClick={submit} disabled={busy}
          className="min-h-[44px] inline-flex items-center gap-1.5 px-5 rounded-lg bg-[#E8540A] hover:bg-[#ff6a1f] disabled:opacity-50 text-white font-bold cursor-pointer">
          <Check className="h-4 w-4" /> {busy ? 'Saving…' : submitLabel}
        </button>
        <button onClick={onCancel}
          className="min-h-[44px] inline-flex items-center gap-1.5 px-3 text-[#F5F2EE]/70 hover:text-[#F5F2EE] font-bold cursor-pointer">
          <X className="h-4 w-4" /> Cancel
        </button>
      </div>
    </div>
  );
}
