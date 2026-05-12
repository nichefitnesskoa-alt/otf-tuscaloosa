## Add the POS referral script

The "Send script" button in MyDay → **Ask for a referral** opens `ScriptSendDrawer` filtered to `post_class_joined`. That category currently has Welcome / Check-In / Milestone scripts but no referral ask. Add the new one and make sure the merge fields resolve to the right people.

### 1. New template — insert via DB

Insert into `script_templates`:

- **Name:** `Ask for a Referral (POS)`
- **Category:** `post_class_joined`
- **Sort priority:** make this the top result for the category so it shows first when staff open the drawer from the referral card.
- **Body:**

```
Hey {first-name} this is {sold-by-first-name} from OrangeTheory Fitness. Just want to say thank you for joining and I'm excited to continue seeing you in here and that we get to help you hit your fitness goals! Please let me know if there's anything we can do to help!

I wanted to let you know that with your new membership, we're gifting you a 3 class pack, that you can give to a friend to try 3 free classes out! They can come in with or without you, always fun with obviously lol.

Anyone come to mind?
```

### 2. New merge field — `{sold-by-first-name}`

The script says "this is the SA who sold membership" — that's the booking's `intro_owner`, not always the SA hitting Send. Today the drawer only resolves `{sa-name}` / `{sa-first-name}` to the logged-in user. Need to add seller resolution.

`src/components/scripts/ScriptSendDrawer.tsx`
- Add optional prop `soldByName?: string | null`.
- In `resolveMergeFields`, replace `{sold-by-name}` and `{sold-by-first-name}` from that prop, falling back to `saName` (logged-in SA) so the script stays sensible if the prop isn't passed elsewhere.

`src/features/myDay/ReferralAskActions.tsx`
- Pass `soldByName={scriptRow?.introOwner}` to `<ScriptSendDrawer>`.

`src/lib/script-context.ts`
- Add the same two merge field keys to the canonical context map (sourced from `intros_booked.intro_owner`) so other surfaces that build context server-style stay coherent.

### 3. Coherence checks before done

- Open MyDay → Ask for a referral → Send script on a real row → first template in the list is **Ask for a Referral (POS)** → preview shows correct member first name + correct seller first name (not the logged-in SA when they differ).
- Other `post_class_joined` templates still render in the drawer.
- `script_actions` log entry on copy still records `sent_by` = logged-in SA (unchanged).
- Search WIG/MyDay for any other surface mounting `ScriptSendDrawer` with `categoryFilter="post_class_joined"` — verify nothing breaks because the new prop is optional.

### One open call before I build

The text you sent says **3 class pack**. Existing studio language and DB fields are **5-class pack** (per `milestones.five_class_pack_gifted`, the Class Milestone Checks flow, etc.). Do you want:

- **A:** Use **3 class pack** exactly as you wrote (just the script copy changes — the milestone/pack tracking elsewhere stays 5-class).
- **B:** Make it **5 class pack** so the script matches what staff actually log and what the system tracks.

I'll wait for your answer before inserting. Default if you don't say: **A — exactly your wording**.