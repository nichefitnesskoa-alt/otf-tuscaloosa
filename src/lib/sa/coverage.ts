/**
 * Canonical coverage helper. Single source of truth for milestone-coverage %
 * computed from honor-system shift reports. Used by SA leaderboard, SA detail,
 * and the close-out form so any number on Page A equals the same number on Page B.
 */
export interface ShiftCoverageReport {
  id: string;
  sa_name: string;
  shift_date: string; // YYYY-MM-DD
  shift_type: string;
  milestones_celebrated: number;
  milestones_missed: number;
  notes: string | null;
}

export interface CoverageTotals {
  celebrated: number;
  missed: number;
  /** null when no reports OR celebrated+missed = 0 (avoid divide-by-zero displaying 0%) */
  pct: number | null;
  reportedShifts: number;
}

export function computeCoverage(reports: ShiftCoverageReport[]): CoverageTotals {
  let celebrated = 0;
  let missed = 0;
  for (const r of reports) {
    celebrated += r.milestones_celebrated || 0;
    missed += r.milestones_missed || 0;
  }
  const denom = celebrated + missed;
  return {
    celebrated,
    missed,
    pct: reports.length === 0 || denom === 0 ? null : (celebrated / denom) * 100,
    reportedShifts: reports.length,
  };
}

export function formatCoveragePct(pct: number | null): string {
  if (pct == null) return '—';
  return `${Math.round(pct)}%`;
}
