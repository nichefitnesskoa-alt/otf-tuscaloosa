// User Types
export type UserRole = 'SA' | 'Coach' | 'Admin';

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

// Staff Data (alphabetically sorted)
export const COACHES = ['Bre', 'Elizabeth', 'James', 'Kaitlyn H', 'Nathan', 'Natalya'] as const;
export const SALES_ASSOCIATES = ['Bre', 'Bri', 'Elizabeth', 'Grace', 'Kailey', 'Katie', 'Kayla', 'Koa', 'Lauren', 'Nora', 'Sophie'] as const;
export const ALL_STAFF = [...COACHES, ...SALES_ASSOCIATES] as const;

export type StaffName = typeof ALL_STAFF[number];

// Lead Sources
export const LEAD_SOURCES = [
  'My Personal Friend I Invited',
  'Instagram DMs',
  'Referral',
  'Lead Management Call / Text',
  'Lead Management Web Lead Call',
  'B2B Partnership',
  'B2C Event',
  'Member brought friend',
  'Online Intro Offer (self-booked)',
  'Booked person brought them (Instagram)',
  'Booked person brought them (Lead Management)',
  'Source Not Found',
] as const;

export type LeadSource = typeof LEAD_SOURCES[number];

// Interest Levels
export const INTEREST_LEVELS = [
  'Very interested - Reach back out after break',
  'Interested - Forgot to answer, reach out later',
  'Booked intro',
  'Not interested',
] as const;

export type InterestLevel = typeof INTEREST_LEVELS[number];

// Lead Status
export type LeadStatus = 'not_booked' | 'booked' | 'no_show' | 'closed';

// IG Lead
export interface IGLead {
  id: string;
  saName: string;
  dateAdded: string;
  instagramHandle: string;
  firstName: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
  interestLevel: InterestLevel;
  notes?: string;
  status: LeadStatus;
  createdAt: string;
  updatedAt: string;
}

// Shift Types
export const SHIFT_TYPES = ['AM Shift', 'PM Shift', 'Mid Shift'] as const;
export type ShiftType = typeof SHIFT_TYPES[number];

// Membership Types with Commission
export const MEMBERSHIP_TYPES = [
  { label: 'Premier + OTBeat', commission: 15.00 },
  { label: 'Premier w/o OTBeat', commission: 7.50 },
  { label: 'Elite + OTBeat', commission: 12.00 },
  { label: 'Elite w/o OTBeat', commission: 6.00 },
  { label: 'Basic + OTBeat', commission: 9.00 },
  { label: 'Basic w/o OTBeat', commission: 3.00 },
  { label: 'Follow-up needed (no sale yet)', commission: 0 },
  { label: 'No-show (didn\'t attend)', commission: 0 },
] as const;

export type MembershipType = typeof MEMBERSHIP_TYPES[number]['label'];

// Booking Sources
export const BOOKING_SOURCES = [
  '1st Class Intro (staff booked)',
  '2nd Class Intro (staff booked)',
  'Comp Session (staff booked)',
  'Online Intro Offer (self-booked)',
  'Source Not Found',
] as const;

export type BookingSource = typeof BOOKING_SOURCES[number];

// Process Checklist Items
export const PROCESS_CHECKLIST = [
  'FVC (First Visit Card) completed',
  'RFG (Risk Free Guaranteed) presented',
  'Choice Architecture used',
] as const;

// Lead Measures
export const LEAD_MEASURES = [
  'Half way transition encouragement',
  'Pre Mobility Matrix congratulations',
  'Stay for stretching and summary',
  'Be at entire coach summary breakdown',
] as const;

// Intro Booked
export interface IntroBooked {
  id: string;
  memberName: string;
  classDate: string;
  coachName: string;
  saWorkingShift: string;
  fitnessGoal?: string;
  leadSource: LeadSource;
  linkedIGLeadId?: string;
}

// Intro Run
export interface IntroRun {
  id: string;
  memberName: string;
  classTime: string;
  bookingSource: BookingSource;
  processChecklist: string[];
  leadMeasures: string[];
  result: MembershipType;
  notes?: string;
  isSelfGen: boolean;
  claimedByIGLead?: string;
}

// Sale Outside Intro
export interface SaleOutsideIntro {
  id: string;
  memberName: string;
  leadSource: LeadSource;
  membershipType: MembershipType;
}

// Shift Recap
export interface ShiftRecap {
  id: string;
  staffName: string;
  date: string;
  shiftType: ShiftType;
  
  // Activity Tracking
  callsMade: number;
  textsSent: number;
  emailsSent: number;
  dmsSent: number;
  
  // Admin (Coaches Only)
  otbeatSales?: number;
  otbeatBuyerNames?: string;
  upgrades?: number;
  upgradeDetails?: string;
  downgrades?: number;
  downgradeDetails?: string;
  cancellations?: number;
  cancellationDetails?: string;
  freezes?: number;
  freezeDetails?: string;
  
  // Intros
  introsBooked: IntroBooked[];
  introsRun: IntroRun[];
  
  // Sales Outside Intro
  salesOutsideIntro: SaleOutsideIntro[];
  
  // Misc
  milestonesCelebrated?: string;
  equipmentIssues?: string;
  otherInfo?: string;
  
  // Metadata
  createdAt: string;
  submittedAt?: string;
}
