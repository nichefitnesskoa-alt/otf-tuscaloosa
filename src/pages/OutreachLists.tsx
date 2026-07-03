/**
 * Outreach Lists — landing page. Lists grouped by campaign_tag with
 * per-list contact progress. Reusable for any campaign — no SOML strings.
 */
import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, ListChecks, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { isAdmin as isAdminCheck } from '@/lib/auth/roles';
import { useOutreachLists, OutreachList } from '@/features/outreach/useOutreach';
import { supabase } from '@/integrations/supabase/client';

export default function OutreachLists() {
  const { user } = useAuth();
  const isAdmin = isAdminCheck(user);
  const { lists, actionCounts, loading, refetch } = useOutreachLists();
  const [toDelete, setToDelete] = useState<OutreachList | null>(null);
  const [deleting, setDeleting] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof lists>();
    lists.forEach(l => {
      const arr = map.get(l.campaign_tag) || [];
      arr.push(l);
      map.set(l.campaign_tag, arr);
    });
    return Array.from(map.entries());
  }, [lists]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      // Hard delete — rows + actions cascade via list_id references
      await (supabase as any).from('outreach_row_actions').delete().eq('list_id', toDelete.id);
      await (supabase as any).from('outreach_list_rows').delete().eq('list_id', toDelete.id);
      const { error } = await (supabase as any).from('outreach_lists').delete().eq('id', toDelete.id);
      if (error) throw error;
      toast.success(`Deleted "${toDelete.name}"`);
      setToDelete(null);
      refetch();
    } catch (e: any) {
      toast.error(`Delete failed: ${e.message}`);
    } finally {
      setDeleting(false);
    }
  };

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
                  <Card key={l.id} className="hover:border-primary/60 transition-colors">
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <Link to={`/outreach-lists/${l.id}`} className="flex-1 min-w-0 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{l.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {c.touched} of {c.total} contacted · {pct}%
                          </div>
                        </div>
                        <div className="w-24 h-1.5 rounded-full bg-secondary overflow-hidden shrink-0">
                          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </Link>
                      {isAdmin && (
                        <Button
                          size="icon" variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setToDelete(l); }}
                          title="Delete list"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={o => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{toDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the list, all {actionCounts[toDelete?.id || '']?.total ?? 0} people in it,
              and every logged Texted / In-Person / Save Attempt action. This cannot be undone.
              <br /><br />
              SOML upgrades and referrals already logged from this list are NOT affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete list'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
