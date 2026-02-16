

# Unified Intro Process Prep Sheet

## Goal
Transform the IntroPrepCard from a 3-tab reference sheet into a comprehensive, step-by-step guided prep tool that mirrors the full OTF Unified Intro Process document -- personalized with the prospect's questionnaire data.

## Current State
The Prep sheet has 3 tabs:
- **Quick Prep**: Shows raw Q answers (goal, level, obstacle, etc.)
- **Close Script**: TransformationClose component (accusation audit + identity close)
- **Objections**: EirmaPlaybook component (matched EIRMA scripts)

## What's Missing
The document has a full phased flow that the current prep sheet doesn't capture:
1. **Pre-Class phase** (greeting script, flipbook talking points, class expectations)
2. **During Class** (SA mid-class check-in script, coach goal references)
3. **Post-Class sit-down** (coach handoff, then the existing accusation audit / transformation close)
4. **After enrollment** (book first week, referral seed, follow-up confirmation)

The existing Close Script and Objections tabs have the right content but are disconnected from the flow. The user wants it to feel like a guided playbook you walk through step-by-step during the intro visit.

## Plan

### 1. Restructure IntroPrepCard Tabs (4 tabs instead of 3)

Replace the current 3-tab layout with 4 phase-based tabs that follow the intro timeline:

| Tab | Label | Content |
|-----|-------|---------|
| 1 | **Prep** | Questionnaire summary + SA mental framework + greeting script |
| 2 | **Pre-Class** | Greeting script, flipbook talking points, class expectations, mid-class check-in |
| 3 | **The Close** | Coach handoff script, accusation audit, transformation close, obstacle connector, identity close, pricing walkthrough (all from TransformationClose but with added context) |
| 4 | **Objections** | EirmaPlaybook (unchanged) + "I need to think about it" quick reference + after-enrollment checklist |

### 2. Create IntroProcessFlow Component

New file: `src/components/dashboard/IntroProcessFlow.tsx`

This is a scrollable, section-by-section guided script that replaces the separate Pre-Class and Close tabs with a single unified flow. Each section is a collapsible card so the SA can expand whichever phase they're in.

**Phase 1 - Pre-Class** (personalized with Q data):
- "Greeting + Q Acknowledgment" -- scripted with {firstName}, {goal}, {obstacle}
- "Flipbook Talking Points" -- bullet-point reminders (heart rate zones, coaching, afterburn)
- "Set Expectations" -- the "after class we'll sit down for 5-10 minutes" script
- "Mid-Class Check-In" -- the quick encouragement script

**Phase 2 - Post-Class Sit-Down** (the core close):
- "Coach Handoff" -- what the coach should say (personalized)
- "Questionnaire Reference" -- mirror their Q1, Q3, Q5
- "Accusation Audit" -- the full fear-naming block (already in TransformationClose)
- "Past Experience Bridge" -- Q4 bridge with "BUT"
- "The Question" -- "How do you feel RIGHT NOW?" (highlighted, with pause note)
- "Obstacle Connector" -- mapped from Q3 (already in TransformationClose)
- "Identity Close" -- the transformation question (highlighted, with pause note)

**Phase 3 - If Yes** (pricing/enrollment):
- "Pricing Walkthrough" -- Elite vs Premier with flexibility points (already in TransformationClose)
- "After Enrollment Checklist" -- book first week, introduce next coach, referral seed, confirm communication, set month-1 expectations

Each section shows personalized text using the prospect's questionnaire answers. Unfilled fields show orange-highlighted placeholders.

### 3. Update TransformationClose

Add the missing sections from the document that aren't currently there:
- Add the "Greeting + Q Acknowledgment" section at the beginning
- Add "After Enrollment" checklist at the end (book classes, referral seed, follow-up text, set expectations)
- Add the "Mid-Class Check-In" script

### 4. Update IntroPrepCard Tab Structure

Modify `src/components/dashboard/IntroPrepCard.tsx`:

```
Tab 1: "Quick Prep" (keep as-is -- the Q answer summary + copy button)
Tab 2: "Intro Flow" (NEW -- the IntroProcessFlow component, the full guided walkthrough)
Tab 3: "Close Script" (keep TransformationClose but enhanced)
Tab 4: "Objections" (keep EirmaPlaybook as-is)
```

Actually, to keep it simpler and more usable on mobile, restructure to **3 tabs** but with richer content:

```
Tab 1: "Prep" -- Q summary + Pre-Class scripts (greeting, flipbook points, expectations)
Tab 2: "The Close" -- Full post-class flow (coach handoff, accusation audit, transformation close, obstacle connector, identity close, pricing, after-enrollment)
Tab 3: "Objections" -- EIRMA playbook (unchanged)
```

This keeps 3 tabs (fits mobile well) but packs the pre-class prep into Tab 1 and the full close flow into Tab 2.

### 5. Files to Modify

**`src/components/dashboard/IntroPrepCard.tsx`**
- Tab 1 "Prep": Add collapsible "Pre-Class Scripts" section below the Q summary containing:
  - Greeting script personalized with Q data
  - Flipbook talking points (bullet list)
  - "Set Expectations" script
  - "Mid-Class Check-In" script
- Tab 2 "The Close": Add "Coach Handoff" section above the existing TransformationClose, and add "After Enrollment" checklist below the pricing section
- Tab 3 "Objections": No changes needed

**`src/components/dashboard/TransformationClose.tsx`**
- Add a "Coach Handoff" section at the top (before Questionnaire Reference) with the personalized handoff statement
- Add an "After Enrollment" section at the bottom with the 5-step checklist (book classes, introduce next coach, referral seed, confirm communication, set expectations)
- Include these in the "Copy Full Script" output

### 6. Technical Details

- All new sections use the same `personalize()` pattern: replace `[name]`, `[goal]`, `[obstacle]`, etc. with Q data
- Collapsible sections use the existing `Collapsible` component from radix
- Highlighted sections (The Question, Identity Close) keep the existing `border-l-4 border-l-primary bg-primary/5` styling
- Pre-class scripts use a green accent (`border-l-green-500 bg-green-50`) to distinguish from the close flow
- "Coach Handoff" uses blue accent (consistent with CoachPrepCard)
- No new database tables or queries needed -- all data comes from the existing `intro_questionnaires` fetch
- Mobile-first: all sections are readable on phone screens, collapsible to save space
