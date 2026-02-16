import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  useMeetingAgenda, useGenerateAgenda, useMeetingSettings, usePreviousMeetingAgenda,
  getCurrentMeetingMonday, getMeetingDateRange, MeetingMetrics 
} from '@/hooks/useMeetingAgenda';
import { supabase } from '@/integrations/supabase/client';
import { format, addWeeks, subWeeks } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  RefreshCw, ChevronLeft, ChevronRight, Presentation, X, Sparkles, 
  Trophy, BarChart3, ShieldAlert, Swords, CalendarDays, ClipboardList, Target
} from 'lucide-react';

import { ShoutoutsSection } from '@/components/meeting/ShoutoutsSection';
import { ScoreboardSection } from '@/components/meeting/ScoreboardSection';
import { ObjectionSection } from '@/components/meeting/ObjectionSection';
import { DrillSection } from '@/components/meeting/DrillSection';
import { WeekAheadSection } from '@/components/meeting/WeekAheadSection';
import { HousekeepingSection } from '@/components/meeting/HousekeepingSection';
import { WigSection } from '@/components/meeting/WigSection';

const SECTION_IDS = ['welcome', 'shoutouts', 'scoreboard', 'objections', 'drill', 'week-ahead', 'housekeeping', 'wig'];
const SECTION_ICONS = [Sparkles, Trophy, BarChart3, ShieldAlert, Swords, CalendarDays, ClipboardList, Target];

export default function Meeting() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = user?.role === 'Admin';
  const [isPresentMode, setIsPresentMode] = useState(!isAdmin || searchParams.get('mode') === 'present');
  const [currentSection, setCurrentSection] = useState(0);

  // Meeting date navigation
  const [meetingMonday, setMeetingMonday] = useState(getCurrentMeetingMonday());
  const meetingDateStr = format(meetingMonday, 'yyyy-MM-dd');
  const { start, end } = getMeetingDateRange(meetingMonday);
  const dateLabel = `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`;

  const { data: agenda, isLoading } = useMeetingAgenda(meetingDateStr);
  const { data: settings } = useMeetingSettings();
  const { data: prevAgenda } = usePreviousMeetingAgenda(meetingDateStr);
  const generateMutation = useGenerateAgenda();

  // Local edit state
  const [manualShoutouts, setManualShoutouts] = useState('');
  const [housekeeping, setHousekeeping] = useState('');
  const [wigCommitments, setWigCommitments] = useState('');
  const [wigTarget, setWigTarget] = useState('');
  const [drillOverride, setDrillOverride] = useState<string | null>(null);
  const [eventsNotes, setEventsNotes] = useState('');

  // Sync local state from fetched agenda
  useEffect(() => {
    if (agenda) {
      setManualShoutouts(agenda.manual_shoutouts || '');
      setHousekeeping(agenda.housekeeping_notes || '');
      setWigCommitments(agenda.wig_commitments || '');
      setWigTarget(agenda.wig_target || '');
      setDrillOverride(agenda.drill_override);
    }
  }, [agenda]);

  const metrics = agenda?.metrics_snapshot as MeetingMetrics | undefined;

  // Auto-generate if no agenda exists
  useEffect(() => {
    if (!isLoading && !agenda && isAdmin) {
      generateMutation.mutate(meetingMonday);
    }
  }, [isLoading, agenda, isAdmin, meetingMonday]);

  // Save edits (debounced on field blur)
  const saveField = useCallback(async (field: string, value: string | null) => {
    if (!agenda?.id) return;
    await supabase.from('meeting_agendas').update({ [field]: value }).eq('id', agenda.id);
  }, [agenda?.id]);

  // Keyboard navigation in present mode
  useEffect(() => {
    if (!isPresentMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setCurrentSection(s => Math.min(s + 1, SECTION_IDS.length - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setCurrentSection(s => Math.max(s - 1, 0));
      } else if (e.key === 'Escape' && isAdmin) {
        setIsPresentMode(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isPresentMode, isAdmin]);

  // Scroll to section in present mode
  useEffect(() => {
    if (isPresentMode) {
      document.getElementById(SECTION_IDS[currentSection])?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentSection, isPresentMode]);

  const handleGenerate = () => {
    generateMutation.mutate(meetingMonday, {
      onSuccess: () => toast.success('Meeting agenda regenerated!'),
      onError: () => toast.error('Failed to generate agenda'),
    });
  };

  const togglePresent = () => {
    const next = !isPresentMode;
    setIsPresentMode(next);
    if (next) {
      setCurrentSection(0);
      setSearchParams({ mode: 'present' });
    } else {
      setSearchParams({});
    }
  };

  // Energy opener
  const energyInsight = useMemo(() => {
    if (!metrics) return null;
    if (metrics.shoutouts.length > 0 && metrics.shoutouts[0].category === 'Top Closer') {
      return `${metrics.shoutouts[0].icon} ${metrics.shoutouts[0].name} closed at ${metrics.shoutouts[0].metric}!`;
    }
    if (metrics.closeRate > metrics.closeRatePrev + 2) {
      return `📈 Studio close rate up from ${metrics.closeRatePrev.toFixed(0)}% to ${metrics.closeRate.toFixed(0)}% this week!`;
    }
    return `💪 AMC: ${metrics.amc}. ${Math.max(400 - metrics.amc, 0)} away from 400.`;
  }, [metrics]);

  if (isLoading && !agenda) {
    return <div className="flex items-center justify-center min-h-screen"><RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  // Present Mode
  if (isPresentMode) {
    return (
      <div className="bg-gray-950 text-white min-h-screen relative">
        {/* Section sidebar */}
        <div className="fixed left-2 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2">
          {SECTION_IDS.map((id, i) => {
            const Icon = SECTION_ICONS[i];
            return (
              <button
                key={id}
                onClick={() => setCurrentSection(i)}
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                  currentSection === i ? 'bg-white text-gray-950 scale-110' : 'bg-white/20 text-white/60 hover:bg-white/30'
                )}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>

        {/* Exit button (admin only) */}
        {isAdmin && (
          <button onClick={togglePresent} className="fixed top-4 right-4 z-50 bg-white/20 hover:bg-white/30 rounded-full p-2">
            <X className="w-5 h-5 text-white" />
          </button>
        )}

        {/* Nav buttons */}
        <div className="fixed bottom-6 right-6 z-50 flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentSection(s => Math.max(s - 1, 0))} disabled={currentSection === 0} className="bg-white/20 border-white/30 text-white hover:bg-white/30">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentSection(s => Math.min(s + 1, SECTION_IDS.length - 1))} disabled={currentSection === SECTION_IDS.length - 1} className="bg-white/20 border-white/30 text-white hover:bg-white/30">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Welcome */}
        <div id="welcome" className="min-h-screen flex flex-col items-center justify-center px-8">
          <p className="text-2xl text-white/40 mb-4">Team Meeting</p>
          <h1 className="text-5xl md:text-7xl font-black text-center mb-6">
            {format(meetingMonday, 'EEEE, MMMM d, yyyy')}
          </h1>
          {energyInsight && (
            <p className="text-2xl text-yellow-400 text-center max-w-2xl">{energyInsight}</p>
          )}
          {!isAdmin && (
            <p className="text-sm text-white/30 mt-8">Generated Sunday at 3:00 PM</p>
          )}
        </div>

        {metrics && (
          <>
            <ShoutoutsSection shoutouts={metrics.shoutouts} manualShoutouts={manualShoutouts} onManualChange={() => {}} isAdmin={false} isPresentMode />
            <ScoreboardSection metrics={metrics} dateLabel={dateLabel} isPresentMode />
            <ObjectionSection metrics={metrics} isPresentMode />
            <DrillSection topObjection={metrics.topObjection} drillOverride={drillOverride} onOverrideChange={() => {}} isAdmin={false} isPresentMode />
            <WeekAheadSection weekAhead={metrics.weekAhead} eventsNotes={eventsNotes} onEventsChange={() => {}} isAdmin={false} isPresentMode />
            <HousekeepingSection notes={housekeeping} onChange={() => {}} isAdmin={false} isPresentMode />
            <WigSection
              closeRate={metrics.closeRate}
              wigTarget={wigTarget}
              wigCommitments={wigCommitments}
              previousCommitments={prevAgenda?.wig_commitments || null}
              onTargetChange={() => {}}
              onCommitmentsChange={() => {}}
              isAdmin={false}
              isPresentMode
            />
          </>
        )}
      </div>
    );
  }

  // Prep Mode (Admin) / Read-only (SA/Coach)
  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Team Meeting</h1>
          <p className="text-sm text-muted-foreground">
            {format(meetingMonday, 'EEEE, MMMM d, yyyy')} · {dateLabel}
          </p>
          {!isAdmin && <p className="text-xs text-muted-foreground mt-1">Generated Sunday at 3:00 PM</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={agenda?.status === 'presented' ? 'default' : 'secondary'}>
            {agenda?.status || 'draft'}
          </Badge>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={togglePresent}>
              <Presentation className="w-4 h-4 mr-1" /> Present
            </Button>
          )}
        </div>
      </div>

      {/* Meeting navigation */}
      {isAdmin && (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setMeetingMonday(d => subWeeks(d, 1))}>
            <ChevronLeft className="w-4 h-4" /> Prev
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMeetingMonday(getCurrentMeetingMonday())}>
            This Week
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMeetingMonday(d => addWeeks(d, 1))}>
            Next <ChevronRight className="w-4 h-4" />
          </Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generateMutation.isPending}>
            <RefreshCw className={cn('w-4 h-4 mr-1', generateMutation.isPending && 'animate-spin')} />
            {generateMutation.isPending ? 'Generating...' : 'Regenerate'}
          </Button>
        </div>
      )}

      {/* Energy insight */}
      {energyInsight && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-center">
          <p className="text-lg font-semibold">{energyInsight}</p>
        </div>
      )}

      {metrics ? (
        <>
          <ShoutoutsSection
            shoutouts={metrics.shoutouts}
            manualShoutouts={manualShoutouts}
            onManualChange={v => { setManualShoutouts(v); saveField('manual_shoutouts', v); }}
            isAdmin={isAdmin}
            isPresentMode={false}
          />
          <ScoreboardSection metrics={metrics} dateLabel={dateLabel} isPresentMode={false} />
          <ObjectionSection metrics={metrics} isPresentMode={false} />
          <DrillSection
            topObjection={metrics.topObjection}
            drillOverride={drillOverride}
            onOverrideChange={v => { setDrillOverride(v || null); saveField('drill_override', v || null); }}
            isAdmin={isAdmin}
            isPresentMode={false}
          />
          <WeekAheadSection
            weekAhead={metrics.weekAhead}
            eventsNotes={eventsNotes}
            onEventsChange={v => { setEventsNotes(v); }}
            isAdmin={isAdmin}
            isPresentMode={false}
          />
          <HousekeepingSection
            notes={housekeeping}
            onChange={v => { setHousekeeping(v); saveField('housekeeping_notes', v); }}
            isAdmin={isAdmin}
            isPresentMode={false}
          />
          <WigSection
            closeRate={metrics.closeRate}
            wigTarget={wigTarget}
            wigCommitments={wigCommitments}
            previousCommitments={prevAgenda?.wig_commitments || null}
            onTargetChange={v => { setWigTarget(v); saveField('wig_target', v); }}
            onCommitmentsChange={v => { setWigCommitments(v); saveField('wig_commitments', v); }}
            isAdmin={isAdmin}
            isPresentMode={false}
          />
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          {generateMutation.isPending ? 'Generating meeting agenda...' : 'No agenda for this week yet.'}
        </div>
      )}

      {/* Status actions for admin */}
      {isAdmin && agenda && (
        <div className="flex gap-2 pt-4 border-t">
          {['draft', 'presented', 'archived'].map(status => (
            <Button
              key={status}
              variant={agenda.status === status ? 'default' : 'outline'}
              size="sm"
              onClick={async () => {
                await supabase.from('meeting_agendas').update({ status }).eq('id', agenda.id);
                toast.success(`Status set to ${status}`);
              }}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
