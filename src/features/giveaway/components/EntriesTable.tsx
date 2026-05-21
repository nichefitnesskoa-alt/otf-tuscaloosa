import { PartnerActionRow } from '../hooks/useGiveawayEntries';
import { GiveawayPartner } from '../hooks/useGiveawayPartners';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const FIXED_ACTIONS = [
  { key: 'action_instagram_follow', label: 'Instagram Follow', short: 'IG' },
  { key: 'action_post_engagement', urlKey: 'action_post_engagement_screenshot_url', label: 'Post Engagement', short: 'Post' },
  { key: 'action_story_share', urlKey: 'action_story_share_screenshot_url', label: 'Story Share', short: 'Story' },
  { key: 'action_free_class', urlKey: 'action_free_class_screenshot_url', label: 'Class Story Post', short: 'Story' },
] as const;

interface Entry {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  total_entries: number;
  submitted_at: string;
  action_instagram_follow: boolean;
  action_post_engagement: boolean;
  action_post_engagement_screenshot_url: string | null;
  action_story_share: boolean;
  action_story_share_screenshot_url: string | null;
  action_free_class: boolean;
  action_free_class_screenshot_url: string | null;
  partner_actions: PartnerActionRow[] | null;
}

export function EntriesTable({ entries, partners }: { entries: Entry[]; partners: GiveawayPartner[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (!entries.length) {
    return <div className="rounded-xl border border-[#3a3a3c] bg-[#1f1f21] p-8 text-center text-[#F5F2EE]/60 font-body">No entries yet.</div>;
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block rounded-xl border border-[#3a3a3c] bg-[#1f1f21] overflow-hidden">
        <div className="grid grid-cols-[40px_2fr_2fr_1.2fr_80px_1.6fr_1fr] gap-3 px-4 py-3 text-[10px] uppercase tracking-wider text-[#F5F2EE]/60 font-bold font-display border-b border-[#3a3a3c]">
          <span></span><span>Name</span><span>Email</span><span>Phone</span><span>Entries</span><span>Actions</span><span>Submitted</span>
        </div>
        <ul>
          {entries.map((e) => {
            const isOpen = open === e.id;
            const paMap = new Map((e.partner_actions || []).map(a => [a.partner_id, a]));
            return (
              <li key={e.id} className="border-b border-[#3a3a3c] last:border-b-0">
                <button
                  onClick={() => setOpen(isOpen ? null : e.id)}
                  className="w-full text-left grid grid-cols-[40px_2fr_2fr_1.2fr_80px_1.6fr_1fr] gap-3 px-4 py-3 hover:bg-[#262628] items-center min-h-[56px] cursor-pointer font-body"
                >
                  <span className="text-[#F5F2EE]/50">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>
                  <span className="font-semibold truncate">{e.first_name} {e.last_name}</span>
                  <span className="truncate text-sm text-[#F5F2EE]/80">{e.email}</span>
                  <span className="text-sm text-[#F5F2EE]/80">{e.phone}</span>
                  <span>
                    <span className={`inline-flex items-center justify-center min-w-[36px] h-7 px-2 rounded font-black font-display text-sm ${
                      e.total_entries === 0 ? 'bg-[#2a2a2c] text-[#F5F2EE]/40 border border-[#3a3a3c]'
                        : e.total_entries > 1 ? 'bg-[#E8540A] text-white' : 'bg-[#2a2a2c] text-[#F5F2EE]'
                    }`}>{e.total_entries}</span>
                  </span>
                  <span className="flex gap-1.5 flex-wrap">
                    {FIXED_ACTIONS.map(a => (
                      <span key={a.key} title={a.label}
                        className={`h-6 w-6 rounded flex items-center justify-center text-[10px] font-bold ${(e as any)[a.key] ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#2a2a2c] text-[#F5F2EE]/30'}`}>
                        {(e as any)[a.key] ? <Check className="h-3 w-3" /> : a.short[0]}
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
                {isOpen && <ExpandedScreenshots entry={e} partners={partners} />}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Mobile cards */}
      <ul className="md:hidden space-y-2">
        {entries.map((e) => {
          const isOpen = open === e.id;
          return (
            <li key={e.id} className="rounded-xl border border-[#3a3a3c] bg-[#1f1f21] overflow-hidden">
              <button onClick={() => setOpen(isOpen ? null : e.id)} className="w-full text-left p-4 flex items-center gap-3 cursor-pointer">
                <span className={`inline-flex items-center justify-center min-w-[44px] h-10 px-2 rounded font-black font-display text-lg ${
                  e.total_entries === 0 ? 'bg-[#2a2a2c] text-[#F5F2EE]/40 border border-[#3a3a3c]'
                    : e.total_entries > 1 ? 'bg-[#E8540A] text-white' : 'bg-[#2a2a2c] text-[#F5F2EE]'
                }`}>{e.total_entries}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold text-[#F5F2EE] truncate">{e.first_name} {e.last_name}</p>
                  <p className="text-xs text-[#F5F2EE]/60 font-body truncate">{e.email}</p>
                  <p className="text-[10px] text-[#F5F2EE]/40 font-body mt-0.5">{new Date(e.submitted_at).toLocaleString()}</p>
                </div>
                {isOpen ? <ChevronDown className="h-4 w-4 text-[#F5F2EE]/50" /> : <ChevronRight className="h-4 w-4 text-[#F5F2EE]/50" />}
              </button>
              {isOpen && (
                <div className="px-4 pb-4 space-y-2 border-t border-[#3a3a3c] pt-3 font-body text-sm">
                  <p className="text-[#F5F2EE]/80"><span className="text-[#F5F2EE]/50">Phone:</span> {e.phone}</p>
                  <ExpandedScreenshots entry={e} partners={partners} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function ExpandedScreenshots({ entry, partners }: { entry: Entry; partners: GiveawayPartner[] }) {
  const paMap = new Map((entry.partner_actions || []).map(a => [a.partner_id, a]));
  const fixed = FIXED_ACTIONS.filter(a => 'urlKey' in a && (entry as any)[a.urlKey]);
  const partnerShots = partners.filter(p => paMap.get(p.id)?.screenshot_url);
  if (!fixed.length && !partnerShots.length) {
    return <p className="text-sm text-[#F5F2EE]/50 font-body px-4 py-4 bg-[#181819]">No screenshots uploaded.</p>;
  }
  return (
    <div className="px-4 py-4 bg-[#181819] flex flex-wrap gap-3">
      {fixed.map(a => (
        <a key={a.key} href={(entry as any)[a.urlKey!]} target="_blank" rel="noreferrer" className="block">
          <img src={(entry as any)[a.urlKey!]} alt={a.label} className="h-24 w-24 object-cover rounded border border-[#3a3a3c]" />
          <p className="text-[10px] text-center text-[#F5F2EE]/60 mt-1 uppercase tracking-wider font-display">{a.short}</p>
        </a>
      ))}
      {partnerShots.map(p => {
        const a = paMap.get(p.id)!;
        return (
          <a key={p.id} href={a.screenshot_url!} target="_blank" rel="noreferrer" className="block">
            <img src={a.screenshot_url!} alt={p.partner_name} className="h-24 w-24 object-cover rounded border border-[#3a3a3c]" />
            <p className="text-[10px] text-center text-[#F5F2EE]/60 mt-1 uppercase tracking-wider truncate max-w-[96px] font-display">{p.partner_name}</p>
          </a>
        );
      })}
    </div>
  );
}
