

## Plan: Add Raffle Page to Admin Panel

### Overview
Create a standalone Raffle page component and add it as a new tab in the Admin panel dropdown. Admin-only access. Session-only state — no database needed.

### Files Changed

**1. `src/components/admin/RafflePage.tsx`** (new)

Full raffle component with three sections:
- **Names Input**: textarea (160px height), real-time count of parsed names
- **Prize Input**: single text input
- **Spin Area**: drum-style slot machine animation (420×80px, #E8540A border), deceleration easing over 3.5s, 40 items with winner forced last, translateY animation
- **Winners Log**: draw number, name (bold), prize (muted), newest first, remaining count

State management:
- `names` (textarea value), `parsedNames` (full pool), `remaining` (draw pool), `prize`, `winners` array, `spinning` boolean, `currentWinner`
- Editing textarea resets winners and remaining
- Winner removed from remaining after each draw
- "Spin again" resets display back to drum, keeps prize

Animation: render 40 random names from remaining in a vertical strip at 80px each, animate translateY to -(39×80)px over 3.5s with cubic-bezier(0.25, 0.1, 0.1, 1). Last item = selected winner.

**2. `src/pages/Admin.tsx`**

- Import `RafflePage` from `@/components/admin/RafflePage`
- Add `{ value: 'raffle', label: 'Raffle', icon: <Gift className="w-4 h-4" /> }` to `adminSections` array (import `Gift` from lucide-react)
- Add `<TabsContent value="raffle"><RafflePage /></TabsContent>` after the 10x tab

### No downstream effects
Session-only feature. No database. No other pages affected. Admin role already enforced by the existing route guard + in-page role check.

