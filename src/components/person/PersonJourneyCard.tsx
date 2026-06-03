/**
 * PersonJourneyCard — canonical popup for a person's full intro history.
 *
 * Phase 1 surfaces:
 *   - All intros across every chain matched to the person (phone/email/name).
 *   - Per-booking facts: date, coach, booked_by, intro_owner, lead source,
 *     latest run result/buy_date, scorecard pill (if a scorecard exists).
 *   - Attribution status badge against the canonical owner rule
 *     (`computeExpectedIntroOwner`):
 *       · "✓ matches rule"
 *       · "manually overridden" (intro_owner_locked = true)
 *       · "rule says X — backfill candidate" (unlocked mismatch)
 *       · "no owner"
 *   - Inline edits for booked_by, coach_name, lead_source, class_date,
 *     intro_owner — ALL routed through the existing canonical write paths:
 *       · updateBookingFieldsFromPipeline (booking fields)
 *       · syncIntroOwnerToBooking (intro owner + lock)
 *     Outcome edits deep-link into Pipeline's existing edit dialog —
 *     we do NOT duplicate the outcome write path.
 *
 * Phase 1 scope guard: surfaces mismatches but DOES NOT auto-fix.
 * Used by WIG drilldowns and Pipeline row card (Phase 2 wires the rest).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ExternalLink, Phone, Mail, AlertTriangle, Edit, Check, X, Award } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/context/AuthContext';
import { useActiveStaff } from '@/hooks/useActiveStaff';
import { supabase } from '@/integrations/supabase/client';
import { LEAD_SOURCES } from '@/types';
import { FriendRuleNotice } from '@/components/shared/FriendRuleNotice';
import { parseLocalDate, cn } from '@/lib/utils';
import { formatPhoneDisplay } from '@/lib/parsing/phone';
import { notifyDataChanged } from '@/lib/data/invalidation';
import { computeExpectedIntroOwner, classifyIntroOwnerStatus, type IntroOwnerMismatchStatus } from '@/lib/intros/introOwnerRule';
import { isBookingExcludedFromMetrics } from '@/lib/intros/excludedBookings';
import { resolvePerson, type PersonIdentifier, type PersonResolution } from '@/lib/person/resolvePerson';
import { updateBookingFieldsFromPipeline, syncIntroOwnerToBooking } from '@/features/pipeline/pipelineActions';
import { isCloseRun } from '@/lib/intros/close-detection';
import { OutcomeEditButton } from '@/components/shared/OutcomeEditButton';

interface BookingRow {
  id: string;
  member_name: string;
  class_date: string;
  intro_time: string | null;
  coach_name: string;
  booked_by: string | null;
  intro_owner: string | null;
  intro_owner_locked: boolean | null;
  lead_source: string;
  phone: string | null;
  phone_e164: string | null;
  email: string | null;
  originating_booking_id: string | null;
  booking_status: string | null;
  booking_status_canon: string;
  deleted_at: string | null;
  is_vip: boolean;
  created_at: string;
}

interface RunRow {
  id: string;
  linked_intro_booked_id: string | null;
  result: string | null;
  result_canon: string | null;
  buy_date: string | null;
  run_date: string | null;
  commission_amount: number | null;
  intro_owner: string | null;
}

interface ScorecardLite {
  id: string;
  first_timer_id: string | null;
  total_score: number | null;
  level: number | null;
  evaluator_name: string;
}

export interface PersonJourneyCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  identifier: PersonIdentifier;
  /** Optional scope badge for context (e.g. "WIG · Leads"). */
  scopeBadge?: string;
}

const MISMATCH_LABEL: Record<IntroOwnerMismatchStatus, { text: string; tone: string }> = {
  matches: { text: '✓ matches rule', tone: 'bg-success/15 text-success border-success/40' },
  locked_override: { text: 'manually overridden', tone: 'bg-muted text-muted-foreground border-border' },
  unlocked_mismatch: { text: 'backfill candidate', tone: 'bg-warning/15 text-warning border-warning/40' },
  unowned: { text: 'no owner set', tone: 'bg-destructive/10 text-destructive border-destructive/30' },
};

export function PersonJourneyCard({ open, onOpenChange, identifier, scopeBadge }: PersonJourneyCardProps) {
  const isMobile = useIsMobile();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [resolution, setResolution] = useState<PersonResolution | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [scorecards, setScorecards] = useState<ScorecardLite[]>([]);
  const [reloadTick, setReloadTick] = useState(0);
  const [showDeleted, setShowDeleted] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await resolvePerson(identifier);
        if (cancelled) return;
        setResolution(res);

        if (res.bookingIds.length === 0) {
          setBookings([]);
          setRuns([]);
          setScorecards([]);
          return;
        }

        const [bkRes, runRes, scRes] = await Promise.all([
          supabase
            .from('intros_booked')
            .select('id, member_name, class_date, intro_time, coach_name, booked_by, intro_owner, intro_owner_locked, lead_source, phone, phone_e164, email, originating_booking_id, booking_status, booking_status_canon, deleted_at, is_vip, created_at')
            .in('id', res.bookingIds),
          supabase
            .from('intros_run')
            .select('id, linked_intro_booked_id, result, result_canon, buy_date, run_date, commission_amount, intro_owner')
            .in('linked_intro_booked_id', res.bookingIds),
          supabase
            .from('fv_scorecards' as any)
            .select('id, first_timer_id, total_score, level, evaluator_name')
            .in('first_timer_id', res.bookingIds),
        ]);

        if (cancelled) return;
        setBookings(((bkRes.data as any[]) || []).sort(
          (a, b) => (a.class_date || '').localeCompare(b.class_date || ''),
        ));
        setRuns((runRes.data as any[]) || []);
        setScorecards((scRes.data as any[]) || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, identifier, reloadTick]);

  const reload = () => setReloadTick(t => t + 1);

  // Build chain map: rootId → ordered bookings (root first, then 2nd intros)
  const orderedBookings = useMemo(() => {
    const byId = new Map(bookings.map(b => [b.id, b]));
    const roots: BookingRow[] = [];
    const childrenOf: Record<string, BookingRow[]> = {};
    for (const b of bookings) {
      if (!b.originating_booking_id || !byId.has(b.originating_booking_id)) {
        roots.push(b);
      } else {
        (childrenOf[b.originating_booking_id] ||= []).push(b);
      }
    }
    roots.sort((a, b) => (a.class_date || '').localeCompare(b.class_date || ''));
    const flat: { booking: BookingRow; isSecondIntro: boolean; chainIdx: number }[] = [];
    roots.forEach((r, idx) => {
      flat.push({ booking: r, isSecondIntro: false, chainIdx: idx + 1 });
      (childrenOf[r.id] || [])
        .sort((a, b) => (a.class_date || '').localeCompare(b.class_date || ''))
        .forEach(c => flat.push({ booking: c, isSecondIntro: true, chainIdx: idx + 1 }));
    });
    return flat;
  }, [bookings]);

  const runsByBooking = useMemo(() => {
    const m = new Map<string, RunRow[]>();
    for (const r of runs) {
      if (!r.linked_intro_booked_id) continue;
      const arr = m.get(r.linked_intro_booked_id) || [];
      arr.push(r);
      m.set(r.linked_intro_booked_id, arr);
    }
    return m;
  }, [runs]);

  const scorecardByBooking = useMemo(() => {
    const m = new Map<string, ScorecardLite>();
    for (const s of scorecards) {
      if (s.first_timer_id) m.set(s.first_timer_id, s);
    }
    return m;
  }, [scorecards]);

  // Mismatch tallies for the header strip.
  const mismatchSummary = useMemo(() => {
    let unlocked = 0, locked = 0, matches = 0, unowned = 0;
    for (const { booking } of orderedBookings) {
      const originatingOwner = booking.originating_booking_id
        ? (bookings.find(b => b.id === booking.originating_booking_id)?.intro_owner || null)
        : null;
      const { expected } = computeExpectedIntroOwner({
        leadSource: booking.lead_source,
        bookedBy: booking.booked_by,
        runningSa: booking.intro_owner || booking.booked_by || '',
        originatingOwner,
      });
      const status = classifyIntroOwnerStatus({
        actual: booking.intro_owner,
        expected,
        locked: booking.intro_owner_locked,
      });
      if (status === 'matches') matches++;
      else if (status === 'locked_override') locked++;
      else if (status === 'unlocked_mismatch') unlocked++;
      else unowned++;
    }
    return { unlocked, locked, matches, unowned };
  }, [orderedBookings, bookings]);

  const person = resolution?.identity;
  const phoneDisplay = formatPhoneDisplay(person?.phone10 || null);
  const headerName = orderedBookings[0]?.booking.member_name || person?.name || 'Unknown person';

  const Header = (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-base font-semibold truncate">{headerName}</h2>
        {scopeBadge && <Badge variant="outline" className="text-[10px]">{scopeBadge}</Badge>}
        {resolution?.nameOnlyMatch && (
          <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/40 gap-1">
            <AlertTriangle className="w-3 h-3" /> matched by name only — verify same person
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
        {phoneDisplay && (
          <span className="inline-flex items-center gap-1">
            <Phone className="w-3 h-3" /> {phoneDisplay}
          </span>
        )}
        {person?.emailNorm && (
          <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
            <Mail className="w-3 h-3" /> {person.emailNorm}
          </span>
        )}
        <span>·</span>
        <span>{orderedBookings.length} intro{orderedBookings.length === 1 ? '' : 's'}</span>
      </div>
      {orderedBookings.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
          <span className="text-muted-foreground">Attribution:</span>
          {mismatchSummary.matches > 0 && (
            <Badge variant="outline" className="text-[10px] bg-success/15 text-success border-success/40">
              {mismatchSummary.matches} ✓ match
            </Badge>
          )}
          {mismatchSummary.unlocked > 0 && (
            <Badge variant="outline" className="text-[10px] bg-warning/15 text-warning border-warning/40">
              {mismatchSummary.unlocked} backfill candidate{mismatchSummary.unlocked === 1 ? '' : 's'}
            </Badge>
          )}
          {mismatchSummary.locked > 0 && (
            <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
              {mismatchSummary.locked} manually overridden
            </Badge>
          )}
          {mismatchSummary.unowned > 0 && (
            <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">
              {mismatchSummary.unowned} unowned
            </Badge>
          )}
        </div>
      )}
    </div>
  );

  const Body = (
    <div className="overflow-y-auto -mx-6 px-6 space-y-3 flex-1 min-h-0">
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {!loading && orderedBookings.length === 0 && (
        <p className="text-xs text-muted-foreground py-6 text-center">
          No intros found for this person.
        </p>
      )}
      {!loading && orderedBookings.map(({ booking, isSecondIntro, chainIdx }) => (
        <IntroNode
          key={booking.id}
          booking={booking}
          allBookings={bookings}
          runs={runsByBooking.get(booking.id) || []}
          scorecard={scorecardByBooking.get(booking.id) || null}
          isSecondIntro={isSecondIntro}
          chainIdx={chainIdx}
          editor={user?.name || 'unknown'}
          onChanged={reload}
        />
      ))}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[92vh] flex flex-col p-4 pt-3">
          <div className="mx-auto w-10 h-1 rounded-full bg-muted mb-2 shrink-0" aria-hidden />
          <SheetHeader className="text-left shrink-0">
            <SheetTitle className="sr-only">Journey: {headerName}</SheetTitle>
            {Header}
          </SheetHeader>
          {Body}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="sr-only">Journey: {headerName}</DialogTitle>
          {Header}
        </DialogHeader>
        {Body}
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Intro node — one row per booking with inline edits via canonical paths.
// ────────────────────────────────────────────────────────────────────────────

interface IntroNodeProps {
  booking: BookingRow;
  allBookings: BookingRow[];
  runs: RunRow[];
  scorecard: ScorecardLite | null;
  isSecondIntro: boolean;
  chainIdx: number;
  editor: string;
  onChanged: () => void;
}

function IntroNode({ booking, allBookings, runs, scorecard, isSecondIntro, chainIdx, editor, onChanged }: IntroNodeProps) {
  const navigate = useNavigate();
  const { salesAssociates, coaches, allActive } = useActiveStaff();
  const [editField, setEditField] = useState<null | 'booked_by' | 'coach_name' | 'lead_source' | 'class_date' | 'intro_owner'>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<string>('');

  const latestRun = useMemo(() => {
    if (runs.length === 0) return null;
    return [...runs].sort((a, b) => (b.run_date || '').localeCompare(a.run_date || ''))[0];
  }, [runs]);
  const hasSale = useMemo(() => runs.some(r => isCloseRun(r as any)), [runs]);

  const originatingOwner = booking.originating_booking_id
    ? (allBookings.find(b => b.id === booking.originating_booking_id)?.intro_owner || null)
    : null;

  const { expected, reason } = computeExpectedIntroOwner({
    leadSource: booking.lead_source,
    bookedBy: booking.booked_by,
    runningSa: booking.intro_owner || booking.booked_by || '',
    originatingOwner,
  });
  const status = classifyIntroOwnerStatus({
    actual: booking.intro_owner,
    expected,
    locked: booking.intro_owner_locked,
  });
  const mismatchLabel = MISMATCH_LABEL[status];

  const startEdit = (field: typeof editField, currentValue: string | null | undefined) => {
    setEditField(field);
    setDraft(currentValue || '');
  };
  const cancelEdit = () => { setEditField(null); setDraft(''); };

  const commitEdit = async () => {
    if (!editField) return;
    setSaving(true);
    try {
      if (editField === 'intro_owner') {
        const ok = await syncIntroOwnerToBooking(booking.id, draft, editor);
        if (!ok) throw new Error('owner sync failed');
        toast.success('Intro owner updated');
      } else {
        const payload: Parameters<typeof updateBookingFieldsFromPipeline>[0] = {
          bookingId: booking.id,
          editedBy: editor,
          editReason: `Journey card edit: ${editField}`,
        };
        if (editField === 'booked_by') payload.bookedBy = draft;
        if (editField === 'coach_name') payload.coachName = draft;
        if (editField === 'lead_source') payload.leadSource = draft;
        if (editField === 'class_date') payload.classDate = draft;
        await updateBookingFieldsFromPipeline(payload);
        toast.success('Saved');
      }
      notifyDataChanged(
        editField === 'intro_owner'
          ? ['intros_booked', 'intros_run', 'dashboard-metrics', 'lead-measures', 'sa-leads-booked', 'sa-sales']
          : ['intros_booked', 'sa-leads-booked', 'sa-sales'],
        'journey-card-edit',
      );
      cancelEdit();
      onChanged();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const ownerOptions = allActive || [];
  const coachOptions = coaches || [];
  const saOptions = salesAssociates || [];

  const dateLabel = booking.class_date
    ? format(parseLocalDate(booking.class_date) || new Date(booking.class_date), 'EEE MMM d, yyyy')
    : '—';
  const isDeleted = !!booking.deleted_at || booking.booking_status_canon === 'DELETED_SOFT';

  return (
    <div className={cn(
      'rounded-md border p-2.5 bg-card space-y-2',
      isDeleted && 'opacity-60 border-dashed',
      status === 'unlocked_mismatch' && 'border-warning/40',
    )}>
      {/* Header row: chain marker + status badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge variant="outline" className="text-[9px] uppercase tracking-wide">
          Chain {chainIdx}{isSecondIntro ? ' · 2nd' : ' · 1st'}
        </Badge>
        <span className="text-xs font-medium">{dateLabel}</span>
        {booking.intro_time && (
          <span className="text-[10px] text-muted-foreground">@ {booking.intro_time}</span>
        )}
        {booking.is_vip && <Badge className="text-[9px] bg-purple-600 text-white border-transparent">VIP</Badge>}
        {booking.booking_status && (
          <Badge variant="outline" className={cn(
            'text-[10px]',
            booking.booking_status_canon === 'CLOSED_PURCHASED' && 'bg-success text-success-foreground border-transparent',
          )}>
            {booking.booking_status}
          </Badge>
        )}
        {isDeleted && <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">deleted</Badge>}
      </div>

      {/* Edit-in-place grid: lead source, booked_by, coach, class_date */}
      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
        <EditableField
          label="Lead source"
          value={booking.lead_source}
          editing={editField === 'lead_source'}
          saving={saving}
          onStartEdit={() => startEdit('lead_source', booking.lead_source)}
          onCancel={cancelEdit}
          onCommit={commitEdit}
          input={
            <div className="space-y-1">
              <Select value={draft} onValueChange={setDraft}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <FriendRuleNotice leadSource={draft} bookedByName={booking.booked_by} />
            </div>
          }
        />
        <EditableField
          label="Booked by"
          value={booking.booked_by}
          editing={editField === 'booked_by'}
          saving={saving}
          onStartEdit={() => startEdit('booked_by', booking.booked_by)}
          onCancel={cancelEdit}
          onCommit={commitEdit}
          input={
            <Select value={draft} onValueChange={setDraft}>
              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {saOptions.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          }
        />
        <EditableField
          label="Coach"
          value={booking.coach_name}
          editing={editField === 'coach_name'}
          saving={saving}
          onStartEdit={() => startEdit('coach_name', booking.coach_name)}
          onCancel={cancelEdit}
          onCommit={commitEdit}
          input={
            <Select value={draft} onValueChange={setDraft}>
              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {coachOptions.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
              </SelectContent>
            </Select>
          }
        />
        <EditableField
          label="Class date"
          value={dateLabel}
          editing={editField === 'class_date'}
          saving={saving}
          onStartEdit={() => startEdit('class_date', booking.class_date)}
          onCancel={cancelEdit}
          onCommit={commitEdit}
          input={
            <Input
              type="date"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="h-7 text-xs"
            />
          }
        />
      </div>

      {/* Intro owner row + attribution status */}
      <div className="flex items-start justify-between gap-2 rounded border border-border/60 bg-muted/30 p-1.5">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Intro owner</div>
          {editField === 'intro_owner' ? (
            <div className="flex items-center gap-1 mt-1">
              <Select value={draft} onValueChange={setDraft}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {ownerOptions.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-7 px-2" onClick={commitEdit} disabled={saving || !draft}>
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={cancelEdit}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-xs font-medium">{booking.intro_owner || <span className="text-destructive">— none —</span>}</span>
              <Badge variant="outline" className={cn('text-[9px]', mismatchLabel.tone)}>
                {mismatchLabel.text}
              </Badge>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => startEdit('intro_owner', booking.intro_owner)}>
                <Edit className="w-3 h-3" />
              </Button>
            </div>
          )}
          {status === 'unlocked_mismatch' && (
            <div className="text-[10px] text-warning mt-1">
              Rule ({labelForReason(reason)}) says owner should be <strong>{expected}</strong>. Not auto-fixed.
            </div>
          )}
          {status === 'locked_override' && booking.intro_owner && (
            <div className="text-[10px] text-muted-foreground mt-1">
              Override locked. Rule would say <strong>{expected}</strong>.
            </div>
          )}
        </div>
      </div>

      {/* Latest run summary — outcome is editable inline via canonical path */}
      <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
        <span>Latest run:</span>
        <OutcomeEditButton
          bookingId={booking.id}
          label={latestRun?.result || 'Set outcome'}
          tone={hasSale ? 'success' : latestRun?.result ? 'muted' : 'warning'}
          onChanged={onChanged}
        />
        {hasSale && latestRun?.buy_date && <span>· bought {latestRun.buy_date}</span>}
        {(latestRun?.commission_amount || 0) > 0 && <span>· ${latestRun?.commission_amount}</span>}
      </div>

      {/* Scorecard pill */}
      <div className="flex items-center justify-between gap-2">
        {scorecard ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1"
            onClick={() => navigate(`/coach/scorecards/${encodeURIComponent(scorecard.evaluator_name)}`)}
          >
            <Award className="w-3 h-3 text-primary" />
            Scorecard: {scorecard.total_score ?? '—'}{scorecard.level != null && ` · L${scorecard.level}`}
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        ) : (
          <span className="text-[10px] text-muted-foreground">No scorecard</span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[11px] gap-1"
          onClick={() => navigate(`/pipeline?focus=${booking.id}`)}
        >
          Open in Pipeline <ExternalLink className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

function labelForReason(reason: 'inherited_2nd_intro' | 'personal_friend' | 'running_sa'): string {
  switch (reason) {
    case 'inherited_2nd_intro': return '2nd intro inherits from chain root';
    case 'personal_friend': return 'Personal Friend → booked_by';
    case 'running_sa': return 'SA who ran the intro';
  }
}

interface EditableFieldProps {
  label: string;
  value: string | null;
  editing: boolean;
  saving: boolean;
  input: React.ReactNode;
  onStartEdit: () => void;
  onCancel: () => void;
  onCommit: () => void;
}

function EditableField({ label, value, editing, saving, input, onStartEdit, onCancel, onCommit }: EditableFieldProps) {
  return (
    <div className="space-y-0.5">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {editing ? (
        <div className="flex items-center gap-1">
          <div className="flex-1 min-w-0">{input}</div>
          <Button size="sm" className="h-7 px-2" onClick={onCommit} disabled={saving}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onCancel}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onStartEdit}
          className="w-full text-left text-xs px-1.5 py-1 rounded border border-transparent hover:border-border hover:bg-muted/30 flex items-center justify-between gap-1 min-h-[28px]"
        >
          <span className="truncate">{value || <span className="text-muted-foreground italic">none</span>}</span>
          <Edit className="w-3 h-3 text-muted-foreground shrink-0" />
        </button>
      )}
    </div>
  );
}
