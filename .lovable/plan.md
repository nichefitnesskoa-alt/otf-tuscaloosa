

# Fix: Text Fields Losing Focus Across the App

## Root Cause

The `MessageGenerator` component has a `useEffect` (line 88-95) that resets the `editedMessage` state whenever `open`, `templateBody`, or `fullContext` changes:

```typescript
useEffect(() => {
  if (open) {
    const applied = applyMergeFields(templateBody, fullContext, {});
    setEditedMessage(applied);
    setManualFields({});
    setCopied(false);
  }
}, [open, templateBody, fullContext]);
```

The `fullContext` is a `useMemo` that depends on `mergeContext` — but `mergeContext` is passed as an inline object literal from multiple parent components (ScriptPickerSheet line 406, MyDayNewLeadsTab line 541, etc.). Every parent re-render creates a new object reference, causing `fullContext` to change, which triggers the effect and **resets the textarea mid-typing**.

The parent re-renders are triggered by the **realtime subscription** in `useRealtimeMyDay` — it listens to `script_actions`, `intros_booked`, and other tables. Any DB write (even the user's own copy action inserting into `script_actions`) fires the realtime listener, which calls `fetchMetrics()`, re-rendering the parent, re-creating `mergeContext`, and resetting the textarea.

This same pattern affects the `TemplateEditor` to a lesser degree — its `useEffect` depends on `[template, open]` and `template` is an object from the parent's filtered list that gets a new reference on re-render from query invalidation.

## Fix — 2 Files

### 1. `src/components/scripts/MessageGenerator.tsx`

Change the reset `useEffect` to only fire when `open` transitions from `false` to `true`, not on every context change:

- Add a `useRef` to track the previous `open` state
- Only run the reset logic when `open` is `true` AND was previously `false` (i.e., the dialog just opened)
- Remove `templateBody` and `fullContext` from the dependency array

This ensures typing in the textarea is never interrupted by parent re-renders.

### 2. `src/components/scripts/TemplateEditor.tsx`

Same fix: change the reset `useEffect` to only fire when `open` transitions to `true`, using a ref to track the previous value. Remove `template` from the dependency array so query invalidation (which creates new object references) does not reset the form mid-edit.

### What this does NOT change

- No visual changes anywhere
- No changes to realtime subscriptions
- No changes to any other page, component, or data fetching
- The reset still fires correctly when the dialog first opens — fields populate as expected
- Closing and reopening still resets fields

