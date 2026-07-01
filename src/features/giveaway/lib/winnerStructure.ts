import { Trophy, ListChecks, Repeat } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type WinnerStructure =
  | 'single'
  | 'per_prize_with_removal'
  | 'per_prize_allow_repeat';

export interface WinnerStructureOption {
  value: WinnerStructure;
  title: string;
  subtitle: string;
  icon: LucideIcon;
}

export const WINNER_STRUCTURE_OPTIONS: WinnerStructureOption[] = [
  {
    value: 'single',
    title: 'One Grand Prize Winner',
    subtitle: 'One person wins one month of free unlimited OrangeTheory Fitness membership and all partner prizes.',
    icon: Trophy,
  },
  {
    value: 'per_prize_with_removal',
    title: 'One Winner Per Prize — No Repeats',
    subtitle: "Draw separately for each prize. Once someone wins, they're removed from the pool and cannot win again.",
    icon: ListChecks,
  },
  {
    value: 'per_prize_allow_repeat',
    title: 'One Winner Per Prize — Can Win Multiple',
    subtitle: 'Draw separately for each prize. The same person could win more than one prize.',
    icon: Repeat,
  },
];

export function getDrawRuleStatement(ws: WinnerStructure | null | undefined): string {
  switch (ws) {
    case 'per_prize_with_removal':
      return 'First come, first serve — whoever we spin first picks any remaining prize. No one wins twice.';
    case 'per_prize_allow_repeat':
      return 'First come, first serve — whoever we spin first picks any remaining prize. The same person can win more than one.';
    case 'single':
    default:
      return 'One winner takes all prizes.';
  }
}

export function isPerPrize(ws: WinnerStructure | null | undefined): boolean {
  return ws === 'per_prize_with_removal' || ws === 'per_prize_allow_repeat';
}

export function removesWinners(ws: WinnerStructure | null | undefined): boolean {
  return ws === 'per_prize_with_removal';
}
