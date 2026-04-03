

# Name Field Autocomplete — Search Pipeline & Members

## Summary
Create a reusable `NameAutocomplete` component that searches across `intros_booked` (members), `leads`, and `ig_leads` tables, returning name suggestions as the user types. Apply it to all name-input fields where you're referencing a person — referral fields, coach pairing field, and friend name fields. Users can still type a new name if no match is found.

## New Component

### `src/components/shared/NameAutocomplete.tsx`
A lightweight autocomplete input that:
- Debounces input (300ms), searches when 2+ characters typed
- Queries `intros_booked.member_name`, `leads.name`, and `ig_leads.full_name` with case-insensitive partial matching (`.ilike('%term%')`)
- Deduplicates results by normalized name
- Shows a dropdown with matching names, each with a small context badge (e.g., "Member", "Lead", "IG Lead")
- Selecting a name fills the input — no other side effects
- If no match, the user keeps typing freely — no blocking
- Props: `value`, `onChange`, `placeholder`, `className`, `disabled`, `id`, `autoFocus`
- Uses Popover + Command pattern (same as `ClientNameAutocomplete` but simpler — returns a string, not a full client object)

## Files to Update

### 1. `src/components/dashboard/BookIntroSheet.tsx`
- Replace the "Who referred them?" `<Input>` (line 271) with `<NameAutocomplete>`
- Replace inline friend first name `<Input>` (line 297) with `<NameAutocomplete>` (searches for existing people who might be coming in)

### 2. `src/components/dashboard/WalkInIntroSheet.tsx`
- Replace "Who referred them?" `<Input>` (line 272) with `<NameAutocomplete>`
- Replace friend first name `<Input>` (line 298) with `<NameAutocomplete>`

### 3. `src/components/IntroBookingEntry.tsx`
- Replace "Who referred them?" `<Input>` (line 382) with `<NameAutocomplete>`
- Replace friend first name `<Input>` (line 410) with `<NameAutocomplete>`

### 4. `src/components/coach/CoachIntroCard.tsx`
- Replace "Who are you planning to pair them with today?" `<Input>` (line 248) with `<NameAutocomplete>`

## Technical Details
- The component is a controlled input — parent state management unchanged, just swap `<Input>` for `<NameAutocomplete>`
- Search queries are limited to 20 results per table to keep responses fast
- The `autoCapitalizeName` wrapper stays on the `onChange` handler in each parent — `NameAutocomplete` passes raw input through `onChange`
- No database changes needed — reads only

