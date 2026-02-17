import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { isToday, parseISO } from 'date-fns';

export function TouchLeaderboard() {
  const { followupTouches, followUpQueue } = useData();
  const { user } = useAuth();

  const { touchLeaders, fuLeaders } = useMemo(() => {
    // Touches today by SA
    const touchMap = new Map<string, number>();
    for (const t of followupTouches) {
      if (!isToday(parseISO(t.created_at))) continue;
      touchMap.set(t.created_by, (touchMap.get(t.created_by) || 0) + 1);
    }
    const touchLeaders = Array.from(touchMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Follow-ups done today by SA
    const fuMap = new Map<string, number>();
    for (const f of followUpQueue) {
      if (f.status !== 'sent' || !f.sent_at || !f.sent_by) continue;
      if (!isToday(parseISO(f.sent_at))) continue;
      fuMap.set(f.sent_by, (fuMap.get(f.sent_by) || 0) + 1);
    }
    const fuLeaders = Array.from(fuMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { touchLeaders, fuLeaders };
  }, [followupTouches, followUpQueue]);

  if (touchLeaders.length === 0 && fuLeaders.length === 0) return null;

  return (
    <Card className="border-muted">
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Trophy className="w-4 h-4 text-yellow-500" />
          <span className="text-xs font-semibold">Today's Leaders</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {touchLeaders.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground font-medium mb-1">Touches</p>
              {touchLeaders.map((l, i) => (
                <div key={l.name} className={`flex items-center justify-between text-[11px] py-0.5 ${l.name === user?.name ? 'font-bold text-primary' : ''}`}>
                  <span className="truncate">{i + 1}. {l.name}</span>
                  <span className="font-medium tabular-nums">{l.count}</span>
                </div>
              ))}
            </div>
          )}
          {fuLeaders.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground font-medium mb-1">Follow-ups</p>
              {fuLeaders.map((l, i) => (
                <div key={l.name} className={`flex items-center justify-between text-[11px] py-0.5 ${l.name === user?.name ? 'font-bold text-primary' : ''}`}>
                  <span className="truncate">{i + 1}. {l.name}</span>
                  <span className="font-medium tabular-nums">{l.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
