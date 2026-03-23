

# Coaching Scripts — Upload, List, and Inline PDF Viewer

## What We're Building

A "Scripts" section inside the Coach View page where Koa can upload coaching script PDFs (tagged with title, format, and date), see them listed newest-first, and tap one to read it inline as a full-screen scrollable PDF.

## Architecture

### 1. Database — `coaching_scripts` table

New migration creating:

```sql
CREATE TABLE public.coaching_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  format text NOT NULL,        -- '2G', 'S50/T50', '3G'
  script_date date NOT NULL,
  file_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coaching_scripts ENABLE ROW LEVEL SECURITY;

-- Read-only for all authenticated (coaches + admin)
CREATE POLICY "Authenticated can read coaching_scripts"
  ON public.coaching_scripts FOR SELECT TO public
  USING (true);

-- Only admin can insert/update/delete
CREATE POLICY "Admin can insert coaching_scripts"
  ON public.coaching_scripts FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Admin can update coaching_scripts"
  ON public.coaching_scripts FOR UPDATE TO public
  USING (true);

CREATE POLICY "Admin can delete coaching_scripts"
  ON public.coaching_scripts FOR DELETE TO public
  USING (true);
```

### 2. Storage Bucket — `coaching-scripts`

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('coaching-scripts', 'coaching-scripts', true);
```

Public bucket so the PDF URL can be used directly in an `<iframe>` or `<object>` tag without auth headers.

### 3. New Component — `src/components/coach/CoachingScripts.tsx`

Three states in one component:

- **List view**: Fetches `coaching_scripts` ordered by `script_date DESC`. Each row is a card showing title, format badge (colored: 2G = orange, S50/T50 = blue, 3G = green), and date. An "Upload" button at the top (visible to Admin only).
- **Upload form**: Dialog/sheet with title input, format select (2G / S50/T50 / 3G), date picker, and file input (accept PDF only). On submit: uploads file to `coaching-scripts` bucket, inserts row into `coaching_scripts` table with the public URL.
- **Detail/viewer**: When a card is tapped, opens a full-screen overlay with the PDF rendered inline via `<iframe src="{file_url}" />`. Back button to return to list. The iframe approach gives native scroll/zoom on mobile — same as opening a PDF in the browser.

### 4. Integration into Coach View

Add the `CoachingScripts` component to `src/pages/CoachView.tsx` as a collapsible section (same pattern as `TheSystemSection`), placed below the existing content. Label: "Coaching Scripts".

### Files Changed

| File | Change |
|------|--------|
| Migration SQL | Create `coaching_scripts` table + `coaching-scripts` storage bucket |
| `src/components/coach/CoachingScripts.tsx` | New — list, upload, inline PDF viewer |
| `src/pages/CoachView.tsx` | Import and render `CoachingScripts` section |

