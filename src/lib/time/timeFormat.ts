/**
 * Safe time formatting utilities.
 * Always returns human-friendly 12-hour time. Never NaN.
 */

/**
 * Formats a time string to 12-hour display format.
 * Accepts "HH:mm", "H:mm", "HH:mm:ss", "h:mm AM/PM".
 * Returns "Time TBD" if invalid or empty.
 */
export function formatTime12h(timeStr: string | null | undefined): string {
  if (!timeStr) return 'Time TBD';
  const trimmed = timeStr.trim();
  if (!trimmed || /^(tbd|time\s*tbd)$/i.test(trimmed)) return 'Time TBD';

  // Already 12h format
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    const h = parseInt(ampmMatch[1], 10);
    const m = ampmMatch[2];
    const p = ampmMatch[3].toUpperCase();
    if (h >= 1 && h <= 12) return `${h}:${m} ${p}`;
    return 'Time TBD';
  }

  // 24h format: HH:mm or HH:mm:ss
  const h24Match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (h24Match) {
    let hours = parseInt(h24Match[1], 10);
    const minutes = h24Match[2];
    if (hours < 0 || hours > 23 || parseInt(minutes) > 59) return 'Time TBD';
    const period = hours >= 12 ? 'PM' : 'AM';
    if (hours === 0) hours = 12;
    else if (hours > 12) hours -= 12;
    return `${hours}:${minutes} ${period}`;
  }

  return 'Time TBD';
}

/**
 * Returns a safe "Class ended Xh ago" label or null.
 * Never produces NaN. Returns null if data is invalid or class hasn't ended.
 */
export function safeClassEndedLabel(
  classDateYmd: string | null,
  timeStr: string | null,
): string | null {
  if (!classDateYmd || !timeStr) return null;

  // Parse time
  const trimmed = timeStr.trim();
  let hours: number | null = null;
  let minutes: number | null = null;

  const h24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (h24) {
    hours = parseInt(h24[1], 10);
    minutes = parseInt(h24[2], 10);
  } else {
    const ampm = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (ampm) {
      hours = parseInt(ampm[1], 10);
      minutes = parseInt(ampm[2], 10);
      const p = ampm[3].toUpperCase();
      if (p === 'PM' && hours !== 12) hours += 12;
      if (p === 'AM' && hours === 12) hours = 0;
    }
  }

  if (hours === null || minutes === null || isNaN(hours) || isNaN(minutes)) return null;

  const [y, m, d] = classDateYmd.split('-').map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;

  const classStart = new Date(y, m - 1, d, hours, minutes, 0);
  if (isNaN(classStart.getTime())) return null;

  const classEnd = new Date(classStart.getTime() + 60 * 60 * 1000); // +60 min
  const now = new Date();
  if (now < classEnd) return null;

  const diffMs = now.getTime() - classEnd.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `Class ended ${diffMin}m ago`;
  const diffH = Math.round(diffMs / 3600000);
  if (diffH < 48) return `Class ended ${diffH}h ago`;
  return `Class ended ${Math.round(diffH / 24)}d ago`;
}
