import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { SectionHelp } from '@/components/dashboard/SectionHelp';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { InlineIntroLogger } from '@/components/dashboard/InlineIntroLogger';
import { generateFollowUpEntries } from '@/components/dashboard/FollowUpQueue';

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

  if (intros.length === 0) return null;

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
      class_time: b.intro_time || '00:00',
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
    <Card className="border-destructive ring-2 ring-destructive/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-4 h-4 animate-pulse" />
          Unresolved Intros ({intros.length})
          <SectionHelp text="These intros already happened but nobody logged whether they showed up. Tap 'They Showed' or 'No Show' for each one so we can follow up properly." />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {intros.map(b => (
          <div key={b.id} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-semibold text-sm">{b.member_name}</span>
                <p className="text-xs text-muted-foreground">
                  {b.intro_time ? format(parseISO(`2000-01-01T${b.intro_time}`), 'h:mm a') : 'Time TBD'} · {b.coach_name}
                </p>
              </div>
              <Badge variant="destructive" className="text-[10px]">
                Class ended {Math.round(b.hoursSinceClass)}h ago
              </Badge>
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
                  variant="destructive"
                  className="h-7 text-[11px] flex-1"
                  onClick={() => handleQuickNoShow(b)}
                >
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  No Show
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
