/**
 * My Day feature types.
 * UpcomingIntroItem is a flat, precomputed view model for the canonical intros queue.
 */

export type TimeRange = 'today' | 'restOfWeek';

export type QuestionnaireStatus = 'NO_Q' | 'Q_SENT' | 'Q_COMPLETED';

export interface RiskFlags {
  noQ: boolean;
  qIncomplete: boolean;
  unconfirmed: boolean;
  coachTbd: boolean;
  missingOwner: boolean;
}

export interface UpcomingIntroItem {
  bookingId: string;
  memberName: string;
  classDate: string; // YYYY-MM-DD
  introTime: string | null; // HH:MM
  coachName: string | null;
  introOwner: string | null;
  introOwnerLocked: boolean;
  phone: string | null;
  email: string | null;
  leadSource: string | null;
  isVip: boolean;
  vipClassName: string | null;
  questionnaireStatus: QuestionnaireStatus;
  qSentAt: string | null;
  qCompletedAt: string | null;
  confirmedAt: string | null;
  hasLinkedRun: boolean;
  latestRunResult: string | null;
  latestRunAt: string | null;
  originatingBookingId: string | null;
  isSecondIntro: boolean;

  // Computed (set by selectors)
  timeStartISO: string;
  riskFlags: RiskFlags;
  riskScore: number;
}

export interface DayGroup {
  date: string; // YYYY-MM-DD
  label: string;
  items: UpcomingIntroItem[];
  qSentRatio: number; // 0-1
}

export type RiskCategory = keyof RiskFlags;
