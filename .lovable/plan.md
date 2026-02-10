

# Auto-Import to Default Calendar

## What Changes

Instead of downloading an `.ics` file that the user has to manually open, the "Add to Calendar" button will directly open the device's default calendar app with the event pre-filled. This works by navigating to a `webcal://` data URI or using a Google Calendar URL as a fallback -- providing a smoother, one-tap experience on mobile.

## Technical Details

### File: `src/pages/Questionnaire.tsx`

Replace the `downloadICS` function approach. Instead of creating a Blob and triggering a file download, use `window.open` with a Google Calendar intent URL (works universally on mobile and desktop) or keep the `.ics` approach but open it inline via `window.location.href` instead of downloading.

**Approach: Google Calendar deep link with `.ics` fallback**

Since most users are on mobile (this is a questionnaire they receive via link), the best cross-platform approach is:

1. Try `window.open()` with the `.ics` blob URL -- on iOS and Android this will prompt the native calendar app to import the event directly (no "download" step).
2. Change `a.download` to not set a filename, and instead set `a.target = '_blank'` -- this causes the OS to handle the `.ics` file with its default calendar app rather than saving it to Downloads.

The key change is removing `a.download = 'otf-intro-class.ics'` and replacing it with `a.target = '_blank'`, plus changing the blob type handling so the browser opens the calendar app instead of downloading a file.

```text
Before:
  a.href = url; a.download = 'otf-intro-class.ics'; a.click();

After:
  window.location.href = url;
```

Using `window.location.href` with a `text/calendar` blob causes iOS Safari and Android Chrome to open the native calendar import flow directly, rather than downloading a file the user must find and tap.

### No other file changes needed
