

## Plan: Print Card Overhaul + Screen Updates + B&W Print CSS

This is a large, multi-file change touching the print card layout, screen close sequence, coach view, database schema, and the script generator. Here is the full breakdown.

---

### 1. Database Migration
Add two new columns to `intros_booked`:
- `coach_brief_human_detail` (text, nullable)
- `coach_brief_why_moment` (text, nullable)

---

### 2. Print Card (`PrepDrawer.tsx` — print layout, lines 867-998)

**SPINE BAR** — Insert as the very first element on both halves, before the member name header:
- Black background, full width, white bold italic text with `printColorAdjust: 'exact'` and `WebkitPrintColorAdjust: 'exact'`
- Dynamic text using `firstName`: `"{firstName} leaves with a story worth telling — and eagerly asks us how to join before we can ask her."`
- SA half: Spine sentence only
- Coach half: Same sentence + second line in orange italic (screen) / bold black italic (print): `"Because a story worth telling becomes a referral we never had to ask for."`

**SA HALF — Remove Risk Free Guarantee block** (lines 903-907) from before the scissors line. Remove any pricing/membership mentions before the cut line.

**SA HALF — Add THE CLOSE after Dig Deeper, before scissors:**
Exact sequence: THE BRIDGE → THE IDENTITY QUESTION → IF THEY HESITATE (Risk Free Guarantee with 12-classes-in-30-days wording) → IF THEY RAISE PRICE ($7/day) → IF THEY RAISE SCHEDULE → Paperwork note.

**COACH HALF — Add STRUGGLE HOLD** between PRE-ENTRY and THE FOURTH QUARTER:
- Black background box with white bold label, `printColorAdjust: exact`
- Content: "Block 2 — hold back encouragement deliberately. No rescue. No coaching in." + "The valley before the peak is what makes the all-out land. Without it the callout is noise."

**COACH HALF — THE BRIEF box** — After the "Would come down to" / Gap line, add:
- `One human detail: ___________________________` (from `coach_brief_human_detail` column or blank line)

**COACH HALF — WHAT THEY TOLD US** — After all questionnaire fields, add:
- `Use their WHY at: ___________________________` (from `coach_brief_why_moment` column or blank dashed line) — bold label, dashed underline

**SPACING** — Reduce base font to 7.5px minimum where needed, tighten section margins, compress callout beats to single lines. Scissors line stays.

---

### 3. Screen SA Close Section (`PrepDrawer.tsx` — screen view)

**Remove standalone Risk Free Guarantee section** (lines 526-538) from SA prep screen.

**Update the EIRMA / after-class close section** to match the new Close sequence:
THE BRIDGE → THE IDENTITY QUESTION → IF THEY HESITATE (12 classes in 30 days) → IF THEY RAISE PRICE ($7/day) → IF THEY RAISE SCHEDULE → Paperwork.

Update `OBJECTION_TIPS` wording to reference 12-classes-in-30-days guarantee.

---

### 4. Coach Screen View (`CoachIntroCard.tsx`)

**Add STRUGGLE HOLD** section between PRE-ENTRY and THE FOURTH QUARTER:
- Dark background box with orange label (screen), matching the high-emphasis block treatment
- Same content as print

**Add new fields to THE BRIEF:**
- After Gap: `One human detail:` showing saved value or placeholder
- Load/save `coach_brief_human_detail` from booking

**Add to WHAT THEY TOLD US:**
- After all questionnaire fields: `Use their WHY at:` showing saved value or placeholder in orange
- Load/save `coach_brief_why_moment` from booking

**Update Edit Brief bottom sheet** to include both new fields as editable text areas.

**Update `CoachBooking` interface** to include the two new fields.

---

### 5. B&W Print CSS (`index.css`)

Add `@media print` overrides — screen colors stay unchanged:
- Orange beat labels (DRUMROLL, DURING, CALLOUT, etc.) → black, bold, all caps
- Struggle Hold box → black background, white bold label (already B&W)
- `Use their WHY at` field → bold black dashed underline
- `One human detail` field → standard black underline, bold label
- Shoutout YES/NO → black filled checkbox for YES, empty for NO
- Risk Free Guarantee box (in close) → thick 2px black border
- Raffle references → thick black border
- All orange text/borders → black equivalents via `@media print` selectors
- Verify `print-color-adjust: exact` on Spine and Struggle Hold black backgrounds

---

### 6. Script Generator (`supabase/functions/generate-script/index.ts`)

Update the `KOA_SYSTEM_PROMPT`:
- Risk Free Guarantee: change "consistently for 30 days" to "at least 12 classes within your first 30 days of Premier"
- Price reframe: change "$5/day" references to "$7/day"
- Remove any instruction about pricing in pre-class SA conversation

---

### 7. Other References

- `src/types/index.ts` line 124: Update `PROCESS_CHECKLIST` RFG wording if needed
- Verify no other files contain the old 30-day guarantee language

---

### Files Modified
| File | Change |
|---|---|
| `src/components/dashboard/PrepDrawer.tsx` | Spine bars, Close reorder, Struggle Hold, Brief fields, spacing compression, screen close update |
| `src/components/coach/CoachIntroCard.tsx` | Struggle Hold, new Brief fields, Edit Brief sheet update |
| `src/index.css` | B&W print CSS overrides |
| `supabase/functions/generate-script/index.ts` | Update guarantee + price wording |
| `src/types/index.ts` | Update RFG reference |
| DB migration | Add `coach_brief_human_detail`, `coach_brief_why_moment` to `intros_booked` |

