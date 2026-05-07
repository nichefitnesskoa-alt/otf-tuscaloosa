/**
 * Calendar helpers for public VIP confirmation page.
 * Builds Google Calendar URL and ICS blob with proper CT → UTC conversion.
 */
import { fromZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';

const TZ = 'America/Chicago';
const DURATION_MIN = 60;

export interface VipCalEvent {
  session_date: string; // YYYY-MM-DD
  session_time: string; // HH:MM[:SS]
  group_name?: string | null;
}

const TITLE = 'OTF Tuscaloosa VIP Class';
const LOCATION = 'OrangeTheory Fitness Tuscaloosa';
const DESCRIPTION =
  'Private group class. Arrive 15 minutes early for heart rate monitor setup.';

function getUtcRange(ev: VipCalEvent): { start: Date; end: Date } {
  const time = ev.session_time.length === 5 ? `${ev.session_time}:00` : ev.session_time;
  const localIso = `${ev.session_date}T${time}`;
  const start = fromZonedTime(localIso, TZ);
  const end = new Date(start.getTime() + DURATION_MIN * 60 * 1000);
  return { start, end };
}

const fmtUtc = (d: Date) => format(d, "yyyyMMdd'T'HHmmss'Z'");

export function buildGoogleCalendarUrl(ev: VipCalEvent): string {
  const { start, end } = getUtcRange(ev);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: TITLE,
    dates: `${fmtUtc(start)}/${fmtUtc(end)}`,
    details: DESCRIPTION,
    location: LOCATION,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildIcsBlob(ev: VipCalEvent): Blob {
  const { start, end } = getUtcRange(ev);
  const uid = `vip-${ev.session_date}-${ev.session_time.replace(/:/g, '')}@otf-tuscaloosa`;
  const dtstamp = fmtUtc(new Date());
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OTF Tuscaloosa//VIP//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${fmtUtc(start)}`,
    `DTEND:${fmtUtc(end)}`,
    `SUMMARY:${TITLE}`,
    `LOCATION:${LOCATION}`,
    `DESCRIPTION:${DESCRIPTION}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  return new Blob([ics], { type: 'text/calendar;charset=utf-8' });
}

export function downloadIcs(ev: VipCalEvent, filename = 'otf-vip-class.ics') {
  const blob = buildIcsBlob(ev);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
