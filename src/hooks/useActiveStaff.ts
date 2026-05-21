import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ActiveStaffMember {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
}

export function useActiveStaff() {
  const [staff, setStaff] = useState<ActiveStaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('staff')
        .select('id, name, role, is_active')
        .eq('is_active', true)
        .order('name');
      setStaff((data as ActiveStaffMember[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const derived = useMemo(() => ({
    allActive: staff.map(s => s.name),
    coaches: staff.filter(s => ['Coach', 'Both', 'Admin'].includes(s.role)).map(s => s.name),
    salesAssociates: staff.filter(s => ['SA', 'Both', 'Admin'].includes(s.role)).map(s => s.name),
  }), [staff]);

  return { staff, ...derived, loading };
}
