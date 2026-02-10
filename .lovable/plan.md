

# Questionnaire Text Updates: Q1 and Q2

## Changes

### 1. Q1: Update question text
Change from: "What's your #1 fitness goal right now?"
To: "What's your #1 health/fitness goal right now?"

One line change at line 289.

### 2. Q2: Center labels under their respective numbers
Currently the three labels ("Starting from scratch", "Decent but inconsistent", "Peak fitness") are in a `flex justify-between` container, which spaces them at the edges and center. The labels need to be precisely centered under buttons 1, 3, and 5 respectively.

Replace the current `justify-between` layout with a CSS grid or absolute-positioned labels that align each label directly under its corresponding button:
- "Starting from scratch" centered under button 1
- "Decent but inconsistent" centered under button 3
- "Peak fitness" centered under button 5

Note: The user wrote "Peak fitness centered under #3" but this is clearly a typo -- it should be under #5 based on the original spec context.

## Technical Details

### File: `src/pages/Questionnaire.tsx`

**Line 289:** Change `What's your #1 fitness goal right now?` to `What's your #1 health/fitness goal right now?`

**Lines 329-333:** Replace the label row with a grid layout matching the 5-button structure. Use a 5-column grid where labels sit in columns 1, 3, and 5, each `text-center` aligned so they center directly under their button.

```tsx
<div className="grid grid-cols-5 gap-3 text-xs px-1" style={{ color: '#777' }}>
  <span className="text-center">Starting from<br />scratch</span>
  <span></span>
  <span className="text-center">Decent but<br />inconsistent</span>
  <span></span>
  <span className="text-center">Peak<br />fitness</span>
</div>
```

This mirrors the same `gap-3` and column structure as the button row above, ensuring perfect alignment.

