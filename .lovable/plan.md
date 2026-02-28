I want to move the time, coach, lead source, and phone to the left next to the name instead of the right side. Make sure these changes are univeral across the app  
  
Plan: Make IntroCard Header Fields Inline-Editable

### Current State

The IntroCard header displays memberName, introTime, coachName, leadSource, and phone as static text. Only coach has an inline editor (InlineCoachPicker in IntroRowCard). The user wants all fields tappable/editable directly in the header.

### Changes

**1. Add class time constants to `src/types/index.ts**`
Add a `CLASS_TIMES` array with the 11 preset times plus support for custom.

**2. Refactor `IntroCard.tsx` to accept editable header**

- Add new optional props: `bookingId`, `onFieldSaved`, and `editable` boolean
- When `editable` is true, each header field becomes tappable:
  - **Member Name**: taps to inline text input
  - **Time**: taps to a dropdown with the 11 preset times + "Custom" option (custom shows a time input)
  - **Coach**: taps to dropdown with COACHES list
  - **Lead Source**: taps to dropdown with LEAD_SOURCES list  
  - **Phone**: taps to inline tel input
- When `editable` is false (default), behavior unchanged
- Each field saves directly to `intros_booked` via supabase on selection/blur
- For class_date: add it as a tappable field that opens a calendar popover (date-fns + Calendar component)

**3. Update `IntroRowCard.tsx**`

- Pass `bookingId={item.bookingId}` and `editable={true}` and `onFieldSaved={onRefresh}` to IntroCard
- Remove the separate `InlineCoachPicker` component since coach editing will be handled by IntroCard's inline edit
- Pass `userName` for audit trail (`last_edited_by`)

**4. Implementation detail for each field type**

- **Dropdowns** (coach, lead source, class time): Use Select component, save on selection
- **Text/tel inputs** (name, phone): Use Input, save on blur/Enter
- **Date** (class date): Use Popover + Calendar component, save on date select
- **Time dropdown**: 11 preset options rendered as SelectItems, plus a "Custom" option that switches to a time Input