/**
 * MyDayNewLeadsTab — New Leads tab content for MyDay.
 * Sub-tabs: New | Flagged | Contacted | Booked | Already in System
 * Reads from the `leads` table with real-time Supabase subscription.
 * Also listens for new intros_booked / intros_run rows to retrigger dedup in background.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { differenceInMinutes, parseISO, format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Copy, CalendarPlus, MessageSquare, CheckCircle,
  Ban, RotateCcw, Info, ExternalLink, Search, Loader2, XCircle,
} from 'lucide-react';
import { StatusBanner } from '@/components/shared/StatusBanner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { BookIntroDialog } from '@/components/leads/BookIntroDialog';
import { MarkLostDialog } from '@/components/leads/MarkLostDialog';
import { ScriptPickerSheet } from '@/components/scripts/ScriptPickerSheet';
import { runDeduplicationForLead, detectDuplicate, type DuplicateResult } from '@/lib/leads/detectDuplicate';
import { useJourneyCard } from '@/components/person/useJourneyCard';

// Speed-to-lead helpers
function getSpeedInfo(createdAt: string) {
  const minutesSince = differenceInMinutes(new Date(), parseISO(createdAt));
  const hoursSince = minutesSince / 60;
  if (hoursSince >= 4) return { color: 'hsl(var(--status-danger))', text: '🔴 Overdue — Contact Now' };
  if (hoursSince >= 1) return { color: 'hsl(var(--status-warning))', text: `⚠ Contact Soon — ${Math.floor(hoursSince)}h since received` };
  return { color: 'hsl(var(--status-success))', text: `✓ New Lead — ${minutesSince}m ago` };
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function SpeedToLeadBanner({ leads }: { leads: Lead[] }) {
  const newLeads = leads.filter(l => l.stage === 'new');
  // Treat any lead that has progressed past New as "contacted" for speed-to-lead
  const contactedLeads = leads.filter(l =>
    l.stage === 'contacted' || l.stage === 'booked' || l.stage === 'won'
  );

  const overdue = newLeads.filter(l => differenceInMinutes(new Date(), parseISO(l.created_at)) >= 240).length;
  const warning = newLeads.filter(l => {
    const m = differenceInMinutes(new Date(), parseISO(l.created_at));
    return m >= 60 && m < 240;
  }).length;

  // Fetch first-contact time from lead_activities + script_send_log for accurate speed-to-lead.
  // Bug fix: handleAction('contacted') writes activity_type='stage_change' (not 'contacted'),
  // so the previous filter never matched. We now union multiple signals and take the earliest.
  const [responseTimes, setResponseTimes] = useState<number[]>([]);
  const [activityLoaded, setActivityLoaded] = useState(false);

  useEffect(() => {
    if (contactedLeads.length === 0) {
      setResponseTimes([]);
      setActivityLoaded(true);
      return;
    }
    const contactedIds = contactedLeads.map(l => l.id);
    Promise.all([
      supabase
        .from('lead_activities')
        .select('lead_id, created_at, activity_type, notes')
        .in('lead_id', contactedIds)
        .order('created_at', { ascending: true }),
      supabase
        .from('script_send_log')
        .select('lead_id, sent_at')
        .in('lead_id', contactedIds)
        .order('sent_at', { ascending: true }),
    ]).then(([activitiesRes, sendLogRes]) => {
      const firstContactMap = new Map<string, string>();
      const consider = (leadId: string | null | undefined, ts: string | null | undefined) => {
        if (!leadId || !ts) return;
        const existing = firstContactMap.get(leadId);
        if (!existing || ts < existing) firstContactMap.set(leadId, ts);
      };
      for (const row of (activitiesRes.data as any[]) || []) {
        const isContact =
          row.activity_type === 'contacted' ||
          row.activity_type === 'script_sent' ||
          (row.activity_type === 'stage_change' &&
            typeof row.notes === 'string' &&
            /contacted|booked/i.test(row.notes));
        if (isContact) consider(row.lead_id, row.created_at);
      }
      for (const row of (sendLogRes.data as any[]) || []) {
        consider(row.lead_id, row.created_at);
      }
      const times: number[] = [];
      for (const lead of contactedLeads) {
        const contactTime = firstContactMap.get(lead.id);
        if (contactTime) {
          const mins = differenceInMinutes(parseISO(contactTime), parseISO(lead.created_at));
          if (mins >= 0) times.push(mins);
        }
      }
      setResponseTimes(times);
      setActivityLoaded(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactedLeads.length, contactedLeads.map(l => l.id).join(',')]);

  const avgResponse = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : null;
  const bestResponse = responseTimes.length > 0
    ? Math.min(...responseTimes)
    : null;

  const statusColor = overdue > 0 ? 'border-destructive/40 bg-destructive/5' : warning > 0 ? 'border-warning bg-warning-dim' : 'border-success bg-success-dim';

  return (
    <div className={`rounded-lg border-2 ${statusColor} p-2.5`}>
      <p className="text-[11px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Speed to Lead</p>
      <div className="flex items-center gap-3 flex-wrap text-[12px]">
        {!activityLoaded ? (
          <span className="text-muted-foreground">Loading…</span>
        ) : avgResponse !== null ? (
          <>
            <span className="text-foreground font-medium">Avg: {formatDuration(avgResponse)}</span>
            <span className="text-foreground font-medium">Best: {formatDuration(bestResponse!)}</span>
          </>
        ) : (
          <span className="text-muted-foreground">No contacts yet</span>
        )}
        {overdue > 0 && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">🔴 {overdue} Overdue</Badge>
        )}
        {warning > 0 && (
          <Badge className="text-[10px] px-1.5 py-0 h-4 bg-warning-dim text-primary-foreground">⚠ {warning} Soon</Badge>
        )}
        {overdue === 0 && warning === 0 && newLeads.length === 0 && activityLoaded && avgResponse !== null && (
          <span className="text-muted-foreground">All clear</span>
        )}
        {overdue === 0 && warning === 0 && newLeads.length > 0 && (
          <Badge className="text-[10px] px-1.5 py-0 h-4 bg-success-dim text-primary-foreground">✓ All fresh</Badge>
        )}
      </div>
    </div>
  );
}

type Lead = Tables<'leads'> & {
  duplicate_notes?: string | null;
  duplicate_confidence?: string | null;
  duplicate_match_type?: string | null;
  duplicate_override?: boolean | null;
};

type LeadAction =
  | 'contacted'
  | 'move_to_new'
  | 'confirm_duplicate'
  | 'confirm_not_duplicate'
  | 'mark_lost';

// ─── Lead Card ───────────────────────────────────────────────────────────────
interface LeadCardProps {
  lead: Lead;
  onAction: (leadId: string, action: LeadAction) => void;
  onBook: (lead: Lead) => void;
  onScript: (lead: Lead) => void;
}

function LeadCard({ lead, onAction, onBook, onScript }: LeadCardProps) {
  const [findResult, setFindResult] = useState<DuplicateResult | null>(null);
  const [finding, setFinding] = useState(false);
  const journey = useJourneyCard('My Day · New Leads');

  const stage = lead.stage;
  const isNew = stage === 'new';
  const isFlagged = stage === 'flagged';
  const isContacted = stage === 'contacted';
  const isBooked = stage === 'booked' || stage === 'won';
  const isAlreadyInSystem = stage === 'already_in_system';
  const hasLowFlag = isNew && lead.duplicate_confidence === 'LOW';

  const handleCopyPhone = async () => {
    if (lead.phone) { await navigator.clipboard.writeText(lead.phone); toast.success('Phone copied!'); }
    else toast.info('No phone on file');
  };

  const handleFindInSystem = async () => {
    setFinding(true);
    try {
      const result = await detectDuplicate({ first_name: lead.first_name, last_name: lead.last_name, phone: lead.phone, email: lead.email });
      setFindResult(result);
    } finally {
      setFinding(false);
    }
  };

  // Banner + border colors
  let borderColor = 'hsl(var(--status-neutral))', bannerBg = 'hsl(var(--status-neutral))', bannerText = '';
  if (isAlreadyInSystem) {
    bannerText = `✗ Already in System — ${lead.duplicate_notes || 'Existing record found'}`;
  } else if (isFlagged) {
    borderColor = 'hsl(var(--status-warning))'; bannerBg = 'hsl(var(--status-warning))';
    bannerText = '⚠ Possible Duplicate — Review Before Contacting';
  } else if (isBooked) {
    borderColor = 'hsl(var(--status-success))'; bannerBg = 'hsl(var(--status-success))'; bannerText = '✓ Booked';
  } else if (isContacted) {
    bannerText = '✓ Contacted';
  } else {
    const s = getSpeedInfo(lead.created_at);
    borderColor = s.color; bannerBg = s.color; bannerText = s.text;
  }

  // Per-card speed-to-lead timing
  const createdAt = parseISO(lead.created_at);
  const minutesSinceCreated = differenceInMinutes(new Date(), createdAt);
  const receivedLabel = format(createdAt, 'MMM d · h:mm aa');
  const responseMinutes = isContacted
    ? differenceInMinutes(parseISO(lead.updated_at), createdAt)
    : null;

  return (
    <div className="rounded-lg overflow-hidden bg-card" style={{ border: `2px solid ${borderColor}` }}>
      <StatusBanner bgColor={bannerBg} text={bannerText} />
      <div className="p-3 space-y-2 opacity-100 rounded-none border-none text-justify">
        {/* Name + source + phone */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => journey.open({ name: `${lead.first_name} ${lead.last_name}`.trim(), phone: lead.phone || null, email: lead.email || null })}
                className="font-bold text-[15px] leading-tight hover:underline cursor-pointer text-left"
              >
                {lead.first_name} {lead.last_name}
              </button>
              {hasLowFlag && (
                <span title={lead.duplicate_notes || 'Possible name match — verify before contacting'}>
                  <Info className="w-3.5 h-3.5 text-muted-foreground" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{lead.source}</Badge>
              {lead.phone
                ? <span className="text-[11px] text-muted-foreground">{lead.phone}</span>
                : <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Phone missing</Badge>}
            </div>
            {/* Received timestamp */}
            <p className="text-[10px] text-muted-foreground mt-1">Received: {receivedLabel}</p>
            {/* Individual speed metric */}
            {isNew && (
              <p className={`text-[11px] font-semibold mt-0.5 ${minutesSinceCreated >= 240 ? 'text-destructive' : minutesSinceCreated >= 60 ? 'text-warning' : 'text-success'}`}>
                ⏱ {formatDuration(minutesSinceCreated)} waiting
              </p>
            )}
            {isContacted && responseMinutes !== null && responseMinutes >= 0 && (
              <p className="text-[11px] font-medium text-muted-foreground mt-0.5">
                Responded in {formatDuration(responseMinutes)}
              </p>
            )}
          </div>
        </div>

        {/* Match details */}
        {isFlagged && lead.duplicate_notes && (
          <div className="rounded bg-warning-dim border border-warning px-2.5 py-1.5 text-[11px] text-warning">
            ⚠ {lead.duplicate_notes}
          </div>
        )}
        {isAlreadyInSystem && lead.duplicate_notes && (
          <div className="rounded bg-muted/60 border border-muted-foreground/20 px-2.5 py-1.5 text-[11px] text-muted-foreground">
            {lead.duplicate_notes}
          </div>
        )}

        {/* ── Find in System button (New + Flagged only) ── */}
        {(isNew || isFlagged) && (
          <div className="space-y-1.5">
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1" onClick={handleFindInSystem} disabled={finding}>
              {finding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              🔍 Find in System
            </Button>
            {findResult && (
              <div className={`rounded px-2.5 py-1.5 text-[11px] ${findResult.isDuplicate ? 'bg-warning-dim border border-warning text-warning' : 'bg-muted/50 border border-border text-muted-foreground'}`}>
                {findResult.isDuplicate
                  ? <>✓ Match found — {findResult.summaryNote}
                    <div className="flex gap-1.5 mt-1.5">
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => onAction(lead.id, 'confirm_duplicate')}>Confirm → Move to In System</Button>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setFindResult(null)}>Dismiss</Button>
                    </div>
                  </>
                  : 'No match found — safe to contact'}
              </div>
            )}
          </div>
        )}

        {/* ── Visible action buttons — per tab state ── */}
        {isNew && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1" onClick={() => onScript(lead)}>
              <MessageSquare className="w-3.5 h-3.5" /> Script
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1" onClick={() => onBook(lead)}>
              <CalendarPlus className="w-3.5 h-3.5" /> Book Intro
            </Button>
            {lead.phone && (
              <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1" onClick={handleCopyPhone}>
                <Copy className="w-3.5 h-3.5" /> Copy #
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1 text-muted-foreground" onClick={() => onAction(lead.id, 'contacted')}>
              <CheckCircle className="w-3.5 h-3.5" /> Contacted
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1 text-muted-foreground" onClick={() => onAction(lead.id, 'confirm_duplicate')}>
              <Ban className="w-3.5 h-3.5" /> Mark in System
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1 border-destructive text-destructive hover:bg-destructive/10" onClick={() => onAction(lead.id, 'mark_lost')}>
              <XCircle className="w-3.5 h-3.5" /> Not Interested
            </Button>
          </div>
        )}

        {isFlagged && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1 border-destructive text-destructive" onClick={() => onAction(lead.id, 'confirm_duplicate')}>
              <Ban className="w-3.5 h-3.5" /> Confirm Duplicate
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1 text-success border-success" onClick={() => onAction(lead.id, 'confirm_not_duplicate')}>
              <CheckCircle className="w-3.5 h-3.5" /> Not a Duplicate
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1" onClick={() => onBook(lead)}>
              <CalendarPlus className="w-3.5 h-3.5" /> Book Intro
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1 border-destructive text-destructive hover:bg-destructive/10" onClick={() => onAction(lead.id, 'mark_lost')}>
              <XCircle className="w-3.5 h-3.5" /> Not Interested
            </Button>
          </div>
        )}

        {isContacted && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1" onClick={() => onScript(lead)}>
              <MessageSquare className="w-3.5 h-3.5" /> Script
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1" onClick={() => onBook(lead)}>
              <CalendarPlus className="w-3.5 h-3.5" /> Book
            </Button>
            {lead.phone && (
              <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1" onClick={handleCopyPhone}>
                <Copy className="w-3.5 h-3.5" /> Copy #
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1 text-muted-foreground" onClick={() => onAction(lead.id, 'move_to_new')}>
              <RotateCcw className="w-3.5 h-3.5" /> Move to New
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1 border-destructive text-destructive hover:bg-destructive/10" onClick={() => onAction(lead.id, 'mark_lost')}>
              <XCircle className="w-3.5 h-3.5" /> Not Interested
            </Button>
          </div>
        )}

        {isBooked && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1" onClick={() => onScript(lead)}>
              <MessageSquare className="w-3.5 h-3.5" /> Script
            </Button>
            {lead.phone && (
              <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1" onClick={handleCopyPhone}>
                <Copy className="w-3.5 h-3.5" /> Copy #
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1 text-muted-foreground" onClick={() => onAction(lead.id, 'move_to_new')}>
              <ExternalLink className="w-3.5 h-3.5" /> View Booking
            </Button>
          </div>
        )}

        {isAlreadyInSystem && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1" onClick={() => onBook(lead)}>
              <CalendarPlus className="w-3.5 h-3.5" /> Book Intro
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1 text-muted-foreground" onClick={() => onAction(lead.id, 'move_to_new')}>
              <RotateCcw className="w-3.5 h-3.5" /> Move to New
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1 border-destructive text-destructive hover:bg-destructive/10" onClick={() => onAction(lead.id, 'mark_lost')}>
              <XCircle className="w-3.5 h-3.5" /> Not Interested
            </Button>
          </div>
        )}
      </div>
      {journey.element}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────
function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center py-8">
      <p className="text-muted-foreground text-sm">No {label} leads</p>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
interface MyDayNewLeadsTabProps {
  onCountChange: (count: number) => void;
}

export function MyDayNewLeadsTab({ onCountChange }: MyDayNewLeadsTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookLead, setBookLead] = useState<Lead | null>(null);
  const [scriptLead, setScriptLead] = useState<Lead | null>(null);
  const [lostLeadId, setLostLeadId] = useState<string | null>(null);
  const [confirmContactLead, setConfirmContactLead] = useState<Lead | null>(null);
  const [subTab, setSubTab] = useState('non_contacted');
  const [search, setSearch] = useState('');
  const dedupRunning = useRef(false);
  // Stable refs so backgroundDedupRecheck doesn't change identity each render (avoids React #300)
  const leadsRef = useRef<Lead[]>([]);
  const fetchLeadsRef = useRef<() => Promise<void>>(async () => {});

  const fetchLeads = useCallback(async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .not('stage', 'in', '("lost","archived")')
      .order('created_at', { ascending: false })
      .limit(300);
    if (!error && data) {
      setLeads(data as Lead[]);
      leadsRef.current = data as Lead[];
      onCountChange((data as Lead[]).filter(l => l.stage === 'new').length);
    }
    setLoading(false);
  }, [onCountChange]);

  // Keep fetchLeadsRef current
  fetchLeadsRef.current = fetchLeads;

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const backgroundDedupRecheck = useCallback(async () => {
    if (dedupRunning.current) return;
    dedupRunning.current = true;
    try {
      const active = leadsRef.current.filter(l =>
        (l.stage === 'new' || l.stage === 'contacted') && !l.duplicate_override
      );
      if (active.length === 0) return;
      for (const lead of active) {
        await runDeduplicationForLead(lead.id, {
          first_name: lead.first_name,
          last_name: lead.last_name,
          phone: lead.phone,
          email: lead.email,
          stage: lead.stage,
          duplicate_override: lead.duplicate_override ?? false,
        });
      }
      await fetchLeadsRef.current();
    } finally {
      dedupRunning.current = false;
    }
  // Stable — uses refs, no deps
  }, []);

  // Run background dedup on mount + every 5 minutes
  useEffect(() => {
    const timer = setTimeout(() => backgroundDedupRecheck(), 1500);
    const interval = setInterval(() => backgroundDedupRecheck(), 5 * 60 * 1000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [backgroundDedupRecheck]);

  // ── Real-time subscriptions ──────────────────────────────────────────────
  useEffect(() => {
    // Leads table — instant UI updates
    const leadsChannel = supabase
      .channel('myday-leads-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (payload) => {
        const newLead = payload.new as Lead;
        setLeads(prev => {
          if (prev.find(l => l.id === newLead.id)) return prev;
          const updated = [newLead, ...prev];
          onCountChange(updated.filter(l => l.stage === 'new').length);
          return updated;
        });
        if (newLead.stage !== 'already_in_system') {
          toast.info(`New lead — ${newLead.first_name} ${newLead.last_name} from ${newLead.source}`);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, (payload) => {
        const updated = payload.new as Lead;
        setLeads(prev => {
          const next = prev.map(l => l.id === updated.id ? updated : l);
          onCountChange(next.filter(l => l.stage === 'new').length);
          return next;
        });
      })
      .subscribe();

    // Direction 4 — intros_booked: new booking → re-run dedup on active leads
    const bookingsChannel = supabase
      .channel('myday-intros-booked-dedup')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'intros_booked' }, async () => {
        // Small delay to let the DB settle
        await new Promise(r => setTimeout(r, 800));
        backgroundDedupRecheck();
      })
      .subscribe();

    // Direction 4 — intros_run: new outcome → re-run dedup on active leads
    const runsChannel = supabase
      .channel('myday-intros-run-dedup')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'intros_run' }, async () => {
        await new Promise(r => setTimeout(r, 800));
        backgroundDedupRecheck();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(bookingsChannel);
      supabase.removeChannel(runsChannel);
    };
  }, [onCountChange, backgroundDedupRecheck]);

  const handleAction = async (leadId: string, action: LeadAction) => {
    if (action === 'mark_lost') {
      setLostLeadId(leadId);
      return;
    }

    let update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    let activityNote = '';

    switch (action) {
      case 'contacted':
        update.stage = 'contacted';
        activityNote = 'Marked as Contacted from MyDay';
        break;
      case 'move_to_new':
        update.stage = 'new';
        update.duplicate_override = false;
        activityNote = 'Moved back to New from MyDay';
        break;
      case 'confirm_duplicate':
        update.stage = 'already_in_system';
        activityNote = 'Confirmed as duplicate — Already in System';
        break;
      case 'confirm_not_duplicate':
        update.stage = 'new';
        update.duplicate_override = true;
        update.duplicate_confidence = 'NONE';
        update.duplicate_notes = null;
        activityNote = 'Confirmed NOT a duplicate — moved to New';
        toast.success('Lead confirmed as unique — will not be auto-flagged again');
        break;
    }

    await supabase.from('leads').update(update).eq('id', leadId);
    if (activityNote) {
      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        activity_type: 'stage_change',
        performed_by: user?.name || 'Unknown',
        notes: activityNote,
      });
    }
    fetchLeads();
    queryClient.invalidateQueries({ queryKey: ['leads'] });
  };

  const handleBookDone = () => {
    setBookLead(null);
    fetchLeads();
    queryClient.invalidateQueries({ queryKey: ['leads'] });
  };

  const scriptMergeContext = scriptLead ? {
    'first-name': scriptLead.first_name,
    'last-name': scriptLead.last_name,
    'sa-name': user?.name || '',
    'location-name': 'Tuscaloosa',
  } : {};

  const nonContactedLeads = leads.filter(l => l.stage === 'new');
  // Contacted = anyone past New (includes booked/won).
  const contactedLeads = leads.filter(l =>
    l.stage === 'contacted' || l.stage === 'booked' || l.stage === 'won'
  );

  const filterBySearch = (list: Lead[]) => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    const digits = q.replace(/\D/g, '');
    return list.filter(l => {
      const name = `${l.first_name ?? ''} ${l.last_name ?? ''}`.toLowerCase();
      if (name.includes(q)) return true;
      if (digits && l.phone) {
        const phoneDigits = l.phone.replace(/\D/g, '');
        if (phoneDigits.includes(digits)) return true;
      }
      return false;
    });
  };

  const renderList = (list: Lead[], emptyLabel: string) => {
    if (loading) return <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>;
    const filtered = filterBySearch(list);
    if (filtered.length === 0) {
      return search.trim()
        ? <div className="text-center py-8"><p className="text-muted-foreground text-sm">No matches for "{search}"</p></div>
        : <EmptyState label={emptyLabel} />;
    }
    return (
      <div className="space-y-2.5">
        {filtered.map(lead => (
          <LeadCard key={lead.id} lead={lead} onAction={handleAction} onBook={setBookLead} onScript={setScriptLead} />
        ))}
      </div>
    );
  };

  const activeList = subTab === 'non_contacted' ? nonContactedLeads : contactedLeads;
  const matchCount = filterBySearch(activeList).length;
  const activeLabel = subTab === 'non_contacted' ? 'Non-Contacted' : 'Contacted';

  return (
    <div className="space-y-3">
      <SpeedToLeadBanner leads={leads} />
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="w-full flex h-auto gap-0.5 bg-muted/60 p-0.5 rounded-lg flex-wrap">
          <TabsTrigger value="non_contacted" className="flex-1 text-[10px] py-1.5 flex items-center gap-1 justify-center rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
            Non-Contacted
            {nonContactedLeads.length > 0 && <Badge variant="secondary" className="h-3.5 px-1 text-[9px] min-w-[16px]">{nonContactedLeads.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="contacted" className="flex-1 text-[10px] py-1.5 flex items-center gap-1 justify-center rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
            Contacted
            {contactedLeads.length > 0 && <Badge variant="secondary" className="h-3.5 px-1 text-[9px] min-w-[16px]">{contactedLeads.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Search bar — filters whichever tab is active */}
        <div className="mt-2 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search leads by name or phone…"
            className="pl-8 pr-16 h-9 text-[13px]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              aria-label="Clear search"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {search.trim() && (
          <p className="text-[11px] text-muted-foreground mt-1 px-1">
            {matchCount} match{matchCount === 1 ? '' : 'es'} in {activeLabel}
          </p>
        )}

        <TabsContent value="non_contacted" className="mt-2">
          {renderList([...nonContactedLeads].sort((a, b) => b.created_at.localeCompare(a.created_at)), 'non-contacted')}
        </TabsContent>
        <TabsContent value="contacted" className="mt-2">
          {renderList([...contactedLeads].sort((a, b) => b.created_at.localeCompare(a.created_at)), 'contacted')}
        </TabsContent>
      </Tabs>


      {bookLead && (
        <BookIntroDialog
          open={!!bookLead}
          onOpenChange={open => { if (!open) setBookLead(null); }}
          lead={bookLead}
          onDone={handleBookDone}
        />
      )}
      {scriptLead && (
        <ScriptPickerSheet
          open={!!scriptLead}
          onOpenChange={open => { if (!open) setScriptLead(null); }}
          suggestedCategories={
            scriptLead.source?.toLowerCase().includes('instagram') || scriptLead.source?.toLowerCase() === 'ig'
              ? ['ig_dm', 'web_lead', 'cold_lead', 'outreach']
              : scriptLead.stage === 'booked'
                ? ['confirmation', 'web_lead', 'outreach']
                : ['web_lead', 'ig_dm', 'cold_lead', 'outreach']
          }
          mergeContext={scriptMergeContext}
          leadId={scriptLead.id}
          onLogged={() => {
            const sent = scriptLead;
            setScriptLead(null);
            if (sent && sent.stage === 'new') {
              setConfirmContactLead(sent);
            }
          }}
        />
      )}
      {confirmContactLead && (
        <AlertDialog open={!!confirmContactLead} onOpenChange={open => { if (!open) setConfirmContactLead(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Mark as Contacted?</AlertDialogTitle>
              <AlertDialogDescription>
                You just sent a script to {confirmContactLead.first_name} {confirmContactLead.last_name}. Move them to the Contacted list?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Not yet</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const id = confirmContactLead.id;
                  setConfirmContactLead(null);
                  handleAction(id, 'contacted');
                }}
              >
                Yes, mark Contacted
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {lostLeadId && (
        <MarkLostDialog
          open={!!lostLeadId}
          onOpenChange={open => { if (!open) setLostLeadId(null); }}
          leadId={lostLeadId}
          onDone={() => {
            setLostLeadId(null);
            fetchLeads();
            queryClient.invalidateQueries({ queryKey: ['leads'] });
          }}
        />
      )}
    </div>
  );
}
