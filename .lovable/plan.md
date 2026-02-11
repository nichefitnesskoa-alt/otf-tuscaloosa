

# VIP Link Generator: Published URL + Remove "Optional" Labels

## Changes

### 1. Use Published URL in Generator (`VipBulkImport.tsx`)

Instead of using `window.location.origin` (which shows the preview URL), hardcode the published domain so the generated links always look like:

`otf-tuscaloosa.lovable.app/vip-register?class=Miss+Alabama`

### 2. Remove "Optional" Label from VIP Form (`VipRegister.tsx`)

The heart rate monitor section currently says "Optional" in its header. That label will be removed -- the fields (Birthday, Weight) will still be optional to fill out, but the form won't call attention to it.

## File Summary

| Action | File | What Changes |
|--------|------|-------------|
| Edit | `src/components/admin/VipBulkImport.tsx` | Replace `window.location.origin` with `https://otf-tuscaloosa.lovable.app` |
| Edit | `src/pages/VipRegister.tsx` | Remove "(Optional)" text from the heart rate monitor section header |

