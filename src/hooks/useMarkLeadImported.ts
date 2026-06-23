/**
 * Mutation helper: toggle a self-sourced row's "imported to Mindbody" mark.
 *
 * Row id format mirrors useSaLeads.SaLeadPersonRow.id:
 *   - `lead-{uuid}` → writes leads.mindbody_imported_at / _by
 *   - `vip-{uuid}`  → writes vip_registrations.mindbody_imported_at / _by
 *   - `bk-{uuid}`   → rejected (already in Mindbody by virtue of being booked)
 *
 * Caller passes a `patchRow` from the dialog for optimistic UI.
 */
import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import type { SourcedLeadCsvRow } from '@/lib/sa/sourcedLeadsCsv';

interface Args {
  patchRow: (id: string, patch: Partial<SourcedLeadCsvRow>) => void;
}

export function useMarkLeadImported({ patchRow }: Args) {
  const { user } = useAuth();
  const [pending, setPending] = useState<Set<string>>(new Set());

  const setImported = useCallback(async (rowId: string, imported: boolean) => {
    // bk-* rows are booked already; checkbox is disabled in the UI but guard anyway.
    if (rowId.startsWith('bk-')) return;

    let table: 'leads' | 'vip_registrations' | null = null;
    let id: string | null = null;
    if (rowId.startsWith('lead-')) {
      table = 'leads';
      id = rowId.slice('lead-'.length);
    } else if (rowId.startsWith('vip-')) {
      table = 'vip_registrations';
      id = rowId.slice('vip-'.length);
    }
    if (!table || !id) return;

    setPending(prev => new Set(prev).add(rowId));

    const at = imported ? new Date().toISOString() : null;
    const by = imported ? (user?.name || 'Unknown') : null;

    // Optimistic
    patchRow(rowId, { mindbody_imported_at: at, mindbody_imported_by: by });

    const { error } = await (supabase
      .from(table) as any)
      .update({ mindbody_imported_at: at, mindbody_imported_by: by })
      .eq('id', id);

    setPending(prev => {
      const next = new Set(prev);
      next.delete(rowId);
      return next;
    });

    if (error) {
      // Revert
      patchRow(rowId, { mindbody_imported_at: imported ? null : at, mindbody_imported_by: imported ? null : by });
      toast({
        title: 'Could not update',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [patchRow, user?.name]);

  return { setImported, isPending: (id: string) => pending.has(id) };
}
