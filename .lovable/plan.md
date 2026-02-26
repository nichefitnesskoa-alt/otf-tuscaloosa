

# Fix: Print Card Not Showing

## Root Cause

The `[data-print-card]` div is rendered inside `<SheetContent>`, which is a Radix portal. The print CSS rule on line 181 sets `[data-radix-portal] { display: none !important }`, which hides the entire portal — including the print card inside it.

## Fix

**File: `src/index.css`** (line 181)

Change the Radix portal hide rule to exclude portals that contain the print card:

```css
[data-radix-portal]:not(:has([data-print-card])),
```

This uses CSS `:has()` (supported in all modern browsers) to keep the portal visible when it contains the print layout, while still hiding all other portals (dialogs, toasts, etc.).

Also hide the non-print content inside the sheet so only `[data-print-card]` shows:

```css
[data-radix-portal]:has([data-print-card]) [role="dialog"] > *:not([data-print-card]) {
  display: none !important;
}
```

This ensures the sheet chrome (close button, scroll area, header) is hidden during print, leaving only the print card visible.

One file changed. Two CSS rules modified/added.

