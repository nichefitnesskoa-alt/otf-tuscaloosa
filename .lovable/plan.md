

# Shoutout Bar Interactivity + Label Rename

## Summary
Two changes: (1) Make the shoutout consent bar visually interactive with state-specific colors, action text, and a chevron icon. Dim post-class shoutout toggles when consent is No. (2) Rename "Referral Asks" to "POS Referral Ask" in the WIG SA Lead Measures table.

## File Changes

### 1. `src/components/shared/TheirStory.tsx`

**Shoutout bar overhaul (lines 224-243):**
- Change `consentLabel` and `consentBg` logic:
  - `null` → amber `#F59E0B`, text: "Shoutout — tap to set"
  - `false` → orange `#E8540A`, text: "Shoutout: NO — tap to change"
  - `true` → green (Tailwind `#22c55e`), text: "Shoutout: YES — tap to change"
- Add `ChevronRight` icon (white, 16px) on the right side of the bar
- Keep `cursor-pointer` and existing `stopPropagation` + `toggleConsent` logic
- Change "Saved" flash duration from 2s to 1s
- Import `ChevronRight` from lucide-react

**Export consent state:** Add a callback prop `onConsentChange?: (val: boolean | null) => void` that fires after consent is saved, so CoachIntroCard can track consent for dimming post-class toggles.

### 2. `src/components/coach/CoachIntroCard.tsx`

**Dim shoutout toggles when consent is No:**
- Add state `consentValue` tracking shoutout_consent from the booking prop
- Pass `onConsentChange` to TheirStory to update `consentValue` on toggle
- On the two shoutout start/end ToggleFields (lines 218-219), apply `opacity-50` class when `consentValue === false`
- Toggles remain functional (not disabled), just visually dimmed as a reminder

### 3. `src/pages/Wig.tsx`

**Label rename (line 540):**
- Change `"Referral Asks"` → `"POS Referral Ask"`

### 4. Cognitive load audit — no additional changes needed
- Toggle switches already have Yes/No labels flanking them
- Card headers already have chevron icons via `CollapsibleSection`
- Zone 2 fields already have visible borders (Textarea component)
- Shift selector buttons already have border and hover states
- The shoutout bar fix in this prompt is the main offender — fixed above

## Technical Details
- Consent cycling stays: `null → true → false → true → false...`
- The `flashSaved` timeout changes from 2000ms to 1000ms for the shoutout field only
- No database changes needed
- No changes to any other page or component

