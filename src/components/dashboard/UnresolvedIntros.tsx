import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Filter } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { SectionHelp } from '@/components/dashboard/SectionHelp';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { InlineIntroLogger } from '@/components/dashboard/InlineIntroLogger';
import { generateFollowUpEntries } from '@/components/dashboard/FollowUpQueue';
import { formatDisplayTime, formatClassEndedBadge, normalizeDbTime } from '@/lib/time/timeUtils';

interface UnresolvedIntro {
  id: string;
  member_name: string;
  intro_time: string | null;
  coach_name: string;
  lead_source: string;
  class_date: string;
  hoursSinceClass: number;
}

interface UnresolvedIntrosProps {
  intros: UnresolvedIntro[];
  onRefresh: () => void;
}

export function UnresolvedIntros({ intros, onRefresh }: UnresolvedIntrosProps) {
  const { user } = useAuth();
  const [loggingOpenId, setLoggingOpenId] = useState<string | null>(null);
  const [showLast7DaysOnly, setShowLast7DaysOnly] = useState(true);

  if (intros.length === 0) return null;

  const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');
  const filteredIntros = showLast7DaysOnly
    ? intros.filter(b => b.class_date >= sevenDaysAgo)
    : intros;

  const handleQuickNoShow = async (b: UnresolvedIntro) => {
    const saName = user?.name || 'Unknown';
    const today = format(new Date(), 'yyyy-MM-dd');
    let shiftRecapId: string | null = null;
    const { data: recap } = await supabase
      .from('shift_recaps').select('id')
      .eq('staff_name', saName).eq('shift_date', today)
      .limit(1).maybeSingle();
    if (recap) shiftRecapId = recap.id;
    else {
      const { data: nr } = await supabase
        .from('shift_recaps')
        .insert({ staff_name: saName, shift_date: today, shift_type: 'AM' })
        .select('id').single();
      if (nr) shiftRecapId = nr.id;
    }
    await supabase.from('intros_run').insert({
      member_name: b.member_name,
      run_date: b.class_date,
      class_time: normalizeDbTime(b.intro_time) || '00:00',
      lead_source: b.lead_source,
      result: 'No-show',
      coach_name: b.coach_name,
      sa_name: saName,
      intro_owner: saName,
      linked_intro_booked_id: b.id,
      shift_recap_id: shiftRecapId,
    });
    const entries = generateFollowUpEntries(
      b.member_name, 'no_show', b.class_date, b.id, null, false, null, null,
    );
    await supabase.from('follow_up_queue').insert(entries);
    toast.success('Logged as No-show');
    onRefresh();
  };

  return (
    <Card className="border-muted">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
          Needs outcome ({filteredIntros.length})
          <SectionHelp text="These are past intros that still need an outcome logged." />
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Log an outcome for each one below
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* 7-day filter chip */}
        <div className="flex items-center gap-2">
          <Button
            variant={showLast7DaysOnly ? 'default' : 'outline'}
            size="sm"
            className="h-6 text-[10px] gap-1"
            onClick={() => setShowLast7DaysOnly(v => !v)}
          >
            <Filter className="w-2.5 h-2.5" />
            {showLast7DaysOnly ? 'Last 7 days' : 'All past-due'}
          </Button>
          {showLast7DaysOnly && intros.length !== filteredIntros.length && (
            <span className="text-[10px] text-muted-foreground">
              {intros.length - filteredIntros.length} older hidden
            </span>
          )}
        </div>

        {filteredIntros.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No past-due intros in last 7 days</p>
        ) : (
          filteredIntros.map(b => (
            <div key={b.id} className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-semibold text-sm">{b.member_name}</span>
                  <p className="text-xs text-muted-foreground">
                    {formatDisplayTime(b.intro_time)} · {b.coach_name || 'Coach TBD'}
                  </p>
                </div>
                {(() => {
                  const badge = formatClassEndedBadge(b.class_date, b.intro_time);
                  return badge ? (
                    <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">{badge}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">{b.class_date}</Badge>
                  );
                })()}
              </div>
              {loggingOpenId === b.id ? (
                <InlineIntroLogger
                  bookingId={b.id}
                  memberName={b.member_name}
                  classDate={b.class_date}
                  classTime={b.intro_time}
                  coachName={b.coach_name}
                  leadSource={b.lead_source}
                  onLogged={() => { setLoggingOpenId(null); onRefresh(); }}
                />
              ) : (
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    className="h-7 text-[11px] flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setLoggingOpenId(b.id)}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    They Showed
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] flex-1 border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                    onClick={() => handleQuickNoShow(b)}
                  >
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    No Show
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
