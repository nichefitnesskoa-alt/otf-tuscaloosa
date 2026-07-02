/**
 * Intro Scheduler calendar helpers.
 *
 * Builds .ics files and Google Calendar URLs for a newly booked intro class.
 * All times are treated as America/Chicago local (never new Date(string)).
 *
 * Class length is 60 minutes (confirmed by Koa 2026-07-02).
 * Arrival time = class start − 30 min.
 * VALARM: 1 day before + same-day 2 hours before.
 */

export interface IntroCalendarEvent {
  classDate: string;   // YYYY-MM-DD
  classTime: string;   // HH:mm (24h, Chicago local)
  memberFirstName: string;
  coachName?: string | null; // if null/empty → "your coach"
}

const CLASS_LENGTH_MIN = 60;
const ARRIVAL_LEAD_MIN = 30;

/** Parse a local YYYY-MM-DD + HH:mm as a Date IN America/Chicago and return
 *  the corresponding UTC Date. Uses the Intl offset lookup — no new Date(string). */
function chicagoLocalToUtc(ymd: string, hhmm: string): Date {
  const [y, m, d] = ymd.split('-').map(n => parseInt(n, 10));
  const [h, mi] = hhmm.split(':').map(n => parseInt(n, 10));
  // Build a naive UTC guess, then correct by the Chicago offset at that instant.
  const guess = new Date(Date.UTC(y, m - 1, d, h, mi, 0));
  // Figure out what Chicago thinks the wall time of `guess` is, and shift by the delta.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(guess);
  const get = (t: string) => parseInt(parts.find(p => p.type === t)!.value, 10);
  const chicagoWall = Date.UTC(get('year'), get('month') - 1, get('day'),
    get('hour') === 24 ? 0 : get('hour'), get('minute'), get('second'));
  const offsetMs = guess.getTime() - chicagoWall;
  return new Date(guess.getTime() + offsetMs);
}

function toIcsUtc(d: Date): string {
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

function formatArrivalDisplay(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(n => parseInt(n, 10));
  let total = h * 60 + m - ARRIVAL_LEAD_MIN;
  if (total < 0) total += 24 * 60;
  const ah = Math.floor(total / 60);
  const am = total % 60;
  const period = ah >= 12 ? 'PM' : 'AM';
  const dh = ah % 12 === 0 ? 12 : ah % 12;
  return `${dh}:${am.toString().padStart(2, '0')} ${period}`;
}

function formatClassTimeDisplay(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(n => parseInt(n, 10));
  const period = h >= 12 ? 'PM' : 'AM';
  const dh = h % 12 === 0 ? 12 : h % 12;
  return `${dh}:${m.toString().padStart(2, '0')} ${period}`;
}

function formatDayDisplay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(n => parseInt(n, 10));
  const local = new Date(y, m - 1, d);
  return local.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function buildIntroCalendarDescription(ev: IntroCalendarEvent): string {
  const arrival = formatArrivalDisplay(ev.classTime);
  const coach = ev.coachName?.trim() || 'your coach';
  return [
    `Come at ${arrival}, 30 minutes before class, for a quick tour, your heart rate`,
    `monitor setup, and to meet ${coach}. They'll show you how the class works.`,
    `We also offer a complimentary InBody scan that shows you your muscle composition.`,
    `See you there!`,
  ].join(' ');
}

export function buildIntroIcs(ev: IntroCalendarEvent): string {
  const start = chicagoLocalToUtc(ev.classDate, ev.classTime);
  const end = new Date(start.getTime() + CLASS_LENGTH_MIN * 60_000);
  const dtStart = toIcsUtc(start);
  const dtEnd = toIcsUtc(end);
  const dtStamp = toIcsUtc(new Date());
  const uid = `intro-${ev.classDate.replace(/-/g, '')}-${ev.classTime.replace(':', '')}-${Math.random().toString(36).slice(2, 10)}@otf-tuscaloosa`;
  const dayLabel = formatDayDisplay(ev.classDate);
  const timeLabel = formatClassTimeDisplay(ev.classTime);
  const title = `OrangeTheory Intro — ${dayLabel}, ${timeLabel}`;
  const desc = buildIntroCalendarDescription(ev).replace(/\n/g, '\\n').replace(/,/g, '\\,');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OTF Tuscaloosa//Intro Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${desc}`,
    'LOCATION:OrangeTheory Fitness Tuscaloosa',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:OrangeTheory Intro tomorrow',
    'TRIGGER:-P1D',
    'END:VALARM',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:OrangeTheory Intro in 2 hours',
    'TRIGGER:-PT2H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadIntroIcs(ev: IntroCalendarEvent): void {
  const ics = buildIntroIcs(ev);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `otf-intro-${ev.classDate}-${ev.classTime.replace(':', '')}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function buildGoogleCalendarUrl(ev: IntroCalendarEvent): string {
  const start = chicagoLocalToUtc(ev.classDate, ev.classTime);
  const end = new Date(start.getTime() + CLASS_LENGTH_MIN * 60_000);
  const dtStart = toIcsUtc(start);
  const dtEnd = toIcsUtc(end);
  const dayLabel = formatDayDisplay(ev.classDate);
  const timeLabel = formatClassTimeDisplay(ev.classTime);
  const title = `OrangeTheory Intro — ${dayLabel}, ${timeLabel}`;
  const desc = buildIntroCalendarDescription(ev);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${dtStart}/${dtEnd}`,
    details: desc,
    location: 'OrangeTheory Fitness Tuscaloosa',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
