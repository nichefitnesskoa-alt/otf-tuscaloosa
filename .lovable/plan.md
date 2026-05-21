Update `src/lib/studioNames.ts`:

1. Change Vestavia IG handle from `@otfvestavia` to `@otfvestaviahills`.
2. Remove the `shortCity` override in `getAdminStudioName()` so admin surfaces also display "OTF Vestavia Hills" (full city name everywhere).

No other files reference "vestavia" — all surfaces flow through these helpers, so this single file change covers participant pages, Coming Soon, co-brand bar, IG link, and admin sidebar/headers.