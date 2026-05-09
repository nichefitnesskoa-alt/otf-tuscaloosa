import { describe, expect, it } from 'vitest';
import { findDuplicateRunGroups, type RunForAudit } from '../duplicateRuns';

const r = (o: Partial<RunForAudit> & { id: string }): RunForAudit => ({
  member_name: 'Alexa Brodsky',
  run_date: '2026-05-01',
  result: 'Follow-up needed',
  result_canon: 'FOLLOW_UP_NEEDED',
  ...o,
});

describe('findDuplicateRunGroups', () => {
  it('flags two runs for same member + same date', () => {
    const groups = findDuplicateRunGroups([
      r({ id: '1' }),
      r({ id: '2', result_canon: 'SECOND_INTRO_SCHEDULED' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].runs).toHaveLength(2);
  });

  it('does not flag runs on different dates', () => {
    expect(
      findDuplicateRunGroups([r({ id: '1' }), r({ id: '2', run_date: '2026-05-02' })]),
    ).toHaveLength(0);
  });

  it('ignores already-deleted runs', () => {
    expect(
      findDuplicateRunGroups([
        r({ id: '1' }),
        r({ id: '2', result_canon: 'DELETED' }),
      ]),
    ).toHaveLength(0);
  });

  it('ignores VIP class runs', () => {
    expect(
      findDuplicateRunGroups([
        r({ id: '1', result_canon: 'VIP_CLASS_INTRO' }),
        r({ id: '2', result_canon: 'VIP_CLASS_INTRO' }),
      ]),
    ).toHaveLength(0);
  });

  it('ignores runs flagged ignore_from_metrics', () => {
    expect(
      findDuplicateRunGroups([
        r({ id: '1' }),
        r({ id: '2', ignore_from_metrics: true }),
      ]),
    ).toHaveLength(0);
  });

  it('matches member name case-insensitively', () => {
    expect(
      findDuplicateRunGroups([
        r({ id: '1', member_name: 'Alexa Brodsky' }),
        r({ id: '2', member_name: 'alexa brodsky' }),
      ]),
    ).toHaveLength(1);
  });

  it('returns each duplicate group separately', () => {
    const groups = findDuplicateRunGroups([
      r({ id: '1' }),
      r({ id: '2' }),
      r({ id: '3', member_name: 'Mike Smith', run_date: '2026-05-04' }),
      r({ id: '4', member_name: 'Mike Smith', run_date: '2026-05-04' }),
    ]);
    expect(groups).toHaveLength(2);
  });
});
