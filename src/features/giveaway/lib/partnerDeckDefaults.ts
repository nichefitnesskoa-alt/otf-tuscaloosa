// Default copy for the partner pitch deck. Used when a studio leaves a
// deck_* override blank in admin settings.

export const DEFAULT_DECK_COPY = {
  intro:
    'We pool prizes from local businesses into one major giveaway, then spend the final stretch of the month pushing it hard across every platform. More reach. Real leads. Actual community momentum.',
  askPrize: (anchor: number) =>
    `A gift card or service at roughly $${anchor} — matched value to the OTF membership.`,
  askPromotion:
    'Promote the giveaway to your audience — one story or post, your call. We provide the assets.',
  askClass:
    'Bring your staff for an OTF class so we can capture and share the experience together.',
  askTime:
    'About 15 minutes to align on the prize and timing. We handle the rest.',
} as const;

export function computeBundleTotal(anchor: number, partnerCount: number, override?: string | null): string {
  if (override && override.trim()) return override.trim();
  const total = anchor * (1 + partnerCount);
  return `$${total}+`;
}
