Make the "Log a lead you sourced" card stand out instead of blending into the dark background.

**Change** (in `src/features/myDay/SelfSourcedLeadEntry.tsx` — single component, used on both MyDay and WIG, so one edit covers both pages):

- Swap the Card's collapsed styling from `border-primary/30` (faint orange outline on near-black) to a filled orange treatment:
  - `bg-primary` background with `text-primary-foreground` for the header row
  - Solid `border-primary` and a subtle `shadow-md` for lift
  - Icon and chevron switch to `text-primary-foreground`
  - Subtext switches from `text-muted-foreground` to `text-primary-foreground/80`
- When expanded, revert the body area to the normal card surface (`bg-card text-foreground`) so the form fields stay readable; only the header strip stays orange.

**Scope guard:** Visual only. No data, logic, or copy changes. Component is shared, so MyDay and WIG update together.
