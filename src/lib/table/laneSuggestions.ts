// Pre-populated Lane suggestions. Free-text — Koa can override anything.
export const LANE_CATEGORIES = [
  'Content and Brand',
  'Member Experience',
  'Leads and Growth',
  'Coaching and Development',
  'Operations and Culture',
] as const;

export const LANE_SUGGESTIONS: { lane: string; category: string; description: string }[] = [
  { lane: 'Brand Voice Owner', category: 'Content and Brand', description: 'Owns strategy, voice, and growth across all social channels.' },
  { lane: 'IG Owner', category: 'Content and Brand', description: 'Posting cadence, tone, and growth on Instagram.' },
  { lane: 'TikTok Owner', category: 'Content and Brand', description: 'Trends, filming, and TikTok presence.' },
  { lane: 'Story Owner', category: 'Content and Brand', description: 'Member spotlights, transformations, behind-the-scenes.' },
  { lane: 'Space Owner', category: 'Content and Brand', description: 'Every physical sign, decoration, and visual element in the building.' },
  { lane: 'Moments Owner', category: 'Content and Brand', description: 'Monthly studio calendar — every month has a moment worth talking about.' },
  { lane: 'First 30 Owner', category: 'Member Experience', description: 'First 30 days of every new member. Check-ins, milestones, handoff.' },
  { lane: 'Retention Owner', category: 'Member Experience', description: 'At-risk outreach and the conversations before someone cancels.' },
  { lane: 'Referral Owner', category: 'Member Experience', description: 'Referral program, leaderboard, recognition, follow-through.' },
  { lane: 'VIP Owner', category: 'Leads and Growth', description: 'Execution and quality of every VIP class start to finish.' },
  { lane: 'Outreach Owner', category: 'Leads and Growth', description: 'University, corporate, and community partnerships.' },
  { lane: 'Partnership Owner', category: 'Leads and Growth', description: 'Active business partnerships kept warm week to week.' },
  { lane: 'Challenge Owner', category: 'Coaching and Development', description: 'Every OTF and studio-original challenge.' },
  { lane: 'Standards Owner', category: 'Operations and Culture', description: 'Cleanliness, equipment, physical standard of the space.' },
  { lane: 'Culture Owner', category: 'Operations and Culture', description: 'Team energy, peer recognition, birthdays, back-of-house feeling.' },
];
