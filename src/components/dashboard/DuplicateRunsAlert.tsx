import { useMemo, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useData } from '@/context/DataContext';
import { findDuplicateRunGroups, type RunForAudit } from '@/lib/intros/duplicateRuns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

/**
 * Surfaces intros_run rows that share the same member + run_date (the bug
 * shape that caused Alexa Brodsky's funnel drift). Admin can soft-delete
 * the bad row inline. Hidden when there are no duplicates.
 */
export function DuplicateRunsAlert() {
  const { introsRun, refreshData } = useData();
  const { user } = useAuth();
  const [target, setTarget] = useState<RunForAudit | null>(null);
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => findDuplicateRunGroups(introsRun as any), [introsRun]);

  if (groups.length === 0) return null;

  const handleDelete = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from('intros_run')
        .update({
          result: 'Deleted',
          result_canon: 'DELETED',
          commission_amount: 0,
          last_edited_by: user?.name || 'Admin',
          edit_reason: 'Soft-deleted via Duplicate Runs alert',
          last_edited_at: new Date().toISOString(),
        })
        .eq('id', target.id);
      if (error) throw error;
      toast.success(`Deleted duplicate run for ${target.member_name}`);
      setTarget(null);
      await refreshData?.();
    } catch (err) {
      console.error('Failed to soft-delete duplicate run:', err);
      toast.error('Failed to delete run');
    } finally {
      setBusy(false);
    }
  };

  const totalDupes = groups.reduce((sum, g) => sum + g.runs.length, 0);

  return (
    <>
      <Card className="border-red-600/60 bg-red-950/30">
        <CardContent className="p-3 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <p className="text-sm font-semibold text-red-200">
              Duplicate intro runs detected ({groups.length} {groups.length === 1 ? 'member' : 'members'} · {totalDupes} runs)
            </p>
          </div>
          <p className="text-xs text-red-200/80">
            More than one run was logged for the same member on the same date. This inflates conversion-funnel counts. Review and soft-delete the wrong row.
          </p>

          <div className="space-y-3">
            {groups.map(group => (
              <div key={group.key} className="rounded border border-red-500/30 bg-red-950/40">
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-red-500/20">
                  <div className="text-sm font-medium text-red-50">{group.member_name}</div>
                  <div className="text-xs text-red-200/80 tabular-nums">{group.run_date}</div>
                </div>
                <div className="divide-y divide-red-500/20">
                  {group.runs.map(run => (
                    <div key={run.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-red-50 truncate">{run.result || '—'}</div>
                        <div className="text-[11px] text-red-200/70 truncate">
                          Owner: {run.intro_owner || run.sa_name || '—'}
                          {run.coach_name ? ` · Coach: ${run.coach_name}` : ''}
                          {Number(run.commission_amount) > 0 ? ` · $${Number(run.commission_amount).toFixed(2)}` : ''}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8 px-3 shrink-0"
                        onClick={() => setTarget(run)}
                      >
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this intro run?</AlertDialogTitle>
            <AlertDialogDescription>
              Soft-deletes the run for <span className="font-medium text-foreground">{target?.member_name}</span> on {target?.run_date} ({target?.result}). Commission is zeroed and the row is hidden from metrics. The original record stays in the database for audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Delete run
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
