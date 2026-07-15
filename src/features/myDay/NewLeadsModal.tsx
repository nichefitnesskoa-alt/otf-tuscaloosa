/**
 * NewLeadsModal — blocking, recurring pop-up replacement for the old
 * on-page NewLeadsAlert banner.
 *
 * TRIGGER + QUALIFICATION LOGIC IS UNCHANGED FROM NewLeadsAlert:
 *   - leads.stage = 'new'
 *   - created within the last 48 hours (Central Time cutoff)
 *   - not yet contacted (no script_send_log, lead_activities, booked_intro_id)
 *   - not already a VIP registrant (name or last-10-digit phone match)
 *   - not already booked as an intro (name match)
 *
 * The ONLY thing that changed is presentation:
 *   - Renders as a non-dismissible modal instead of a card banner.
 *   - Single confirmation CTA — "I sent a message and marked this in Unified Portal."
 *   - Confirmed lead IDs are remembered for the current tab only (sessionStorage).
 *     Any qualifying lead that is NOT in the confirmed set re-opens the modal
 *     on next page load / navigation / realtime insert.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, MessageSquare } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { getNowCentral } from '@/lib/dateUtils';
import { ScriptPickerSheet } from '@/components/scripts/ScriptPickerSheet';

interface NewLead {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  source: string;
  created_at: string;
  is_buddy_card?: boolean | null;
  referred_by_member_name?: string | null;
  referring_member_contact?: string | null;
}

const CONFIRMED_KEY = 'newLeadsModal.confirmedIds.v1';

function readConfirmed(): Set<string> {
  try {
    const raw = sessionStorage.getItem(CONFIRMED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeConfirmed(ids: Set<string>) {
  try {
    sessionStorage.setItem(CONFIRMED_KEY, JSON.stringify([...ids]));
  } catch {
    /* noop */
  }
}

export function NewLeadsModal() {
  const location = useLocation();
  const [leads, setLeads] = useState<NewLead[]>([]);
  const [open, setOpen] = useState(false);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const confirmedRef = useRef<Set<string>>(readConfirmed());

  const fetchNewLeads = useCallback(async () => {
    const now = getNowCentral();
    const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    const { data: newLeads } = await supabase
      .from('leads')
      .select(
        'id, first_name, last_name, phone, source, created_at, is_buddy_card, referred_by_member_name, referring_member_contact'
      )
      .eq('stage', 'new')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false });

    if (!newLeads || newLeads.length === 0) {
      setLeads([]);
      return;
    }

    const ids = newLeads.map((l) => l.id);

    const [sendLogRes, activitiesRes, bookedByIdRes, vipRegsRes] = await Promise.all([
      supabase.from('script_send_log').select('lead_id').in('lead_id', ids),
      supabase.from('lead_activities').select('lead_id').in('lead_id', ids),
      supabase
        .from('leads')
        .select('id, booked_intro_id')
        .in('id', ids)
        .not('booked_intro_id', 'is', null),
      supabase.from('vip_registrations').select('first_name, last_name, phone'),
    ]);

    const contactedIds = new Set<string>();
    (sendLogRes.data || []).forEach((r: any) => { if (r.lead_id) contactedIds.add(r.lead_id); });
    (activitiesRes.data || []).forEach((r: any) => { if (r.lead_id) contactedIds.add(r.lead_id); });
    (bookedByIdRes.data || []).forEach((r: any) => { if (r.id) contactedIds.add(r.id); });

    const normPhone = (p: string | null | undefined) => (p || '').replace(/\D/g, '').slice(-10);
    const vipNameSet = new Set<string>();
    const vipPhoneSet = new Set<string>();
    (vipRegsRes.data || []).forEach((r: any) => {
      const fullName = `${r.first_name || ''} ${r.last_name || ''}`.trim().toLowerCase();
      if (fullName) vipNameSet.add(fullName);
      const ph = normPhone(r.phone);
      if (ph.length === 10) vipPhoneSet.add(ph);
    });

    newLeads.forEach((l) => {
      const fullName = `${l.first_name} ${l.last_name}`.trim().toLowerCase();
      const ph = normPhone(l.phone);
      if (vipNameSet.has(fullName) || (ph.length === 10 && vipPhoneSet.has(ph))) {
        contactedIds.add(l.id);
      }
    });

    const leadNames = newLeads
      .filter((l) => !contactedIds.has(l.id))
      .map((l) => `${l.first_name} ${l.last_name}`.trim().toLowerCase());

    if (leadNames.length > 0) {
      const { data: bookedNames } = await supabase
        .from('intros_booked')
        .select('member_name')
        .not('booking_status_canon', 'in', '("DELETED_SOFT","DUPLICATE")');

      const bookedNameSet = new Set(
        (bookedNames || []).map((b: any) => (b.member_name || '').toLowerCase().trim())
      );

      newLeads.forEach((l) => {
        const fullName = `${l.first_name} ${l.last_name}`.trim().toLowerCase();
        if (bookedNameSet.has(fullName)) contactedIds.add(l.id);
      });
    }

    const untouched = newLeads.filter((l) => !contactedIds.has(l.id));
    setLeads(untouched);
  }, []);

  // Fetch on mount + on route change (so it reappears on every navigation)
  useEffect(() => {
    fetchNewLeads();
  }, [fetchNewLeads, location.pathname]);

  // Realtime — same channel semantics as the old banner
  useEffect(() => {
    const channel = supabase
      .channel('new-leads-modal-watch')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        () => fetchNewLeads()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lead_activities' },
        (payload) => {
          const leadId = (payload.new as any)?.lead_id;
          if (leadId) setLeads((prev) => prev.filter((l) => l.id !== leadId));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'script_send_log' },
        (payload) => {
          const leadId = (payload.new as any)?.lead_id;
          if (leadId) setLeads((prev) => prev.filter((l) => l.id !== leadId));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'intros_booked' },
        (payload) => {
          const bookedName = ((payload.new as any)?.member_name || '').toLowerCase().trim();
          if (bookedName) {
            setLeads((prev) =>
              prev.filter((l) => `${l.first_name} ${l.last_name}`.trim().toLowerCase() !== bookedName)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNewLeads]);

  // Open the modal whenever there's at least one qualifying lead the user
  // hasn't already confirmed in this tab.
  useEffect(() => {
    const unconfirmed = leads.some((l) => !confirmedRef.current.has(l.id));
    if (unconfirmed) setOpen(true);
    else setOpen(false);
  }, [leads]);

  const markHandled = useCallback((leadId: string) => {
    const next = new Set(confirmedRef.current);
    next.add(leadId);
    confirmedRef.current = next;
    writeConfirmed(next);
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
  }, []);

  const activeLead = activeLeadId ? leads.find((l) => l.id === activeLeadId) : null;

  if (leads.length === 0) return null;

  return (
    <>
      <Dialog
        open={open && !activeLeadId}
        onOpenChange={() => {
          /* intentionally ignored — each lead must be handled individually */
        }}
      >
        <DialogContent
          className="max-w-md [&>button]:hidden"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              New Leads — Respond Now
            </DialogTitle>
            <DialogDescription>
              {leads.length} new lead{leads.length !== 1 ? 's' : ''} waiting for a first touch.
              Open each one, send a script, and copy their phone number to mark them handled.
            </DialogDescription>
          </DialogHeader>

          <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
            {leads.map((lead) => (
              <div key={lead.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-medium">
                    {lead.first_name} {lead.last_name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {lead.is_buddy_card ? (
                      <Badge className="text-xs px-1.5 py-0 h-5 bg-[#FF6900] text-black hover:bg-[#FF6900]">
                        Buddy Card
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                        {lead.source}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(parseISO(lead.created_at), { addSuffix: true })}
                    </span>
                    {lead.phone && (
                      <span className="text-xs text-muted-foreground">· {lead.phone}</span>
                    )}
                  </div>
                  {lead.is_buddy_card && lead.referred_by_member_name && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Referred by{' '}
                      <span className="font-medium text-foreground">
                        {lead.referred_by_member_name}
                      </span>
                      {lead.referring_member_contact ? ` · ${lead.referring_member_contact}` : ''}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => setActiveLeadId(lead.id)}
                  className="shrink-0 min-h-[44px] bg-[#E8540A] hover:bg-[#E8540A]/90 text-white gap-1.5"
                >
                  <MessageSquare className="w-4 h-4" />
                  Send script
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {activeLead && (
        <ScriptPickerSheet
          open={!!activeLeadId}
          onOpenChange={(o) => { if (!o) setActiveLeadId(null); }}
          suggestedCategories={['web_lead']}
          mergeContext={{
            'first-name': activeLead.first_name,
            'last-name': activeLead.last_name,
          }}
          leadId={activeLead.id}
          onPhoneCopied={() => {
            const id = activeLead.id;
            setActiveLeadId(null);
            markHandled(id);
          }}
        />
      )}
    </>
  );
}
