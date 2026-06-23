/**
 * Mutation helper: toggle a lead's "imported to Mindbody" mark.
 *
 * Writes leads.mindbody_imported_at + leads.mindbody_imported_by.
 * Caller passes a `patchRow` from useSourcedLeadsInRange for optimistic UI.
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

  const setImported = useCallback(async (leadId: string, imported: boolean) => {
    if (leadId.startsWith('booking:')) return; // synthetic row — already booked
    setPending(prev => new Set(prev).add(leadId));

    const at = imported ? new Date().toISOString() : null;
    const by = imported ? (user?.name || 'Unknown') : null;

    // Optimistic
    patchRow(leadId, { mindbody_imported_at: at, mindbody_imported_by: by });

    const { error } = await (supabase
      .from('leads') as any)
      .update({ mindbody_imported_at: at, mindbody_imported_by: by })
      .eq('id', leadId);

    setPending(prev => {
      const next = new Set(prev);
      next.delete(leadId);
      return next;
    });

    if (error) {
      // Revert
      patchRow(leadId, { mindbody_imported_at: imported ? null : at, mindbody_imported_by: imported ? null : by });
      toast({
        title: 'Could not update',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [patchRow, user?.name]);

  return { setImported, isPending: (id: string) => pending.has(id) };
}
