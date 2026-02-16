

# Individual Goal/Obstacle Responses with EIRMA in Prep

## What Changes

### 1. Prep Tab - Break out individual obstacles with responses

Currently the Prep tab shows obstacles as a single string: `"Time | Pricing | Don't know what to do"`. 

Change this to split the pipe-delimited obstacles into individual cards, each with:
- The obstacle name as a header
- A tailored SA response (using the existing `OBSTACLE_CONNECTORS` map from TransformationClose)
- The matched EIRMA quick-reference (E-I-R-M-A one-liners) pulled from `objection_playbooks`
- All personalized with the prospect's name, goal, etc.

Same treatment for fitness goals if multiple are listed.

### 2. Add EIRMA to Prep Tab

Import `useObjectionPlaybooks` and `matchObstaclesToPlaybooks` into PrepDrawer. For each individual obstacle, show the matched EIRMA steps inline (not just in the Objections tab). This gives the SA obstacle-specific coaching right where they see the Q answers.

### 3. Files to Modify

**`src/components/dashboard/PrepDrawer.tsx`**:
- Import `useObjectionPlaybooks`, `matchObstaclesToPlaybooks` from `@/hooks/useObjectionPlaybooks`
- Import `OBSTACLE_CONNECTORS` (will need to export it from TransformationClose or duplicate the map)
- In the Prep tab, after the Q summary block, add a new "Goal and Obstacle Breakdown" section
- Parse `obstacle` string by ` | ` delimiter into individual items
- For each obstacle: show a collapsible card with the connector response + matched EIRMA steps
- Parse `goal` string similarly if pipe-delimited
- Personalize all text with `p()` helper

**`src/components/dashboard/TransformationClose.tsx`**:
- Export `OBSTACLE_CONNECTORS` and `getObstacleConnector` so PrepDrawer can reuse them

### 4. New UI in Prep Tab (after Q summary)

```
-- Individual Obstacle Cards --
For each obstacle (e.g., "Time"):
  [Amber card]
  OBSTACLE: Time
  Response: "The class is 50 minutes. You showed up, did the workout, 
            and you are done."
  EIRMA Quick Ref:
    E: "I totally get it, [name]. Time is the #1 reason..."
    I: "Is it that you don't have time, or that..."
    R: "50 minutes, 3x a week..."
    M: "What if we found 3 slots that fit your schedule?"
    A: "Let's look at the schedule right now..."

For each obstacle (e.g., "Pricing"):
  [Amber card]
  OBSTACLE: Pricing
  Response: "Let me show you something. [Transition to pricing]"
  EIRMA Quick Ref:
    E: "I hear you. Nobody wants to waste money..."
    I: "Is it the monthly cost, or..."
    ...
```

### 5. Technical Approach

- Split obstacles: `obstacle?.split(' | ').map(o => o.trim()).filter(Boolean)`
- For each obstacle string, call `getObstacleConnector(singleObstacle)` for the tailored response
- For EIRMA matching, filter playbooks where `trigger_obstacles` match that specific obstacle
- Each card uses `PrepCollapsible` with amber accent color (add amber to the accent options)
- First obstacle card is open by default, rest collapsed
- If no playbook matches an obstacle, still show the connector response without EIRMA

### 6. Keep Objections Tab

The Objections tab stays as-is for the full detailed EIRMA view with expandable scripts. The Prep tab shows a condensed quick-reference version inline with the obstacle breakdown.
