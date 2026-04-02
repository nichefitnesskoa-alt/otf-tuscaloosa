import { useMemo } from 'react';
import { useData } from '@/context/DataContext';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDisplayTime } from '@/lib/time/timeUtils';

export function ShiftIntroCards() {
  const { introsBooked } = useData();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const todayIntros = useMemo(() =>
    introsBooked
      .filter(b =>
        b.class_date === todayStr &&
        !b.deleted_at &&
        !b.is_vip
      )
      .sort((a, b) => {
        const ta = a.intro_time || '99:99';
        const tb = b.intro_time || '99:99';
        return ta.localeCompare(tb);
      }),
    [introsBooked, todayStr]
  );

  if (todayIntros.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-6">
        No intros scheduled for today.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {todayIntros.map((intro) => {
        const isSecond = !!intro.originating_booking_id;
        const qStatus = (intro as any).questionnaire_status_canon;

        return (
          <Card key={intro.id} className="border-2 border-foreground/20 overflow-hidden">
            {isSecond && (
              <div className="h-[2px] bg-info" />
            )}
            <div className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm">{intro.member_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDisplayTime(intro.intro_time)} · Coach: {intro.coach_name}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {isSecond ? (
                    <Badge variant="outline" className="text-[9px] border-info text-info">2nd Intro</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px]">1st Intro</Badge>
                  )}
                  {qStatus === 'completed' ? (
                    <Badge className="text-[9px] bg-success/20 text-success border-success/30 hover:bg-success/20">Q ✓</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] text-muted-foreground">No Q</Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
