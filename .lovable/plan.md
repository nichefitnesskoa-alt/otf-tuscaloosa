*Accept the plan with one addition:*

*In CandidateDetailSheet Application tab — after the basic info grid and before the video section, add a display block showing the three new fields for candidates who submitted them:*

```
AVAILABILITY
[Read-only visual grid showing selected times — 
same grid layout as the form, selected cells 
highlighted orange, unselected gray]

EMPLOYMENT TYPE
[Full-time / Part-time / Either]

HOURS PER WEEK
[X hours/week]
```

*If any field is null (manually added candidate with no submission) — hide that field entirely. Only show fields that have data.*

*All other plan details accepted as written. Proceed with build.*  
  
Five Hiring Pipeline Fixes — Implementation Plan

### Files to Change


| File                                      | Changes                                                                                                                                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/Apply.tsx`                     | Major rewrite: token-based routing, role card selector, availability grid, employment type, hours per week, pre-fill from token, expired/invalid states                                                             |
| `src/components/admin/HiringPipeline.tsx` | Add: "Send Application Link" button, "Preview Application" button, delete candidate (single + bulk), copy-link toast, token generation                                                                              |
| `src/App.tsx`                             | Add route `/apply/:token` pointing to `Apply`                                                                                                                                                                       |
| SQL migration                             | Add columns: `application_token`, `token_expires_at`, `application_submitted_at`, `availability_schedule`, `employment_type`, `hours_per_week` to `candidates` table. Add unique constraint on `application_token`. |


### Files Audited — No Changes Needed


| File                          | Why                                                      |
| ----------------------------- | -------------------------------------------------------- |
| `src/pages/Admin.tsx`         | Only renders `HiringPipeline` as a tab — no hiring logic |
| `src/context/AuthContext.tsx` | No hiring references                                     |
| Edge functions                | No hiring references                                     |


---

### FIX 1 — Unique Application Links

**Database**: Add `application_token text UNIQUE`, `token_expires_at timestamptz`, `application_submitted_at timestamptz` to `candidates`.

**HiringPipeline.tsx**: Add "Send Application Link" button on each candidate card. On click:

- Generate a random token (`crypto.randomUUID()`)
- Save token to candidate record via `UPDATE candidates SET application_token = [token]`
- Copy `/apply/[token]` URL to clipboard
- Toast: "Link copied — ready to send"

**App.tsx**: Add route `<Route path="/apply/:token" element={<Apply />} />`.

**Apply.tsx**: Use `useParams()` to detect token. If token present:

- Query `candidates` by `application_token`
- If no match → show "This link is not valid."
- If match but `application_submitted_at` is not null → show "This application link has already been used."
- If valid → pre-fill name and role from candidate record, submit updates the existing record (UPDATE not INSERT), sets `application_submitted_at` to now

Public `/apply` and `/join-the-team` routes remain unchanged — new record created as before.

---

### FIX 2 — Role Selection as Card Radio Buttons

Replace the `RadioGroup` + small radio buttons with large tappable cards. Each role gets a full-width card with:

- OTF orange border + filled indicator when selected (`border-orange-500 bg-orange-50`)
- Gray border when unselected
- Bold label text
- Label above: "What role are you applying for? (Select one)"

Same `RadioGroup` primitive underneath for accessibility, just styled as cards.

---

### FIX 3 — Three New Questions

Add Section 4 between "The Three Steps" and Submit:

1. **Availability Grid**: Days as columns, 1-hour time slots as rows. Tappable cells (toggle orange/gray). Stored as JSONB (`{ "Monday": ["05:00","06:00",...], ... }`). Mobile-friendly with horizontal scroll if needed, minimum 44px cell size.
2. **Employment Type**: Radio cards (same style as role). Three options: Full-time, Part-time, Either.
3. **Hours Per Week**: Number input with `inputMode="numeric"`, min 1 max 40.

All three required in `isValid` check. Database columns: `availability_schedule jsonb`, `employment_type text`, `hours_per_week integer`.

---

### FIX 4 — Candidate Delete

**CandidateDetailSheet**: Add red "Delete Candidate" button at bottom of Application tab. Confirmation dialog with candidate name and "cannot be undone" warning.

On confirm:

1. Extract video filename from `video_url` and delete from `candidate-videos` storage bucket
2. Delete from `candidate_interviews` where `candidate_id`
3. Delete from `candidate_history` where `candidate_id`
4. Delete from `candidates` where `id`
5. Close sheet, toast "[Name] deleted", refresh pipeline

**Bulk delete**: Not implementing drag-select for v1 — single delete covers the need. Flag for Koa: bulk delete adds UI complexity; recommend adding only if volume warrants it.

---

### FIX 5 — Preview Application Button

**HiringPipeline.tsx**: Add "Preview Application" button in the header next to "Add Candidate". Opens `/apply` in a new tab via `window.open`.

---

### Regression Safety

- All changes are isolated to hiring pipeline (Apply page + HiringPipeline component + one route)
- No changes to intro booking, questionnaire, prep card, outcome, or shift recap workflows
- No metric calculations affected
- No shared utilities modified

### Flags for Koa

1. **Bulk delete**: Skipping bulk delete checkbox mode for now — adds significant UI complexity. Single delete per candidate is implemented. Add bulk if volume warrants it?
2. **Token security**: Tokens use `crypto.randomUUID()` — sufficiently random for this use case. Not implementing expiry timers since tokens expire on submission.