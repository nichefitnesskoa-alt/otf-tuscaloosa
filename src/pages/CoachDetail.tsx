import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { CoachDashboard } from '@/components/scorecard/CoachDashboard';
import { CoachStreakBadges } from '@/components/scorecard/CoachStreakBadges';
import { PeerEvaluations } from '@/components/scorecard/PeerEvaluations';
import { useScorecards } from '@/hooks/useScorecards';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { COACHES } from '@/types';
import { format } from 'date-fns';

export default function CoachDetail() {
  const { coachName: raw } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const coachName = decodeURIComponent(raw || '');

  // Coaches (and Both) can only view their own page; Koa sees anyone.
  const isAdmin = user?.name === 'Koa';
  if (!isAdmin && (user?.role === 'Coach' || user?.role === 'Both') && user?.name !== coachName) {
    return <Navigate to="/scorecards/me" replace />;
  }

  // Pull a 60-day window of scorecards for cadence/streak badges.
  const { data: cadenceCards = [] } = useScorecards({
    from: format(new Date(Date.now() - 60 * 86400_000), 'yyyy-MM-dd'),
    to: format(new Date(Date.now() + 7 * 86400_000), 'yyyy-MM-dd'),
    evaluatee: coachName,
  });

  if (!coachName) return <div className="p-4">Loading…</div>;

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="min-h-[36px]"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-black">{coachName}</h1>
        <CoachStreakBadges coach={coachName} cards={cadenceCards} />
      </div>
      <CoachDashboard
        coachName={coachName}
        allowPicker={user?.role === 'Admin'}
        coaches={[...COACHES]}
      />
      <PeerEvaluations coachName={coachName} />
    </div>
  );
}
