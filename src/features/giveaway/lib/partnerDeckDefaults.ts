// Default copy for the partner pitch deck. Used when a studio leaves a
// deck_* override blank in admin settings.

import type { WinnerStructure } from './winnerStructure';

export const SLIDE2_AUTO_COPY: Record<WinnerStructure, string> = {
  single:
    'We build one giveaway together and push it across every platform. Your audience finds our members. Our members find your business. One winner takes the whole bundle.',
  per_prize_with_removal:
    'We build one giveaway together and push it across every platform. Each business has its own prize and its own winner. More chances to win means more people enter.',
  per_prize_allow_repeat:
    'We build one giveaway together and push it across every platform. Each business has its own prize and its own winner. The same person could win more than once.',
};

export function slide2AutoCopy(ws: WinnerStructure | null | undefined): string {
  return SLIDE2_AUTO_COPY[(ws as WinnerStructure) ?? 'single'] ?? SLIDE2_AUTO_COPY.single;
}

export const DEFAULT_DECK_COPY = {
  intro: SLIDE2_AUTO_COPY.single,
  askPrize: (anchor: number) =>
    `A gift card or service. Match the value to the OTF membership (about $${anchor}) as closely as makes sense for you.`,
  askPromotion:
    "Post about the giveaway during the campaign. Repost our content when we tag you. Accept collaboration posts so we can co-author directly to your audience.",
  askClass:
    "Bring your team for one OTF class. We shoot it together and share it with both audiences.",
  askTime:
    "One call to lock in the details, the partners, and when we go live.",
} as const;

export const DEFAULT_DECK = {
  s2_headline: 'One big prize. Every brand wins.',
  s3_headline: 'One bundle, built together.',
  s3_value_note: '', // auto from anchor
  s4_headline: 'Built around your month.',
  s4_subtext: 'Giveaway windows run 7, 10, or 14 days. We settle on the right one when we talk.',
  s4_phase1_title: 'Build the story first.',
  s4_phase1_body: 'We come to your business and shoot real content. You bring your team to OTF for a class. We document both. Your audience sees what the partnership actually looks like before the giveaway starts.',
  s4_phase1_tag: 'Early in the month',
  s4_phase2_title: 'Giveaway goes live.',
  s4_phase2_body: "Everyone pushes it. Social, stories, in-store, email. The entry tracker runs in real time so you can see how it's going.",
  s4_phase2_tag: 'Final stretch of the month',
  s4_phase3_title: 'Winner. Documented.',
  s4_phase3_body: 'We follow the winner to every business and shoot the whole thing. That content keeps working long after the giveaway closes.',
  s4_phase3_tag: 'End of the month',
  s5_headline: 'Content-first, from day one.',
  s5_c1_title: 'We come to you first.',
  s5_c1_body: 'Real content from your business. No scripts. We show your audience what makes you worth following.',
  s5_c2_title: 'Your team at OTF.',
  s5_c2_body: 'One class, shot together. Your audience sees the human side of the partnership.',
  s5_c3_title: "The winner's journey.",
  s5_c3_body: 'We follow the winner to every business. Real people, real payoff. Shared everywhere.',
  s5_c4_title: 'Pushed across every platform.',
  s5_c4_body: 'Every partner promotes. Your brand reaches audiences that had no idea you existed.',
  s6_headline: 'Built in. Live from day one.',
  s6_body: 'Entries are tracked in real time. You can see exactly how many people entered because of your business. Any time.',
  s6_note: 'Customizable per studio, per partner, per campaign.',
  s7_headline: 'Easy to enter. Hard to ignore.',
  s8_headline: 'A simple ask. A real return.',
  s9_headline: 'Want in?',
  s9_subline: "Let's talk.",
  s9_body: "This works because everyone in it is actually invested. If it sounds like a fit, reach out. We'll take it from there.",
} as const;

export function computeBundleTotal(anchor: number, partnerCount: number, override?: string | null): string {
  if (override && override.trim()) return override.trim();
  const total = anchor * (1 + partnerCount);
  return `$${total}+`;
}

// Pick first non-empty value, fall back to default
export function pick(value: string | null | undefined, fallback: string): string {
  const v = (value ?? '').trim();
  return v.length ? v : fallback;
}
