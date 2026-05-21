import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GiveawayStudio } from '../hooks/useGiveawayStudio';

export function SettingsPanel({ studio, onSaved }: { studio: GiveawayStudio; onSaved: () => void }) {
  const [partnerName, setPartnerName] = useState(studio.partner_name ?? '');
  const [partnerInstr, setPartnerInstr] = useState(studio.partner_instructions ?? '');
  const [duration, setDuration] = useState<number>(studio.countdown_duration_days);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setPartnerName(studio.partner_name ?? '');
    setPartnerInstr(studio.partner_instructions ?? '');
    setDuration(studio.countdown_duration_days);
  }, [studio.id]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const { error } = await supabase
      .from('giveaway_studios' as any)
      .update({
        partner_name: partnerName.trim() || null,
        partner_instructions: partnerInstr.trim() || null,
        countdown_duration_days: duration,
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
    <div className="max-w-2xl space-y-6">
      <div className="rounded-xl border border-[#3a3a3c] bg-[#1f1f21] p-6 space-y-4">
        <h2 className="text-xl font-black">Partner</h2>
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-[#F5F2EE]/60 mb-1 font-bold">Partner business name</span>
          <input value={partnerName} onChange={(e) => setPartnerName(e.target.value)}
            placeholder="Shown on entry form"
            className="w-full min-h-[44px] rounded-lg bg-[#2a2a2c] border border-[#3a3a3c] focus:border-[#E8540A] focus:outline-none px-3 text-[#F5F2EE]" />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-[#F5F2EE]/60 mb-1 font-bold">Receipt instructions</span>
          <textarea value={partnerInstr} onChange={(e) => setPartnerInstr(e.target.value)} rows={3}
            placeholder="What participants need to do to earn the partner-visit entry"
            className="w-full rounded-lg bg-[#2a2a2c] border border-[#3a3a3c] focus:border-[#E8540A] focus:outline-none px-3 py-2 text-[#F5F2EE]" />
        </label>
        <div>
          <span className="block text-xs uppercase tracking-wider text-[#F5F2EE]/60 mb-2 font-bold">Countdown duration</span>
          <div className="inline-flex rounded-lg border border-[#3a3a3c] overflow-hidden">
            {[7,10,14].map(d => (
              <button key={d} onClick={() => setDuration(d)}
                className={`min-h-[44px] px-5 font-bold ${duration === d ? 'bg-[#E8540A] text-white' : 'bg-[#2a2a2c] text-[#F5F2EE]/70 hover:bg-[#3a3a3c]'}`}>
                {d} days
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving}
            className="min-h-[44px] px-5 rounded-lg bg-[#2a2a2c] hover:bg-[#3a3a3c] border border-[#3a3a3c] text-[#F5F2EE] font-bold">
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          {msg && <span className="text-sm text-emerald-400">{msg}</span>}
        </div>
      </div>

      <div className="rounded-xl border border-[#3a3a3c] bg-[#1f1f21] p-6 space-y-4">
        <h2 className="text-xl font-black">Live Status</h2>
        {!liveAt && (
          <>
            <p className="text-sm text-[#F5F2EE]/70">Not live yet. Participants see a "Coming soon" screen.</p>
            <button onClick={goLive}
              className="min-h-[56px] px-8 rounded-xl bg-[#E8540A] hover:bg-[#ff6a1f] text-white font-black text-lg tracking-wider">
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
              className="min-h-[44px] px-5 rounded-lg border border-red-500/50 text-red-400 hover:bg-red-500/10 font-bold">
              Reset / End Giveaway
            </button>
          </>
        )}
      </div>
    </div>
  );
}
