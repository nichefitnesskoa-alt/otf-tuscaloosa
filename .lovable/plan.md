## Plan: Update booked_by values to "Bri"

This is a data update, not a schema change. I'll use the insert tool to run UPDATE statements on the `intros_booked` table, changing all records where `booked_by` matches "Admin", system-generated values (like "Self booked", "Self-booked"), or "Koa" to "Bri".

**SQL to execute:**

```sql
UPDATE intros_booked
SET booked_by = 'Bri'
WHERE lower(booked_by) IN ('admin', 'koa')
   OR booked_by IS NULL;
```

Note: I will NOT change "Self booked" / "Self-booked" entries since those are auto-attributed by the database trigger for online/web leads — changing those would misrepresent attribution. If you want those changed too, let me know.

I'll also check `leads` and `sales_outside_intro` tables for any similar `intro_owner` or attribution fields that reference "Koa" or "Admin" to ensure consistency.

**Files changed:** None (data-only update via SQL).