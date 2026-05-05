import { useState } from 'react';
import { useScorecards } from '@/hooks/useScorecards';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ComparisonView } from '@/components/scorecard/ComparisonView';
import { format, startOfMonth } from 'date-fns';

export default function Reports() {
  const [from, setFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { data: cards = [] } = useScorecards({ from, to });
  const [openId, setOpenId] = useState<string | null>(null);

  const submitted = cards.filter(c => c.submitted_at);
  const byLevel = { 1: 0, 2: 0, 3: 0 } as Record<1 | 2 | 3, number>;
  submitted.forEach(c => byLevel[c.level]++);
  const byCoach: Record<string, { total: number; count: number; l3: number }> = {};
  submitted.forEach(c => {
    if (!byCoach[c.evaluatee_name]) byCoach[c.evaluatee_name] = { total: 0, count: 0, l3: 0 };
    byCoach[c.evaluatee_name].total += c.total_score;
    byCoach[c.evaluatee_name].count += 1;
    if (c.level === 3) byCoach[c.evaluatee_name].l3 += 1;
  });

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-black">Reports — First Visit Experience</h1>

      <Card className="p-4 flex items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="block h-10 px-2 border rounded-md" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="block h-10 px-2 border rounded-md" />
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><p className="text-[10px] uppercase text-muted-foreground">Total scored</p><p className="text-3xl font-black">{submitted.length}</p></Card>
        <Card className="p-4"><p className="text-[10px] uppercase text-muted-foreground">Level 3</p><p className="text-3xl font-black text-primary">{byLevel[3]}</p></Card>
        <Card className="p-4"><p className="text-[10px] uppercase text-muted-foreground">Level 2</p><p className="text-3xl font-black text-success">{byLevel[2]}</p></Card>
        <Card className="p-4"><p className="text-[10px] uppercase text-muted-foreground">Level 1</p><p className="text-3xl font-black text-muted-foreground">{byLevel[1]}</p></Card>
      </div>

      <Card className="p-4">
        <h3 className="font-bold text-sm mb-3">Per-coach summary</h3>
        <table className="w-full text-sm">
          <thead><tr className="border-b text-xs text-muted-foreground"><th className="text-left py-2">Coach</th><th className="text-right">Scored</th><th className="text-right">Avg</th><th className="text-right">L3</th></tr></thead>
          <tbody>
            {Object.entries(byCoach).sort((a,b) => b[1].l3 - a[1].l3).map(([name, v]) => (
              <tr key={name} className="border-b last:border-0">
                <td className="py-2 font-medium">{name}</td>
                <td className="text-right tabular-nums">{v.count}</td>
                <td className="text-right tabular-nums">{(v.total / v.count).toFixed(1)}</td>
                <td className="text-right tabular-nums font-bold text-primary">{v.l3}</td>
              </tr>
            ))}
            {Object.keys(byCoach).length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground italic">No data in range</td></tr>}
          </tbody>
        </table>
      </Card>

      <Card className="p-4">
        <h3 className="font-bold text-sm mb-3">All scorecards</h3>
        <div className="space-y-1">
          {submitted.map(s => (
            <button key={s.id} onClick={() => setOpenId(s.id)} className="w-full flex justify-between p-2 border-b hover:bg-muted text-left">
              <span className="text-sm">{format(new Date(s.class_date), 'MMM d')} · {s.evaluatee_name} · {s.practice_name || 'first-timer'}</span>
              <Badge>{`L${s.level} (${s.total_score}/15)`}</Badge>
            </button>
          ))}
        </div>
      </Card>

      <ComparisonView scorecardId={openId} open={!!openId} onOpenChange={(o) => { if (!o) setOpenId(null); }} />
    </div>
  );
}
