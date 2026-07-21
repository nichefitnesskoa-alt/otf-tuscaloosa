/**
 * Canonical roster helper for stat-display surfaces.
 *
 * PROBLEM this solves:
 *   `is_active` on `staff` gates LOGIN and PICKERS (SA/coach dropdowns,
 *   evaluator lists, booking assignment). It must NOT also gate historical
 *   stat display. Before this helper existed, WIG and Studio surfaces
 *   filtered rows by `useActiveStaff().salesAssociates`, which silently
 *   dropped every intro/sale/scorecard attributed to a deactivated staff
 *   member the moment `is_active` was flipped false. That erased history.
 *
 * RULE (single source of truth for every stat-display roster):
 *   Displayed roster = active display roster
 *                    ∪ (inactive staff whose names appear in the data
 *                       being rendered for the selected date range).
 *   Inactive staff show their real stats with a subtle "inactive" tag.
 *
 * Pickers/login/assignment surfaces stay active-only via `useActiveStaff`.
 */
import { useMemo } from 'react';
import { useAllStaff, type StaffRow } from '@/hooks/useAllStaff';

export interface RosterInRange {
  /** Names to render, in the caller-provided display order,
   *  with inactive-with-data appended at the end alphabetically. */
  names: string[];
  /** Names in `names` that are inactive in `staff` — show an "inactive" tag. */
  inactiveNames: Set<string>;
  loading: boolean;
}

/**
 * @param displayActive The already-computed active display roster (e.g.
 *   `displayRoster` from `useEffectiveSglTargets` / `useSomlEffectiveTargets`).
 * @param dataNames Names that appear in the data for the current date range
 *   (intros, sales, sourced leads, scorecards — union of whatever the
 *   caller renders).
 */
export function useRosterWithDataInRange(
  displayActive: readonly string[],
  dataNames: readonly string[],
): RosterInRange {
  const { staff, loading } = useAllStaff();

  return useMemo(() => {
    const inactiveByName = new Map<string, StaffRow>();
    for (const s of staff) {
      if (!s.is_active) inactiveByName.set(s.name, s);
    }
    const activeSet = new Set(displayActive);
    const dataSet = new Set(dataNames);

    const extra: string[] = [];
    const inactiveNames = new Set<string>();
    for (const name of dataSet) {
      if (activeSet.has(name)) continue;
      if (inactiveByName.has(name)) {
        extra.push(name);
        inactiveNames.add(name);
      }
    }
    extra.sort((a, b) => a.localeCompare(b));

    return {
      names: [...displayActive, ...extra],
      inactiveNames,
      loading,
    };
  }, [staff, displayActive, dataNames, loading]);
}
