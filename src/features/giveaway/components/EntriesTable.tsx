import { useState } from 'react';
import { GiveawayEntry } from '../hooks/useGiveawayEntries';
import { GiveawayPartner } from '../hooks/useGiveawayPartners';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';

const FIXED_ACTIONS: Array<{ key: keyof GiveawayEntry; url?: keyof GiveawayEntry; label: string; short: string }> = [
  { key: 'action_instagram_follow', label: 'Instagram Follow', short: 'IG' },
  { key: 'action_post_engagement', url: 'action_post_engagement_screenshot_url', label: 'Post Engagement', short: 'Post' },
  { key: 'action_story_share', url: 'action_story_share_screenshot_url', label: 'Story Share', short: 'Story' },
  { key: 'action_free_class', url: 'action_free_class_screenshot_url', label: 'Free Class', short: 'Class' },
];

export function EntriesTable({ entries, partners }: { entries: GiveawayEntry[]; partners: GiveawayPartner[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (!entries.length) {
    return <div className="rounded-xl border border-[#3a3a3c] bg-[#1f1f21] p-8 text-center text-[#F5F2EE]/60">No entries yet.</div>;
  }

  return (
    <div className="rounded-xl border border-[#3a3a3c] bg-[#1f1f21] overflow-hidden">
      <div className="hidden md:grid grid-cols-[40px_2fr_2fr_1.2fr_80px_1.6fr_1fr] gap-3 px-4 py-3 text-[10px] uppercase tracking-wider text-[#F5F2EE]/60 font-bold border-b border-[#3a3a3c]">
        <span></span><span>Name</span><span>Email</span><span>Phone</span><span>Entries</span><span>Actions</span><span>Submitted</span>
      </div>
      <ul>
        {entries.map((e) => {
          const isOpen = open === e.id;
          const partnerActions = e.partner_actions || [];
          const paMap = new Map(partnerActions.map(a => [a.partner_id, a]));
          return (
            <li key={e.id} className="border-b border-[#3a3a3c] last:border-b-0">
              <button
                onClick={() => setOpen(isOpen ? null : e.id)}
                className="w-full text-left grid grid-cols-[40px_2fr_2fr_1.2fr_80px_1.6fr_1fr] gap-3 px-4 py-3 hover:bg-[#262628] items-center min-h-[56px] cursor-pointer"
              >
                <span className="text-[#F5F2EE]/50">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>
                <span className="font-semibold truncate">{e.first_name} {e.last_name}</span>
                <span className="truncate text-sm text-[#F5F2EE]/80">{e.email}</span>
                <span className="text-sm text-[#F5F2EE]/80">{e.phone}</span>
                <span>
                  <span
                    title={e.total_entries === 0 ? 'Not eligible — 0 entries' : undefined}
                    className={`inline-flex items-center justify-center min-w-[36px] h-7 px-2 rounded font-black text-sm ${
                      e.total_entries === 0
                        ? 'bg-[#2a2a2c] text-[#F5F2EE]/40 border border-[#3a3a3c]'
                        : e.total_entries > 1
                          ? 'bg-[#E8540A] text-white'
                          : 'bg-[#2a2a2c] text-[#F5F2EE]'
                    }`}>
                    {e.total_entries}
                  </span>
                </span>
                <span className="flex gap-1.5 flex-wrap">
                  {FIXED_ACTIONS.map(a => (
                    <span key={a.key as string} title={a.label}
                      className={`h-6 w-6 rounded flex items-center justify-center text-[10px] font-bold ${e[a.key] ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#2a2a2c] text-[#F5F2EE]/30'}`}>
                      {e[a.key] ? <Check className="h-3 w-3" /> : a.short[0]}
                    </span>
                  ))}
                  {partners.map(p => {
                    const done = !!paMap.get(p.id)?.completed;
                    return (
                      <span key={p.id} title={p.partner_name}
                        className={`h-6 w-6 rounded flex items-center justify-center text-[10px] font-bold ${done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#2a2a2c] text-[#F5F2EE]/30'}`}>
                        {done ? <Check className="h-3 w-3" /> : (p.partner_name[0] || '?').toUpperCase()}
                      </span>
                    );
                  })}
                </span>
                <span className="text-xs text-[#F5F2EE]/60">{new Date(e.submitted_at).toLocaleString()}</span>
              </button>
              {isOpen && (
                <div className="px-4 py-4 bg-[#181819] flex flex-wrap gap-3">
                  {FIXED_ACTIONS.filter(a => a.url && e[a.url]).map(a => (
                    <a key={a.key as string} href={e[a.url!] as string} target="_blank" rel="noreferrer" className="block">
                      <img src={e[a.url!] as string} alt={a.label} className="h-24 w-24 object-cover rounded border border-[#3a3a3c]" />
                      <p className="text-[10px] text-center text-[#F5F2EE]/60 mt-1 uppercase tracking-wider">{a.short}</p>
                    </a>
                  ))}
                  {partners.map(p => {
                    const a = paMap.get(p.id);
                    if (!a?.screenshot_url) return null;
                    return (
                      <a key={p.id} href={a.screenshot_url} target="_blank" rel="noreferrer" className="block">
                        <img src={a.screenshot_url} alt={p.partner_name} className="h-24 w-24 object-cover rounded border border-[#3a3a3c]" />
                        <p className="text-[10px] text-center text-[#F5F2EE]/60 mt-1 uppercase tracking-wider truncate max-w-[96px]">{p.partner_name}</p>
                      </a>
                    );
                  })}
                  {!FIXED_ACTIONS.some(a => a.url && e[a.url]) &&
                   !partners.some(p => paMap.get(p.id)?.screenshot_url) && (
                    <p className="text-sm text-[#F5F2EE]/50">No screenshots uploaded.</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
