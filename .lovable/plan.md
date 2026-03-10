

## Plan: Purple VIP Class Banner with Questionnaire Status

### What changes

In `src/features/myDay/IntroRowCard.tsx`, add a new banner condition for VIP Class leads (detected by `lead_source` containing "vip", while NOT being a 2nd intro). This purple banner will show both the VIP origin AND the questionnaire status.

**Banner logic update** (lines 306-313 in the top banner builder):

Currently, non-2nd-intro cards fall through to the plain Q status banner (red/amber/green). We'll add a check before that: if `item.leadSource` contains "vip" (case-insensitive) and it's not a 2nd intro, show a purple (`#7e22ce`) banner with combined text like:

- `"🟣 VIP Class — Questionnaire Not Sent"` (when NO_Q)
- `"🟣 VIP Class — Questionnaire Sent"` (when Q_SENT)  
- `"🟣 VIP Class — Questionnaire Complete ✓"` (when Q_COMPLETED)

The banner color stays purple in all cases so VIP origin is always visually distinct, but the text clearly communicates the Q status. The Q-overdue and outcome-needed conditions still take priority above this.

**Single file change**: `src/features/myDay/IntroRowCard.tsx` — ~5 lines modified in the `topBanner` JSX block.

