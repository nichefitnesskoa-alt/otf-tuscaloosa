/**
 * Outreach — tabbed hub. Consolidates outreach lists, new leads, follow-up,
 * and scripts into a single home. Moved off My Day per Koa's request so
 * My Day stays focused on today's intros.
 */
import { Link, useSearchParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, ListChecks, Trash2, UserPlus, Clock, FileText, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { isAdmin as isAdminCheck } from '@/lib/auth/roles';
import { useOutreachLists, OutreachList } from '@/features/outreach/useOutreach';
import { supabase } from '@/integrations/supabase/client';

import { UnifiedPortalReminder } from '@/features/outreach/UnifiedPortalReminder';
import { BuddyCardExportButton } from '@/features/outreach/BuddyCardExportButton';
import { MyDayNewLeadsTab } from '@/features/myDay/MyDayNewLeadsTab';

import { MyDayScriptsTab } from '@/features/myDay/MyDayScriptsTab';
import FollowUpList from '@/features/followUp/FollowUpList';

export default function OutreachLists() {
  const { user } = useAuth();
  const isAdmin = isAdminCheck(user);
  const { lists, actionCounts, loading, refetch } = useOutreachLists();
  const [toDelete, setToDelete] = useState<OutreachList | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [newLeadsCount, setNewLeadsCount] = useState(0);
  const [followUpsCount, setFollowUpsCount] = useState(0);

  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'lists';
  const [tab, setTab] = useState(initialTab);
  const changeTab = (v: string) => {
    setTab(v);
    if (v === 'lists') searchParams.delete('tab');
    else searchParams.set('tab', v);
    setSearchParams(searchParams, { replace: true });
  };

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
          <MessageSquare className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-black uppercase tracking-wide">Outreach</h1>
        </div>
      </div>

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList className="w-full grid grid-cols-4 h-auto">
          <TabsTrigger value="lists" className="flex flex-col gap-0.5 py-2 text-[11px]">
            <ListChecks className="w-4 h-4" />
            <span>Lists</span>
          </TabsTrigger>
          <TabsTrigger value="leads" className="flex flex-col gap-0.5 py-2 text-[11px]">
            <UserPlus className="w-4 h-4" />
            <span>New Leads{newLeadsCount > 0 ? ` (${newLeadsCount})` : ''}</span>
          </TabsTrigger>
          <TabsTrigger value="followups" className="flex flex-col gap-0.5 py-2 text-[11px]">
            <Clock className="w-4 h-4" />
            <span>Follow-Up{followUpsCount > 0 ? ` (${followUpsCount})` : ''}</span>
          </TabsTrigger>
          <TabsTrigger value="scripts" className="flex flex-col gap-0.5 py-2 text-[11px]">
            <FileText className="w-4 h-4" />
            <span>Scripts</span>
          </TabsTrigger>
        </TabsList>

        {/* ── LISTS ── */}
        <TabsContent value="lists" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide">Campaign lists</h2>
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
            {grouped.map(([tagName, arr]) => (
              <section key={tagName}>
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                  {tagName}
                </h3>
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
        </TabsContent>

        {/* ── NEW LEADS ── */}
        <TabsContent value="leads" className="mt-4 space-y-3">
          <UnifiedPortalReminder />
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide">New Leads</h2>
              <p className="text-xs text-muted-foreground">Email-parsed leads + buddy cards — speed to contact matters</p>
            </div>
            {isAdmin && <BuddyCardExportButton />}
          </div>
          
          <MyDayNewLeadsTab onCountChange={setNewLeadsCount} />
        </TabsContent>

        {/* ── FOLLOW-UP ── */}
        <TabsContent value="followups" className="mt-4 space-y-3">
          <UnifiedPortalReminder />
          <FollowUpList onCountChange={setFollowUpsCount} />
        </TabsContent>

        {/* ── SCRIPTS ── */}
        <TabsContent value="scripts" className="mt-4 space-y-3">
          <MyDayScriptsTab />
        </TabsContent>
      </Tabs>

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
