/**
 * Outreach Lists — landing page. Lists grouped by campaign_tag with
 * per-list contact progress. Reusable for any campaign — no SOML strings.
 */
import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, ListChecks } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isAdmin as isAdminCheck } from '@/lib/auth/roles';
import { useOutreachLists } from '@/features/outreach/useOutreach';

export default function OutreachLists() {
  const { user } = useAuth();
  const isAdmin = isAdminCheck(user);
  const { lists, actionCounts, loading } = useOutreachLists();

  const grouped = useMemo(() => {
    const map = new Map<string, typeof lists>();
    lists.forEach(l => {
      const arr = map.get(l.campaign_tag) || [];
      arr.push(l);
      map.set(l.campaign_tag, arr);
    });
    return Array.from(map.entries());
  }, [lists]);

  return (
    <div className="p-4 max-w-4xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-black uppercase tracking-wide">Outreach Lists</h1>
        </div>
        {isAdmin && (
          <Button asChild size="sm">
            <Link to="/outreach-lists/new"><Plus className="w-4 h-4 mr-1" /> New list</Link>
          </Button>
        )}
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!loading && lists.length === 0 && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">
          No active outreach lists yet. {isAdmin && 'Tap "New list" to import one from a CSV or Excel file.'}
        </CardContent></Card>
      )}

      <div className="space-y-6">
        {grouped.map(([tag, arr]) => (
          <section key={tag}>
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
              {tag}
            </h2>
            <div className="grid gap-2">
              {arr.map(l => {
                const c = actionCounts[l.id] || { touched: 0, total: 0 };
                const pct = c.total > 0 ? Math.round((c.touched / c.total) * 100) : 0;
                return (
                  <Link key={l.id} to={`/outreach-lists/${l.id}`} className="block">
                    <Card className="hover:border-primary/60 transition-colors">
                      <CardContent className="p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{l.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {c.touched} of {c.total} contacted · {pct}%
                          </div>
                        </div>
                        <div className="w-24 h-1.5 rounded-full bg-secondary overflow-hidden shrink-0">
                          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
