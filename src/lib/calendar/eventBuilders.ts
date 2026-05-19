/**
 * Cross-platform calendar event builders for member-facing flows.
 * Converts Chicago-local date/time to UTC and produces:
 *  - .ics file content (with VALARM for native reminders)
 *  - Google Calendar render URL
 *
 * Used by the intro questionnaire and VIP confirmation pages.
 */
import { fromZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';

const TZ = 'America/Chicago';

export interface CalendarEventInput {
  date: string; // YYYY-MM-DD (Chicago local)
  time: string | null; // HH:MM or HH:MM:SS (Chicago local). Defaults to 09:00 if null.
  durationMin?: number; // default 60
  title: string;
  description: string;
  location: string;
  reminderMinutes?: number; // default 1440 (1 day)
}

function getUtcRange(input: CalendarEventInput): { start: Date; end: Date } {
  const raw = input.time || '09:00';
  const t = raw.length === 5 ? `${raw}:00` : raw;
  const localIso = `${input.date}T${t}`;
  const start = fromZonedTime(localIso, TZ);
  const end = new Date(start.getTime() + (input.durationMin ?? 60) * 60 * 1000);
  return { start, end };
}

const fmtUtc = (d: Date) => format(d, "yyyyMMdd'T'HHmmss'Z'");

export function buildIcs(input: CalendarEventInput): string {
  const { start, end } = getUtcRange(input);
  const uid = `otf-${input.date}-${(input.time || '0900').replace(/:/g, '')}-${Math.random().toString(36).slice(2, 8)}@otf-tuscaloosa`;
  const dtstamp = fmtUtc(new Date());
  const reminder = input.reminderMinutes ?? 1440;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OTF Tuscaloosa//Intro//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${fmtUtc(start)}`,
    `DTEND:${fmtUtc(end)}`,
    `SUMMARY:${input.title}`,
    `LOCATION:${input.location}`,
    `DESCRIPTION:${input.description.replace(/\n/g, '\\n')}`,
    'BEGIN:VALARM',
    `TRIGGER:-PT${reminder}M`,
    'ACTION:DISPLAY',
    `DESCRIPTION:${input.title}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

export function buildIcsDataUri(input: CalendarEventInput): string {
  const ics = buildIcs(input);
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

export function buildGoogleCalendarUrl(input: CalendarEventInput): string {
  const { start, end } = getUtcRange(input);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    dates: `${fmtUtc(start)}/${fmtUtc(end)}`,
    details: input.description,
    location: input.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export type Platform = 'ios' | 'android' | 'desktop';

export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function downloadIcs(input: CalendarEventInput, filename = 'otf-intro.ics') {
  const blob = new Blob([buildIcs(input)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
