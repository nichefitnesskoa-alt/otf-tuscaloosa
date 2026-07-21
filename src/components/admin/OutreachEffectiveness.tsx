/**
 * Outreach Effectiveness — archived Phase Zero.
 *
 * The Win the Day reflection checklist was retired, so questionnaire-reach /
 * confirmation-rate stats no longer have a live data source. The follow-up
 * response rate still works, so this panel is intentionally stubbed to a
 * lightweight version that only shows follow-up numbers if a caller still
 * mounts it. Nothing in the app currently imports it — kept only to avoid
 * breaking any admin sub-tab that references the file.
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';
import { format, subDays } from 'date-fns';

interface FollowupLogRow {
  sa_name: string;
  log_date: string;
  contacted_count: number;
  responded_count: number;
}

export default function OutreachEffectiveness() {
  const [followupLogs, setFollowupLogs] = useState<FollowupLogRow[]>([]);

  useEffect(() => {
    (async () => {
      const start = format(subDays(new Date(), 29), 'yyyy-MM-dd');
      const end = format(new Date(), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('followup_daily_log')
        .select('sa_name, log_date, contacted_count, responded_count')
        .gte('log_date', start)
        .lte('log_date', end);
      setFollowupLogs((data || []) as any);
    })();
  }, []);

  const fuStats = useMemo(() => {
    if (followupLogs.length === 0) return null;
    const totalContacted = followupLogs.reduce((s, l) => s + l.contacted_count, 0);
    const totalResponded = followupLogs.reduce((s, l) => s + l.responded_count, 0);
    return {
      totalContacted,
      totalResponded,
      responsePct: totalContacted > 0 ? Math.round((totalResponded / totalContacted) * 100) : 0,
    };
  }, [followupLogs]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Follow-Up Response Rate (30 Days)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Questionnaire and confirmation-outreach panels were retired with Win the Day.
        </p>
      </CardHeader>
      <CardContent>
        {fuStats ? (
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-primary/10 p-3 text-center flex-1">
              <div className="text-2xl font-bold text-primary">{fuStats.responsePct}%</div>
              <div className="text-[10px] text-muted-foreground">Response Rate</div>
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>{fuStats.totalContacted} contacted</p>
              <p>{fuStats.totalResponded} responded</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No follow-up log data yet</p>
        )}
      </CardContent>
    </Card>
  );
}
