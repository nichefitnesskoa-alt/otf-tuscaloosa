import { GiveawayPartner, getPartnerPrizeLabel } from '../hooks/useGiveawayPartners';
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
    const count = Math.max(1, Math.min(10, p.prize_count ?? 1));
    for (let i = 0; i < count; i++) {
      const slotText = getPartnerPrizeLabel(p, i);
      cards.push({
        id: count > 1 ? `${p.id}__${i + 1}` : p.id,
        prize: slotText ? slotText.toUpperCase() : 'PRIZE TBD',
        business: p.partner_name.toUpperCase(),
        handle: (p.partner_ig_handle || '').trim().replace(/^@/, '') || null,
        tbd: !slotText,
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

      {/* Mobile vertical stack — all prizes visible at a glance */}
      <div className="md:hidden flex flex-col gap-2.5 w-full">
        {cards.map(c => (
          <PrizeCard key={c.id} {...c} mobile showWinnerBadge={showWinnerBadge} />
        ))}
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
      style={{ minHeight: mobile ? 160 : 180 }}
    >
      <div className="flex-1 flex items-center justify-center px-3 py-3 text-center">
        <h3
          className={`font-display font-black uppercase leading-[1.05] break-words hyphens-auto ${tbd ? 'text-[#8E8E93]' : 'text-[#E8540A]'}`}
          style={{
            fontSize: mobile ? 'clamp(14px, 4.2vw, 18px)' : 'clamp(15px, 1.6vw, 22px)',
            letterSpacing: '0',
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
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
