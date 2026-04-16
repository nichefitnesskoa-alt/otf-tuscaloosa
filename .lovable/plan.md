
## Plan: Add 2 Coach Follow-Up Scripts

Add two new script templates for coaches to use after class when a member didn't buy.

### What to add

Two new entries in `script_templates` table:

**1. "First Class — Didn't Buy"**
- Category: Coach Follow-Up (or existing coach category)
- Body: `Hey {first-name}, Coach {coach-first-name} here from OTF! You really stood out in your first class, you did so well! How are you feeling?`

**2. "2nd Intro — Didn't Buy"**
- Category: Coach Follow-Up
- Body: `Hey {first-name}, Coach {coach-first-name} here from OTF! How did round 2 go for you?`

### Merge field mapping
- `{first_name}` → `{first-name}` (matches existing script context engine)
- `{coach_name}` → `{coach-first-name}` (uses coach's first name only, matches the casual tone)

### Implementation
- Single DB migration inserting both rows into `script_templates` with `is_active = true`
- Use existing "Coach Follow-Up" category if present; otherwise create it first
- No code changes needed — scripts will auto-appear in the script library, Coach View, and ScriptSendDrawer

### Files changed
1. One migration file inserting the two templates (and the category if it doesn't exist)

### Confirm before building
I'll first read the `script_categories` table to find the correct coach category slug. If no "Coach Follow-Up" category exists, I'll create one so these slot in cleanly on the coach side.
