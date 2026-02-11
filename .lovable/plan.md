

# VIP Class URL Generator

## What This Does

Adds a simple tool in the Admin panel where you type a VIP class name (e.g., "Miss Alabama") and it instantly generates the shareable registration link. You can copy it with one click.

## What You See

A small card with:
- A text input for the class name
- The generated URL displayed below it (updates as you type)
- A "Copy" button that copies the link to your clipboard

## Technical Details

### File Changes

| Action | File | What Changes |
|--------|------|-------------|
| Edit | `src/components/admin/VipBulkImport.tsx` | Add URL generator section at the top of the existing VIP component (keeps VIP tools together) |

The generator builds the URL using `window.location.origin + '/vip-register?class=' + encodeURIComponent(className)`. No database changes needed -- it's purely a UI helper.

