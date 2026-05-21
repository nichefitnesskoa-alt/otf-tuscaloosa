// Default copy for the partner pitch deck. Used when a studio leaves a
// deck_* override blank in admin settings.

export const DEFAULT_DECK_COPY = {
  intro:
    "We build one giveaway together and push it across every platform. Your audience finds our members. Our members find your business. Everyone gets more reach than they would running it alone.",
  askPrize: (anchor: number) =>
    `A gift card or service. Match the value to the OTF membership (about $${anchor}) as closely as makes sense for you.`,
  askPromotion:
    "Post about the giveaway during the campaign. Repost our content when we tag you. Accept collaboration posts so we can co-author directly to your audience.",
  askClass:
    "Bring your team for one OTF class. We shoot it together and share it with both audiences.",
  askTime:
    "One call to lock in the details, the partners, and when we go live.",
} as const;

export function computeBundleTotal(anchor: number, partnerCount: number, override?: string | null): string {
  if (override && override.trim()) return override.trim();
  const total = anchor * (1 + partnerCount);
  return `$${total}+`;
}
