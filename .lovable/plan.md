## Reorder MyDay sections

Move the Activity Tracker (Calls/Texts/DMs) and the internal Tabs block (Intros/Leads/Follow-Up/Scripts) so they sit directly above Upcoming Intros.

### New order in `src/features/myDay/MyDayPage.tsx`

1. Today's Actions
2. Shift Checklist
3. **Activity Tracker** (`MyDayShiftSummary`) — moved up
4. **Tabs block** (Intros / Leads / Follow-Up / Scripts with content) — moved up
5. Upcoming Intros
6. Class Milestone Checks
7. Referral Asks
8. Floating End Shift bar (unchanged)

### Implementation

Single file: `src/features/myDay/MyDayPage.tsx`

- Cut the `MyDayShiftSummary` wrapper and the entire `<Tabs>…</Tabs>` block from their current positions (after Referral Asks).
- Paste them immediately after the Shift Checklist wrapper, before `UpcomingIntrosCard`.
- No logic, state, or prop changes. Pure JSX reorder.

### Verification

- Visual: Tabs sit right under Shift Checklist; Upcoming Intros appears below the tabs; Class Milestones and Referral Asks remain below Upcoming Intros.
- Functional: Tab switching, badges, sticky tab bar, FAB, End Shift bar all behave the same.
