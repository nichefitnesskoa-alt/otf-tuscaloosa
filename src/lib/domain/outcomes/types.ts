/**
 * Canonical types and normalizers for booking statuses and intro results.
 * ALL outcome logic across the app MUST use these types.
 */

// ── Canonical Enums ──

export type BookingStatus =
  | 'ACTIVE'
  | 'SECOND_INTRO_SCHEDULED'
  | 'NO_SHOW'
  | 'NOT_INTERESTED'
  | 'CLOSED_PURCHASED'
  | 'CLOSED_DIDNT_BUY'
  | 'CANCELLED'
  | 'DELETED_SOFT';

export type IntroResult =
  | 'PREMIER'
  | 'ELITE'
  | 'BASIC'
  | 'NO_SHOW'
  | 'DIDNT_BUY'
  | 'NOT_INTERESTED'
  | 'FOLLOW_UP_NEEDED'
  | 'SECOND_INTRO_SCHEDULED'
  | 'UNRESOLVED';

// ── Normalizers ──

const STATUS_MAP: Record<string, BookingStatus> = {
  'active': 'ACTIVE',
  'closed – bought': 'CLOSED_PURCHASED',
  'closed - bought': 'CLOSED_PURCHASED',
  'closed bought': 'CLOSED_PURCHASED',
  'closed_purchased': 'CLOSED_PURCHASED',
  'not interested': 'NOT_INTERESTED',
  'not_interested': 'NOT_INTERESTED',
  '2nd intro scheduled': 'SECOND_INTRO_SCHEDULED',
  'second_intro_scheduled': 'SECOND_INTRO_SCHEDULED',
  'no show': 'NO_SHOW',
  'no-show': 'NO_SHOW',
  'no_show': 'NO_SHOW',
  'cancelled': 'CANCELLED',
  'canceled': 'CANCELLED',
  'deleted (soft)': 'DELETED_SOFT',
  'deleted_soft': 'DELETED_SOFT',
  'closed – didnt buy': 'CLOSED_DIDNT_BUY',
  'closed_didnt_buy': 'CLOSED_DIDNT_BUY',
  'unscheduled': 'ACTIVE',
};

export function normalizeBookingStatus(input: string | null | undefined): BookingStatus {
  if (!input) return 'ACTIVE';
  const key = input.toLowerCase().trim();
  return STATUS_MAP[key] || 'ACTIVE';
}

const RESULT_MAP: Record<string, IntroResult> = {
  'no-show': 'NO_SHOW',
  'no show': 'NO_SHOW',
  'no_show': 'NO_SHOW',
  "didn't buy": 'DIDNT_BUY',
  'didnt_buy': 'DIDNT_BUY',
  'didnt buy': 'DIDNT_BUY',
  'not interested': 'NOT_INTERESTED',
  'not_interested': 'NOT_INTERESTED',
  'follow-up needed': 'FOLLOW_UP_NEEDED',
  'follow_up_needed': 'FOLLOW_UP_NEEDED',
  'booked 2nd intro': 'SECOND_INTRO_SCHEDULED',
  'second_intro_scheduled': 'SECOND_INTRO_SCHEDULED',
  'unresolved': 'UNRESOLVED',
};

export function normalizeIntroResult(input: string | null | undefined): IntroResult {
  if (!input) return 'UNRESOLVED';
  const key = input.toLowerCase().trim();
  if (RESULT_MAP[key]) return RESULT_MAP[key];
  // Check for membership sale keywords
  if (key.includes('premier')) return 'PREMIER';
  if (key.includes('elite')) return 'ELITE';
  if (key.includes('basic')) return 'BASIC';
  return 'UNRESOLVED';
}

// ── Predicates ──

export function isMembershipSaleResult(result: IntroResult): boolean {
  return result === 'PREMIER' || result === 'ELITE' || result === 'BASIC';
}

// ── Mappers ──

export function mapResultToBookingStatus(result: IntroResult): BookingStatus {
  switch (result) {
    case 'PREMIER':
    case 'ELITE':
    case 'BASIC':
      return 'CLOSED_PURCHASED';
    case 'NO_SHOW':
      return 'ACTIVE'; // keeps them available for rebooking
    case 'DIDNT_BUY':
      return 'ACTIVE';
    case 'NOT_INTERESTED':
      return 'NOT_INTERESTED';
    case 'SECOND_INTRO_SCHEDULED':
      return 'SECOND_INTRO_SCHEDULED';
    case 'FOLLOW_UP_NEEDED':
      return 'ACTIVE';
    case 'UNRESOLVED':
    default:
      return 'ACTIVE';
  }
}

// ── Display Formatters ──
// These produce the DB-stored string values for backward compat

const BOOKING_STATUS_DISPLAY: Record<BookingStatus, string> = {
  ACTIVE: 'Active',
  SECOND_INTRO_SCHEDULED: '2nd Intro Scheduled',
  NO_SHOW: 'Active',
  NOT_INTERESTED: 'Not Interested',
  CLOSED_PURCHASED: 'Closed – Bought',
  CLOSED_DIDNT_BUY: 'Active',
  CANCELLED: 'Cancelled',
  DELETED_SOFT: 'Deleted (soft)',
};

export function formatBookingStatusForDb(status: BookingStatus): string {
  return BOOKING_STATUS_DISPLAY[status] || 'Active';
}

export function formatIntroResultForDb(result: IntroResult, membershipType?: string): string {
  switch (result) {
    case 'PREMIER':
    case 'ELITE':
    case 'BASIC':
      return membershipType || result;
    case 'NO_SHOW':
      return 'No-show';
    case 'DIDNT_BUY':
      return "Didn't Buy";
    case 'NOT_INTERESTED':
      return 'Not interested';
    case 'FOLLOW_UP_NEEDED':
      return 'Follow-up needed';
    case 'SECOND_INTRO_SCHEDULED':
      return 'Booked 2nd intro';
    case 'UNRESOLVED':
    default:
      return 'Unresolved';
  }
}

// ── Utility ──

export function getTodayYMD(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
