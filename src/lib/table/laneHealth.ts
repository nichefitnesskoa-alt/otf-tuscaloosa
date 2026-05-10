// Canonical Lane Health computation for The Table.
// Three binary inputs per Owner per meeting:
//   1. submitted_at not null and set before Sunday 23:59 CT
//   2. at least one TableResponse references one of their entries this meeting
//   3. at least one of their action items moved open -> in_progress/done since prior meeting
// Status: green = all 3, amber = 1-2, red = 0 or never submitted.

export type LaneHealthStatus = 'green' | 'amber' | 'red';

export interface LaneHealthInputs {
  submittedOnTime: boolean;
  receivedResponse: boolean;
  actionItemProgressed: boolean;
}

export function computeLaneHealth(i: LaneHealthInputs): LaneHealthStatus {
  const score = [i.submittedOnTime, i.receivedResponse, i.actionItemProgressed].filter(Boolean).length;
  if (score === 3) return 'green';
  if (score === 0) return 'red';
  return 'amber';
}

// Sunday 23:59 America/Chicago for the meeting week.
// meetingDate is YYYY-MM-DD (Monday). Returns the Sunday-night cutoff in ISO.
export function sundayCutoffISO(meetingDateYYYYMMDD: string): string {
  // Cutoff = meeting date - 1 day at 23:59 local CT.
  // We construct the ISO with -06:00 (CST) / -05:00 (CDT) approx by using UTC + offset trick:
  // Use a fixed approach: take Sunday at midnight CT next-day and subtract 1 minute.
  const [y, m, d] = meetingDateYYYYMMDD.split('-').map(Number);
  // Monday 00:00 CT = (Mon date) 06:00 UTC during CST, 05:00 UTC during CDT.
  // Use Intl to compute the offset for that date.
  const date = new Date(Date.UTC(y, m - 1, d, 6, 0, 0));
  const offsetMin = getChicagoOffsetMinutes(date);
  // Sunday 23:59 CT = Monday 00:00 CT - 1 min = (Monday 00:00 UTC + offset) - 1 min
  const monMidnightUTC = Date.UTC(y, m - 1, d, 0, 0, 0) + offsetMin * 60 * 1000;
  return new Date(monMidnightUTC - 60 * 1000).toISOString();
}

function getChicagoOffsetMinutes(d: Date): number {
  // Returns offset in minutes that you ADD to local CT time to get UTC. CST=360, CDT=300.
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    timeZoneName: 'short',
  });
  const parts = dtf.formatToParts(d);
  const tz = parts.find(p => p.type === 'timeZoneName')?.value ?? 'CST';
  return tz === 'CDT' ? 300 : 360;
}
