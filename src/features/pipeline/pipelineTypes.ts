/**
 * Pipeline feature types.
 * PipelineRow is the view model for a single client journey row in the pipeline table.
 */
import type { BookingStatus, IntroResult } from '@/lib/domain/outcomes/types';

// Tab types matching the original ClientJourneyPanel
export type JourneyTab =
  | 'all'
  | 'upcoming'
  | 'today'
  | 'completed'
  | 'no_show'
  | 'missed_guest'
  | 'second_intro'
  | 'not_interested'
  | 'by_lead_source'
  | 'vip_class';

// Raw booking shape from Supabase (matches intros_booked select)
export interface PipelineBooking {
  id: string;
  booking_id: string | null;
  member_name: string;
  class_date: string;
  intro_time: string | null;
  coach_name: string;
  sa_working_shift: string;
  booked_by: string | null;
  lead_source: string;
  fitness_goal: string | null;
  booking_status: string | null;
  booking_status_canon: string;
  intro_owner: string | null;
  intro_owner_locked: boolean | null;
  originating_booking_id: string | null;
  vip_class_name: string | null;
  phone: string | null;
  email: string | null;
  is_vip: boolean;
  rebooked_from_booking_id: string | null;
  rebook_reason: string | null;
  rebooked_at: string | null;
  deleted_at: string | null;
}

// Raw run shape from Supabase (matches intros_run select)
export interface PipelineRun {
  id: string;
  run_id: string | null;
  member_name: string;
  run_date: string | null;
  class_time: string;
  result: string;
  result_canon: string;
  intro_owner: string | null;
  ran_by: string | null;
  lead_source: string | null;
  goal_quality: string | null;
  pricing_engagement: string | null;
  notes: string | null;
  commission_amount: number | null;
  linked_intro_booked_id: string | null;
  coach_name: string | null;
  goal_why_captured: string | null;
  relationship_experience: string | null;
  made_a_friend: boolean | null;
  buy_date: string | null;
  sa_name: string | null;
}

// Aggregated journey view model
export interface ClientJourney {
  memberKey: string;
  memberName: string;
  bookings: PipelineBooking[];
  runs: PipelineRun[];
  hasInconsistency: boolean;
  inconsistencyType: string | null;
  hasSale: boolean;
  totalCommission: number;
  latestIntroOwner: string | null;
  status: 'active' | 'purchased' | 'not_interested' | 'no_show' | 'unknown';
}

// Tab counts
export interface TabCounts {
  all: number;
  upcoming: number;
  today: number;
  completed: number;
  no_show: number;
  missed_guest: number;
  second_intro: number;
  not_interested: number;
  by_lead_source: number;
  vip_class: number;
}

// Touch summary per booking
export interface TouchSummary {
  count: number;
  lastTouchAt: string | null;
  todayCount: number;
}

// VIP info
export interface VipInfo {
  birthday: string | null;
  weight_lbs: number | null;
}
