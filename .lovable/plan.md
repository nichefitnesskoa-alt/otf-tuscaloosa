## Use published domain for all shareable booking links

Short SA links and friend links are being built from `window.location.origin`, which becomes the ugly preview host (`id-preview--2a28a5d2-…lovable.app`) when generated inside the editor. Shared links should always start with `https://otf-tuscaloosa.lovable.app/`.

### Change

Add a single canonical `PUBLIC_BOOKING_BASE = 'https://otf-tuscaloosa.lovable.app'` constant in `src/lib/introScheduler/linkUrl.ts` and use it in place of `window.location.origin` in the two share surfaces:

1. `src/components/admin/IntroSchedulerLinkCard.tsx` — the SA copy/share URL (`/book-intro/<code>`).
2. `src/pages/BookIntro.tsx` — the friend share URL shown on the "Bring a friend?" step (short `/book-intro/f/<code>` and legacy `/book?friend_of=…`).

Internal navigation (in-app `<Link>` / `navigate()`) is unaffected — this only changes strings copied/shared out of the app.

### Not changed
- Route definitions, resolver logic, DB schema, existing short codes.
- Legacy `/book?...` URLs already in the wild still work.
