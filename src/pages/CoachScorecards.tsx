import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CoachDashboard } from '@/components/scorecard/CoachDashboard';
import { useParams } from 'react-router-dom';

export default function CoachScorecards() {
  const { user } = useAuth();
  const { who } = useParams();
  const [coaches, setCoaches] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('staff').select('name, role, is_active').eq('is_active', true);
      setCoaches((data || []).filter((s: any) => /coach/i.test(s.role || '')).map((s: any) => s.name).sort());
    })();
  }, []);
  const allowPicker = user?.role === 'Admin' && who !== 'me';
  const target = who === 'me' || user?.role === 'Coach' ? (user?.name || '') : (coaches[0] || '');
  if (!target) return <div className="p-4">Loading…</div>;
  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-black">{allowPicker ? 'Coach Scorecards' : 'My Scorecards'}</h1>
      <CoachDashboard coachName={target} allowPicker={allowPicker} coaches={coaches} />
    </div>
  );
}
