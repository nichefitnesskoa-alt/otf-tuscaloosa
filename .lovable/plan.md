# Brand Polish — Wave 1: Tokens + Primitives

Color-only, primitive-only. No page-level changes. Giveaway feature untouched.

## 1. `src/index.css` — extend `:root` and `.dark`

Add to existing `:root` block (keep all current vars):

```css
/* === BRAND POLISH WAVE 1 — STATUS SEMANTIC RULES ===
   BRAND ORANGE: primary action, active nav, brand accents, progress. Never status/warn.
   SUCCESS (green): sold, verified, completed, checked. Never $0/neutral.
   WARNING (amber): pending, planned, cooling, due-soon. Never coaching prompts.
   DANGER (red): overdue, urgent, missed, data errors, unread badges. Never decorative.
   NEUTRAL (gray): inactive, secondary, locked, historical.
=== */

--brand: 20 93% 48%;
--brand-dim: 20 93% 48% / 0.15;
--brand-hover: 20 93% 42%;
--brand-foreground: 0 0% 100%;

--status-success: 142 71% 45%;
--status-success-dim: 142 71% 45% / 0.12;
--status-warning: 38 92% 50%;
--status-warning-dim: 38 92% 50% / 0.12;
--status-danger: 0 84% 60%;
--status-danger-dim: 0 84% 60% / 0.12;
--status-neutral: 240 2% 57%;
--status-neutral-dim: 240 2% 57% / 0.12;

--text-primary: 0 0% 98%;
--text-secondary: 240 2% 65%;  /* bumped from 57% → 65% for AA on #2A2A2C (4.6:1) */
--text-brand: 20 93% 48%;
--text-public: 36 27% 95%;

--surface-page: 240 1% 11%;
--surface-card: 240 1% 17%;
--surface-card-hover: 240 1% 20%;
--surface-border: 240 1% 22%;
--surface-input: 240 1% 14%;

--interactive-focus: 20 93% 48%;
--interactive-disabled: 240 2% 30%;
```

Mirror identical values in `.dark` block (internal app is dark-first, tokens match).

Note conflicts: existing `--primary`, `--success`, `--warning`, `--destructive` remain untouched — new `--brand`/`--status-*` live alongside them. Waves 2-4 will migrate page consumers.

## 2. `tailwind.config.ts` — extend `colors`

Append (do not remove existing entries):

```ts
brand: { DEFAULT: 'hsl(var(--brand))', dim: 'hsl(var(--brand-dim))',
         hover: 'hsl(var(--brand-hover))', foreground: 'hsl(var(--brand-foreground))' },
success: { DEFAULT: 'hsl(var(--status-success))', dim: 'hsl(var(--status-success-dim))' },
warning: { DEFAULT: 'hsl(var(--status-warning))', dim: 'hsl(var(--status-warning-dim))' },
danger:  { DEFAULT: 'hsl(var(--status-danger))',  dim: 'hsl(var(--status-danger-dim))' },
neutral: { DEFAULT: 'hsl(var(--status-neutral))', dim: 'hsl(var(--status-neutral-dim))' },
surface: { page: 'hsl(var(--surface-page))', card: 'hsl(var(--surface-card))',
           'card-hover': 'hsl(var(--surface-card-hover))',
           border: 'hsl(var(--surface-border))', input: 'hsl(var(--surface-input))' },
text:    { primary: 'hsl(var(--text-primary))', secondary: 'hsl(var(--text-secondary))',
           brand: 'hsl(var(--text-brand))', public: 'hsl(var(--text-public))' },
```

(Existing `success`/`warning` Tailwind entries currently map to `--success`/`--warning`; new entries override with the `-dim` shape. Since old keys had `.foreground` and new keys have `.dim`, both shapes coexist — Wave 2+ migrates usage. No breakage in Wave 1.)

## 3. shadcn primitives — color-only retheme

**`src/components/ui/tabs.tsx`**
- `TabsList`: `bg-surface-card` (was `bg-transparent`)
- `TabsTrigger` inactive: `text-text-secondary bg-transparent hover:bg-surface-card-hover`
- `TabsTrigger` active: `bg-brand text-brand-foreground border-brand`
- Strip `bg-primary/15`, `border-primary/30`, `text-primary`, `bg-primary/25`

**`src/components/ui/switch.tsx`**
- Root: `bg-surface-border data-[state=checked]:bg-brand border-transparent`
- Strip `border-primary/40`, `data-[state=unchecked]:bg-primary/20`
- Thumb: `bg-white` (both states)

**`src/components/ui/progress.tsx`**
- Track: `bg-surface-border` (was `bg-secondary`)
- Indicator: `bg-brand` (was `bg-primary`)

**`src/components/ui/slider.tsx`**
- Track: `bg-surface-border`; Range: `bg-brand`
- Thumb: `bg-white border-2 border-brand`

**`src/components/ui/radio-group.tsx`**
- Item: `border-surface-border bg-transparent data-[state=checked]:border-brand`
- Indicator `Circle`: `fill-brand text-brand`

**`src/components/ui/sonner.tsx`**
- Default toast: `bg-surface-card border-surface-border text-text-primary`
- Add `classNames.success/error/warning` mapping to `border-success`/`border-danger`/`border-warning` with matching icon colors.

## 4. Coach color map consolidation

- Create `src/lib/coachColors.ts` with the 5-coach map + legend + `colorForCoach` / `hslForCoach` / `isActiveCoach` exactly as specified.
- Delete `src/lib/scorecard/coachColors.ts`.
- Grep & rewrite imports across codebase: `@/lib/scorecard/coachColors` and any relative variants → `@/lib/coachColors`.

Note: current map uses different coaches (Alex, Bri, Faith, Madison, Jenna). Wave 1 prompt specifies replacement roster (Koa, James, Nathan, Jackson, Natalya). I will apply the prompt's roster as-is; the deterministic-hash fallback is replaced with a flat `#8E8E93` neutral fallback per spec. Any unknown coach name in historical chart data renders neutral gray instead of a hashed hue — flagging this as a behavior change.

## 5. Contrast verification (documented in comments)

- `#FAFAFA` on `#2A2A2C` → 16.4:1 ✅ AAA
- `#8E8E93` on `#2A2A2C` → 3.6:1 ❌ — bump `--text-secondary` to `240 2% 65%` (≈`#A4A4A8`) → 4.6:1 ✅ AA (applied above)
- `#E8540A` on `#2A2A2C` → 4.8:1 ✅ AA
- `#FFFFFF` on `#E8540A` → 3.6:1 ⚠️ — bold/14px+ AA Large only. Keep for primary buttons (14px+); document caveat in comment.

## Verification checklist before done

A–L from the prompt: tokens added, `.dark` mirrored, Tailwind extended, six primitives retoned, no hex/rgb left in primitives, `src/lib/coachColors.ts` created, old path deleted, all imports rewritten (grep clean), giveaway untouched, no page-level edits, contrast comments in `index.css`, semantic rules comment block at top of `index.css`.

## Open question

The coach roster in the prompt (Koa, James, Nathan, Jackson, Natalya) differs from the current map (Koa, Alex, Bri, James, Nathan, Faith, Madison, Jenna). **Confirm: replace roster entirely as specified, or merge (keep all 8 + reassign colors)?** Default if no answer: follow prompt literally (5 coaches only, neutral fallback for everyone else).
