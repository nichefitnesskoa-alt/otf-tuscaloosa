The previous intro info for 2nd intros should show in the prep drawer instead of a specific button on the card.   
  
I also want to move the info in the 2nd line in the header to the side of the name in one line to make that header thinner.   
  
  
Investigation Results

I audited every booking creation path, the database trigger, and the script merge pipeline end-to-end. Here's what I found:

### The system IS working

The database trigger `trg_auto_create_questionnaire` fires automatically on every `INSERT` into `intros_booked`. It:

1. Creates an `intro_questionnaires` record with a human-readable slug (e.g. `bailie-smith-feb18`)
2. Sets the `questionnaire_link` field on the booking record to `https://otf-tuscaloosa.lovable.app/q/{slug}`
3. Skips VIP, COMP, and 2nd intros (as intended)

**Database proof**: 0 first-intro bookings exist without a questionnaire record (checked all time). 0 questionnaires exist without slugs.

Every booking creation path fires this trigger:

- BookIntroSheet (manual booking)
- WalkInIntroSheet (walk-in)
- ShiftRecap (shift submission)
- PipelineDialogs (pipeline booking)
- FriendReferralDialog (friend add)
- `import-lead` edge function (email-parsed leads)
- `import-sheet-leads` edge function (spreadsheet sync)

The script merge pipeline (`ScriptPickerSheet` + `buildScriptContext`) fetches the questionnaire by `booking_id`, reads the slug, and auto-injects `{questionnaire-link}` into every script template that uses it. No manual action needed.

### One minor gap to fix

Some older bookings (created before the trigger was updated) have `questionnaire_link = null` on the `intros_booked` record, even though they have valid questionnaire records with slugs. The script pipeline doesn't care (it reads the slug directly), but the Win The Day checklist uses `questionnaire_link` as a fallback.

### Plan

**1. Backfill `questionnaire_link` on older bookings** (database migration)

Run a one-time UPDATE to populate `questionnaire_link` on any booking that has a questionnaire with a slug but a null link field:

```sql
UPDATE intros_booked b
SET questionnaire_link = 'https://otf-tuscaloosa.lovable.app/q/' || q.slug
FROM intro_questionnaires q
WHERE q.booking_id = b.id
  AND q.slug IS NOT NULL
  AND b.questionnaire_link IS NULL;
```

**2. No frontend code changes needed**

The DB trigger handles all auto-generation. The frontend `autoCreateQuestionnaire()` calls in BookIntroSheet, WalkInIntroSheet, PipelineDialogs, and QuestionnaireHub are redundant safety nets that run after the trigger has already created the record -- they check `if existing return` and exit. They're harmless to keep.

The `handleLogAsSent` function in IntroRowCard correctly handles the edge case where somehow a questionnaire doesn't exist (creates one with a slug as a fallback) -- but this path should never be hit for new bookings because the trigger already created it.