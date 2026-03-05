

## Apply.tsx Full Rewrite — Copy, Reorder, Tone

### Scope

**One file changed**: `src/pages/Apply.tsx` — full rewrite of copy and section order. No database changes. No other files affected.

**Files audited, no changes needed**:
- `src/components/admin/HiringPipeline.tsx` — reads candidate data, no candidate-facing copy
- `src/App.tsx` — routes only, no copy
- Edge functions — no hiring form references

### Changes

**1. Section Reorder** (current → new):
```text
Current:                          New:
1. Header ("Join the Team")       1. Greeting (personalized/generic)
2. Role selection                 2. Role selection  
3. Basic Info                     3. Basic Info
4. Three Steps                    4. Scheduling & Availability
5. Scheduling & Availability      5. The Three Steps
6. Submit                         6. Submit
```

**2. Personalized Greeting** — replaces the generic "Join the Team" header:
- If `tokenCandidate` exists → extract first name from `full_name`, show `Hey [First Name]!`
- If public `/apply` → show `Hey, welcome!`
- Greeting is open text (not in a Card), centered, warm tone, with 🧡
- Body text: "We're really glad you're here..." / "We're really glad you found us..."

**3. Complete Copy Rewrite** — every text string replaced:

| Location | Current | New |
|---|---|---|
| Role label | "What role(s) are you applying for? (Select all that apply)" | "What are you applying for?" + helper "Pick everything that fits. You can select more than one." |
| Basic Info heading | "Basic Info" | "The basics" |
| Employment types | "Either — open to both" | "Either, open to both" (no em dash) |
| Three Steps heading | "The Three Steps" | "The three steps" |
| Step 1 heading | "Step 1 — The Video Introduction" | "Step 1: Show us who you are" |
| Step 1 prompt | Em-dash-heavy quoted text | Warm rewrite: "Record a short video..." |
| Step 1 helper | "Record a 60–90 second video..." | Merged into prompt |
| Step 1 upload label | "Upload video file" | "Upload your video here" |
| Step 1 format note | "Accepted formats: MP4, MOV, HEIC. Max 500MB." | "MP4 or MOV, 500MB max" |
| Step 2 heading | "Step 2 — The Belonging Essay" | "Step 2: Tell us a story" |
| Step 2 prompt | Corporate quoted text with em dashes | Warm rewrite: "We believe two things here..." |
| Step 3 heading | "Step 3 — The Future Resume" | "Step 3: Tell us where you're going" |
| Step 3 prompt | Corporate quoted text | Warm rewrite: "Forget your job history..." |
| Availability heading | "Scheduling & Availability" | removed, questions stand alone |
| Availability label | "What is your availability?" | "When are you available?" |
| Availability helper | "Select all times you're available each week." | "Tap the times that work for you each week." |
| Employment label | "Are you looking for full-time or part-time?" | "Are you looking for full time or part time?" |
| Hours label | "How many hours are you looking to work each week?" | "How many hours a week are you hoping to work?" |
| Submit button | "Submit Application" | "Submit application" |
| Done screen | "We got it." + em-dash text | "You did it. 🧡" + "We read every single one of these personally. If we feel it, you'll hear from us." |
| Duplicate screen | "We already have your application." | "We already have yours. We'll be in touch." |
| Invalid screen | "This link is not valid." | "This link isn't valid. Reach out to OTF Tuscaloosa directly if you think something went wrong." |
| Expired screen | "This application link has already been used." | "This one's already been used. Reach out to OTF Tuscaloosa if you need a new link." |
| Video error | "Please upload an MP4, MOV, or HEIC file." | "We need an MP4 or MOV file for this one." |
| Size error | "File must be under 500MB." | "That file is too big. Keep it under 500MB." |
| Upload fail | "Video upload failed. Please try again." | "The video didn't upload. Give it another try." |
| Textarea placeholder | "Write your response here..." | "Start writing here..." |
| Name placeholder | "Your full name" | "Your full name" (keep) |
| Submitting text | "Uploading video…" / "Submitting…" | "Uploading your video..." / "Almost there..." |
| Normalize roles comment | "— could be text[] from DB or legacy single string" | remove em dash from comment |

**4. AI Tell Audit**:
- Remove all em dashes from prose (names and URLs keep hyphens)
- Remove all colons-as-list-intros in candidate-facing text
- "60–90" → "60 to 90"
- No two consecutive sentences starting with the same word
- No "ensure", "utilize", "leverage" etc.
- Remove italic quoted formatting from step prompts — plain warm text instead

**5. No other changes**: Multi-select roles, availability grid, phone formatting, validation logic, submission flow all stay exactly as-is. Only copy and section order change.

### Regression Safety
- No database schema changes
- No submission logic changes
- No routing changes
- Only file touched: `src/pages/Apply.tsx`
- All form validation unchanged
- All Supabase queries unchanged

