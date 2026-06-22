import { GiveawayPartner } from '../hooks/useGiveawayPartners';
import { getParticipantStudioName, getStudioIgHandle } from '@/lib/studioNames';

export function PrizeShowcase({
  slug,
  partners,
  showWinnerBadge,
}: {
  slug: string;
  partners: GiveawayPartner[];
  showWinnerBadge?: boolean;
}) {
  const igHandle = getStudioIgHandle(slug).replace(/^@/, '');

  const cards: Array<{ id: string; prize: string; business: string; handle?: string | null; tbd?: boolean; winnerLabel?: string }> = [
    {
      id: 'otf',
      prize: 'FREE MEMBERSHIP',
      business: getParticipantStudioName(slug).toUpperCase(),
      handle: igHandle,
    },
  ];
  for (const p of partners) {
    const prizeText = (p.prize_description || '').trim();
    const count = Math.max(1, Math.min(10, p.prize_count ?? 1));
    for (let i = 0; i < count; i++) {
      cards.push({
        id: count > 1 ? `${p.id}__${i + 1}` : p.id,
        prize: prizeText ? prizeText.toUpperCase() : 'PRIZE TBD',
        business: p.partner_name.toUpperCase(),
        handle: (p.partner_ig_handle || '').trim().replace(/^@/, '') || null,
        tbd: !prizeText,
        winnerLabel: count > 1 ? `Winner ${i + 1} of ${count}` : undefined,
      });
    }
  }

  const count = cards.length;

  return (
    <section className="mb-8">
      <p className="font-display text-[11px] uppercase text-[#E8540A] font-bold mb-3" style={{ letterSpacing: '0.15em' }}>
        What You Could Win
      </p>

      {/* Desktop grid */}
      <div
        className="hidden md:grid gap-3"
        style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
      >
        {cards.map(c => <PrizeCard key={c.id} {...c} showWinnerBadge={showWinnerBadge} />)}
      </div>

      {/* Mobile horizontal scroll */}
      <div className="md:hidden flex gap-2.5 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 pb-2" style={{ scrollPaddingLeft: 16 }}>
        {cards.map(c => (
          <div key={c.id} className="snap-start flex-shrink-0" style={{ width: 200 }}>
            <PrizeCard {...c} mobile showWinnerBadge={showWinnerBadge} />
          </div>
        ))}
        {/* peek spacer */}
        <div className="flex-shrink-0" style={{ width: 4 }} />
      </div>
    </section>
  );
}

function PrizeCard({
  prize, business, handle, tbd, mobile, showWinnerBadge, winnerLabel,
}: {
  prize: string;
  business: string;
  handle?: string | null;
  tbd?: boolean;
  mobile?: boolean;
  showWinnerBadge?: boolean;
  winnerLabel?: string;
}) {
  return (
    <article
      className="relative rounded-xl border-[1.5px] border-[#E8540A] bg-[#2A2A2C] overflow-hidden flex flex-col"
      style={{ height: mobile ? 160 : 180 }}
    >
      <div className="flex-1 flex items-center justify-center px-4 py-3 text-center">
        <h3
          className={`font-display font-black uppercase leading-[0.95] ${tbd ? 'text-[#8E8E93]' : 'text-[#E8540A]'} line-clamp-2`}
          style={{
            fontSize: mobile ? 'clamp(20px, 5vw, 24px)' : 'clamp(22px, 2.4vw, 36px)',
            letterSpacing: '0.01em',
          }}
        >
          {prize}
        </h3>
      </div>
      <div className="bg-[#1C1C1E] px-3 py-2.5 text-center border-t border-[#3a3a3c]">
        <p
          className="font-display font-bold uppercase text-[#F5F2EE] truncate"
          style={{ fontSize: mobile ? 13 : 16, letterSpacing: '0.02em' }}
        >
          {business}
        </p>
        {handle && (
          <p className="font-body text-[#8E8E93] truncate" style={{ fontSize: 12 }}>
            @{handle}
          </p>
        )}
        {winnerLabel && (
          <p className="font-display font-bold uppercase text-[#E8540A] mt-1" style={{ fontSize: 10, letterSpacing: '0.12em' }}>
            {winnerLabel}
          </p>
        )}
      </div>
      {showWinnerBadge && (
        <span
          className="absolute bottom-1.5 right-1.5 bg-[#2A2A2C] text-[#8E8E93] border border-[#3a3a3c] rounded-[2px] px-1.5 py-0.5 font-display font-bold uppercase"
          style={{ fontSize: 8, letterSpacing: '0.16em' }}
        >
          1 winner
        </span>
      )}
    </article>
  );
}
