/**
 * Duplicate intro_run detection.
 *
 * Two runs for the same member on the same calendar date are almost always
 * a data-entry mistake (two SAs both logged the outcome, or a phantom
 * duplicate booking got its own run). The Alexa Brodsky bug came from
 * exactly this shape and inflated the conversion funnel by 1.
 *
 * A run is excluded from the audit if:
 *   - result_canon is DELETED (already soft-deleted)
 *   - result_canon is VIP_CLASS_INTRO (VIP runs intentionally isolated)
 *   - ignore_from_metrics is true
 *   - the row has no run_date AND no class_time (un-anchorable)
 */
export interface RunForAudit {
  id: string;
  member_name?: string | null;
  run_date?: string | null;
  result?: string | null;
  result_canon?: string | null;
  intro_owner?: string | null;
  sa_name?: string | null;
  coach_name?: string | null;
  commission_amount?: number | string | null;
  ignore_from_metrics?: boolean | null;
}

export interface DuplicateRunGroup {
  key: string;            // member_name|run_date
  member_name: string;
  run_date: string;
  runs: RunForAudit[];
}

const isExcluded = (r: RunForAudit): boolean => {
  const rc = (r.result_canon || '').toUpperCase();
  if (rc === 'DELETED' || rc === 'VIP_CLASS_INTRO') return true;
  if (r.ignore_from_metrics) return true;
  if (!r.member_name) return true;
  if (!r.run_date) return true;
  return false;
};

export function findDuplicateRunGroups(runs: RunForAudit[]): DuplicateRunGroup[] {
  const buckets = new Map<string, RunForAudit[]>();
  for (const r of runs) {
    if (isExcluded(r)) continue;
    const name = (r.member_name || '').trim().toLowerCase();
    const date = (r.run_date || '').trim();
    if (!name || !date) continue;
    const key = `${name}|${date}`;
    const arr = buckets.get(key) || [];
    arr.push(r);
    buckets.set(key, arr);
  }

  const groups: DuplicateRunGroup[] = [];
  for (const [key, arr] of buckets) {
    if (arr.length < 2) continue;
    groups.push({
      key,
      member_name: arr[0].member_name || '',
      run_date: arr[0].run_date || '',
      runs: arr,
    });
  }
  // Most recent dates first
  groups.sort((a, b) => (b.run_date || '').localeCompare(a.run_date || ''));
  return groups;
}
