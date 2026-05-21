// Single source of truth for all winner-structure-dependent copy.
// Used by partner deck slide 2, slide 3, and the participant entry form.

import type { WinnerStructure } from './winnerStructure';

export type { WinnerStructure };

const SLIDE2: Record<WinnerStructure, { headline: string; body: string }> = {
  single: {
    headline: 'One big prize. Every brand wins.',
    body:
      'We build one giveaway together and push it across every platform. Your audience finds our members. Our members find your business. One person wins the whole bundle. The bigger the prize, the more people enter. Everyone gets more reach than they would running it alone.',
  },
  per_prize_with_removal: {
    headline: 'One big giveaway. Every business wins.',
    body:
      "We pool our audiences and run one campaign together. Each business brings a prize. Each prize has its own winner. Once someone wins, they step out of the pool so the next draw goes to someone new. More winners means more people who actually got something, and more word of mouth for every business in the bundle.",
  },
  per_prize_allow_repeat: {
    headline: 'One big giveaway. Every business wins.',
    body:
      'We pool our audiences and run one campaign together. Each business brings a prize. Each prize has its own winner. The same person could win more than once, which gives people a reason to enter as many actions as possible. More entries means more reach for everyone.',
  },
};

function norm(ws: WinnerStructure | null | undefined): WinnerStructure {
  return (ws as WinnerStructure) ?? 'single';
}

function clean(v: string | null | undefined): string {
  return (v ?? '').trim();
}

export function getDeckSlide2(
  ws: WinnerStructure | null | undefined,
  headlineOverride?: string | null,
  bodyOverride?: string | null,
): { headline: string; body: string } {
  const auto = SLIDE2[norm(ws)] ?? SLIDE2.single;
  const h = clean(headlineOverride);
  const b = clean(bodyOverride);
  return {
    headline: h.length ? h : auto.headline,
    body: b.length ? b : auto.body,
  };
}

export interface DeckSlide3Framing {
  headline: string;
  bundleSubtext: string;
  showWinnerBadgePerRow: boolean;
  footerLine: string;
  footerStyle: 'brand' | 'muted';
}

export function getDeckSlide3Framing(
  ws: WinnerStructure | null | undefined,
): DeckSlide3Framing {
  switch (norm(ws)) {
    case 'per_prize_with_removal':
      return {
        headline: 'One prize each. Every business represented.',
        bundleSubtext: "Separate winner for each prize. Winners can't win twice.",
        showWinnerBadgePerRow: true,
        footerLine:
          "Each prize goes to a different winner. Once you win, you're out of the pool.",
        footerStyle: 'muted',
      };
    case 'per_prize_allow_repeat':
      return {
        headline: 'One prize each. Every business represented.',
        bundleSubtext:
          'Separate winner for each prize. Same person can win more than once.',
        showWinnerBadgePerRow: true,
        footerLine:
          'Each prize goes to its own winner. The same person could win more than once.',
        footerStyle: 'muted',
      };
    case 'single':
    default:
      return {
        headline: 'One bundle, built together.',
        bundleSubtext: 'One winner takes everything.',
        showWinnerBadgePerRow: false,
        footerLine: 'Everything goes to one winner.',
        footerStyle: 'brand',
      };
  }
}

export interface EntryFormPrizeFraming {
  showWinnerBadgeOnCards: boolean;
  bannerText: string;
  winnerRuleStatement: string;
}

export function getEntryFormPrizeFraming(
  ws: WinnerStructure | null | undefined,
): EntryFormPrizeFraming {
  switch (norm(ws)) {
    case 'per_prize_with_removal':
      return {
        showWinnerBadgeOnCards: true,
        bannerText: 'Every prize has its own winner.',
        winnerRuleStatement:
          "One winner drawn per prize. Win once and you're out of the pool for the remaining draws.",
      };
    case 'per_prize_allow_repeat':
      return {
        showWinnerBadgeOnCards: true,
        bannerText: 'Every prize has its own winner.',
        winnerRuleStatement:
          'One winner drawn per prize. The same person can win more than once.',
      };
    case 'single':
    default:
      return {
        showWinnerBadgeOnCards: false,
        bannerText: 'One winner takes the whole bundle.',
        winnerRuleStatement: 'One winner will be drawn to receive all prizes.',
      };
  }
}
