import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * All staff rows (active + inactive).
 *
 * Use this ONLY for surfaces that need to show historical stats attributed
 * to people who have since been deactivated (WIG leaderboards, Studio page
 * tables, per-SA / per-Coach tables). Pickers, login lists, and assignment
 * dropdowns must keep using `useActiveStaff` — inactive staff must never
 * appear in those.
 *
 * Deactivating a staff member NEVER erases their history: the roster-display
 * helpers layered on top of this hook re-admit inactive staff into the
 * displayed roster when they have data inside the selected date range,
 * tagged as "inactive."
 */
export interface StaffRow {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
}

export function useAllStaff() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('staff')
        .select('id, name, role, is_active')
        .order('name');
      setStaff((data as StaffRow[]) || []);
      setLoading(false);
    })();
  }, []);

  return { staff, loading };
}
