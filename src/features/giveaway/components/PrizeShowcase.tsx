import { Flame } from 'lucide-react';
import type { GiveawayPartner } from '../hooks/useGiveawayPartners';
import { getStudioCity } from '../lib/studioBrand';
import { getDrawRuleStatement, type WinnerStructure } from '../lib/winnerStructure';

export function PrizeShowcase({
  slug,
  partners,
  winnerStructure,
}: {
  slug: string;
  partners: GiveawayPartner[];
  winnerStructure: WinnerStructure | null | undefined;
}) {
  const city = getStudioCity(slug);
  const prizedPartners = partners.filter(p => (p.prize_description || '').trim());

  return (
    <section className="mb-8">
      <p
        className="text-[11px] uppercase text-[#E8540A] font-black mb-3"
        style={{ letterSpacing: '0.3em' }}
      >
        What You Could Win
      </p>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x md:grid md:grid-cols-3 md:overflow-visible md:gap-4">
        {/* Grand prize — always first */}
        <article className="snap-start flex-shrink-0 w-[78%] md:w-auto rounded-xl border-2 border-[#E8540A] bg-gradient-to-br from-[#2a1409] to-[#1f1f21] p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] uppercase tracking-[0.25em] font-black text-[#E8540A]">Grand Prize</span>
            <Flame className="h-3.5 w-3.5 text-[#E8540A]" />
          </div>
          <h3
            className="font-black text-[#F5F2EE] leading-[0.95]"
            style={{ fontFamily: '"Big Shoulders Display", "Bebas Neue", Impact, sans-serif', fontSize: 30, letterSpacing: '0.02em' }}
          >
            FREE OTF MEMBERSHIP
          </h3>
          <p className="text-xs text-[#F5F2EE]/60 mt-2 uppercase tracking-wider">Orangetheory Fitness {city}</p>
        </article>

        {prizedPartners.map(p => {
          const handle = (p.partner_ig_handle || '').trim().replace(/^@/, '');
          return (
            <article
              key={p.id}
              className="snap-start flex-shrink-0 w-[70%] md:w-auto rounded-xl border border-[#E8540A]/40 bg-[#1f1f21] p-5 flex flex-col"
            >
              <p className="text-[10px] uppercase tracking-[0.25em] font-black text-[#F5F2EE]/50 mb-2">Partner Prize</p>
              <h3 className="text-base font-black text-[#F5F2EE] mb-1.5">{p.partner_name}</h3>
              <p className="text-[#E8540A] font-bold text-lg leading-snug">{p.prize_description}</p>
              {handle && (
                <p className="text-xs text-[#F5F2EE]/50 mt-2">@{handle}</p>
              )}
            </article>
          );
        })}
      </div>

      <p className="text-xs text-[#F5F2EE]/60 mt-4 italic">
        {getDrawRuleStatement(winnerStructure)}
      </p>
    </section>
  );
}
