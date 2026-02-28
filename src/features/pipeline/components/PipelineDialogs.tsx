/**
 * All Pipeline dialogs in one file for clean separation.
 * Outcome changes flow through pipelineActions → applyIntroOutcomeUpdate.
 * Booking field edits flow through pipelineActions → updateBookingFieldsFromPipeline.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClassTimeSelect, DatePickerField } from '@/components/shared/FormHelpers';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Loader2, Save, Plus, Trash2, DollarSign, UserCheck, Wand2, CalendarPlus,
  CheckCircle, AlertTriangle, User, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ALL_STAFF, SALES_ASSOCIATES, LEAD_SOURCES, MEMBERSHIP_TYPES } from '@/types';
import { getLocalDateString } from '../helpers';
import { capitalizeName } from '@/lib/utils';
import { updateOutcomeFromPipeline, updateBookingFieldsFromPipeline, syncIntroOwnerToBooking, assertNoOutcomeOwnedFields } from '../pipelineActions';
import { normalizeBookingStatus, normalizeIntroResultStrict } from '@/lib/domain/outcomes/types';
import type { ClientJourney, PipelineBooking, PipelineRun } from '../pipelineTypes';

const BOOKING_STATUSES = ['Active', 'No-show', 'Not interested', 'Closed (Purchased)', 'Duplicate', 'Deleted (soft)'];
const VALID_OUTCOMES = [
  'Closed', 'Follow-up needed', 'Booked 2nd intro', 'No-show',
  'Premier + OTBeat', 'Premier w/o OTBeat', 'Elite + OTBeat', 'Elite w/o OTBeat',
  'Basic + OTBeat', 'Basic w/o OTBeat',
];

interface DialogState {
  type: string | null;
  booking?: PipelineBooking | null;
  run?: PipelineRun | null;
  journey?: ClientJourney | null;
}

interface Props {
  dialogState: DialogState;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  journeys: ClientJourney[];
  isOnline: boolean;
  userName: string;
}

export function PipelineDialogs({ dialogState, onClose, onRefresh, journeys, isOnline, userName }: Props) {
  const { type, booking, run, journey } = dialogState;
  const [isSaving, setIsSaving] = useState(false);

  // Edit booking state
  const [editBooking, setEditBooking] = useState<PipelineBooking | null>(null);
  const [editBookingReason, setEditBookingReason] = useState('');

  // Edit run state
  const [editRun, setEditRun] = useState<PipelineRun | null>(null);
  const [editRunReason, setEditRunReason] = useState('');
  const [originalRunResult, setOriginalRunResult] = useState('');

  // Purchase state
  const [purchaseData, setPurchaseData] = useState({ date_closed: getLocalDateString(), membership_type: '', sale_type: 'Intro' as string, intro_owner: '' });

  // Owner state
  const [newIntroOwner, setNewIntroOwner] = useState('');
  const [ownerOverrideReason, setOwnerOverrideReason] = useState('');

  // Delete state
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Create booking state
  const [newBooking, setNewBooking] = useState({ member_name: '', class_date: getLocalDateString(), intro_time: '', coach_name: '', sa_working_shift: '', lead_source: '', fitness_goal: '' });
  const [isSelfBooked, setIsSelfBooked] = useState(false);
  const [pickFromPipeline, setPickFromPipeline] = useState(false);
  const [pipelineSearch, setPipelineSearch] = useState('');

  // Create run state
  const [newRun, setNewRun] = useState({ member_name: '', run_date: getLocalDateString(), class_time: '', ran_by: '', lead_source: '', result: '', notes: '', linked_intro_booked_id: '' });

  // Auto-fix state
  const [isFixing, setIsFixing] = useState(false);
  const [fixResults, setFixResults] = useState<{ fixed: number; errors: number } | null>(null);

  // Initialize state when dialog opens
  const isOpen = type !== null;

  // Shared save wrapper
  const withSave = async (fn: () => Promise<void>) => {
    setIsSaving(true);
    try { await fn(); await onRefresh(); } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Action failed');
    } finally { setIsSaving(false); }
  };

  // ── EDIT BOOKING ──
  if (type === 'edit_booking' && booking) {
    if (!editBooking || editBooking.id !== booking.id) {
      setTimeout(() => { setEditBooking({ ...booking }); setEditBookingReason(''); }, 0);
    }
    return (
      <Dialog open onOpenChange={() => { setEditBooking(null); onClose(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Booking</DialogTitle>
            <DialogDescription>Update booking details for {booking.member_name}</DialogDescription>
          </DialogHeader>
          {editBooking && (
            <div className="space-y-3">
              <div><Label className="text-xs">Member Name</Label><Input value={editBooking.member_name} onChange={e => setEditBooking({ ...editBooking, member_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Date</Label><DatePickerField value={editBooking.class_date} onChange={v => setEditBooking({ ...editBooking, class_date: v })} /></div>
                <div><Label className="text-xs">Time</Label><ClassTimeSelect value={editBooking.intro_time || ''} onValueChange={v => setEditBooking({ ...editBooking, intro_time: v })} /></div>
              </div>
              <div><Label className="text-xs">Booked By</Label>
                <Select value={editBooking.booked_by || editBooking.sa_working_shift || ''} onValueChange={v => setEditBooking({ ...editBooking, booked_by: v, sa_working_shift: v })}>
                  <SelectTrigger><SelectValue placeholder="Select SA..." /></SelectTrigger>
                  <SelectContent><SelectItem value="Self-booked">Self-booked</SelectItem>{SALES_ASSOCIATES.map(sa => <SelectItem key={sa} value={sa}>{sa}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Lead Source</Label>
                <Select value={editBooking.lead_source || ''} onValueChange={v => setEditBooking({ ...editBooking, lead_source: v })}>
                  <SelectTrigger><SelectValue placeholder="Select source..." /></SelectTrigger>
                  <SelectContent>{LEAD_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Coach</Label>
                <Select value={editBooking.coach_name || ''} onValueChange={v => setEditBooking({ ...editBooking, coach_name: v === '__TBD__' ? 'TBD' : v })}>
                  <SelectTrigger><SelectValue placeholder="Select coach..." /></SelectTrigger>
                  <SelectContent><SelectItem value="__TBD__">— TBD/Unknown —</SelectItem>{ALL_STAFF.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Intro Owner</Label>
                <Select value={editBooking.intro_owner || '__NONE__'} onValueChange={v => setEditBooking({ ...editBooking, intro_owner: v === '__NONE__' ? null : v, intro_owner_locked: v !== '__NONE__' } as any)}>
                  <SelectTrigger><SelectValue placeholder="Select owner..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__NONE__">— Unassigned —</SelectItem>
                    {SALES_ASSOCIATES.map(sa => <SelectItem key={sa} value={sa}>{sa}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Status</Label>
                <Select value={editBooking.booking_status || 'Active'} onValueChange={v => setEditBooking({ ...editBooking, booking_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BOOKING_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Fitness Goal</Label><Textarea value={editBooking.fitness_goal || ''} onChange={e => setEditBooking({ ...editBooking, fitness_goal: e.target.value })} className="min-h-[60px]" /></div>
              <div><Label className="text-xs">Edit Reason</Label><Input value={editBookingReason} onChange={e => setEditBookingReason(e.target.value)} placeholder="Why are you making this change?" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditBooking(null); onClose(); }}>Cancel</Button>
            <Button disabled={isSaving} onClick={() => withSave(async () => {
              if (!editBooking) return;
              await updateBookingFieldsFromPipeline({
                bookingId: editBooking.id,
                memberName: editBooking.member_name,
                classDate: editBooking.class_date,
                introTime: editBooking.intro_time,
                coachName: editBooking.coach_name,
                leadSource: editBooking.lead_source,
                bookedBy: editBooking.booked_by || editBooking.sa_working_shift,
                saWorkingShift: editBooking.sa_working_shift,
                bookingStatus: editBooking.booking_status || 'Active',
                fitnessGoal: editBooking.fitness_goal,
                editedBy: userName,
                editReason: editBookingReason || 'Pipeline edit',
              });
              // Separately update intro_owner since it's not in updateBookingFieldsFromPipeline signature
              const anyBooking = editBooking as any;
              await supabase.from('intros_booked').update({
                intro_owner: anyBooking.intro_owner || null,
                intro_owner_locked: !!anyBooking.intro_owner,
              }).eq('id', editBooking.id);
              toast.success('Booking updated');
              setEditBooking(null);
            })}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── EDIT RUN (outcome changes via canonical function) ──
  if (type === 'edit_run' && run) {
    if (!editRun || editRun.id !== run.id) {
      setTimeout(() => { setEditRun({ ...run }); setOriginalRunResult(run.result); setEditRunReason(''); }, 0);
    }
    return (
      <Dialog open onOpenChange={() => { setEditRun(null); onClose(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Intro Run</DialogTitle>
            <DialogDescription>Update run for {run.member_name}</DialogDescription>
          </DialogHeader>
          {editRun && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Run Date</Label><DatePickerField value={editRun.run_date || ''} onChange={v => setEditRun({ ...editRun, run_date: v })} /></div>
                <div><Label className="text-xs">Time</Label><ClassTimeSelect value={editRun.class_time} onValueChange={v => setEditRun({ ...editRun, class_time: v })} /></div>
              </div>
              <div><Label className="text-xs">Ran By</Label>
                <Select value={editRun.ran_by || ''} onValueChange={v => setEditRun({ ...editRun, ran_by: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SALES_ASSOCIATES.map(sa => <SelectItem key={sa} value={sa}>{sa}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Lead Source</Label>
                <Select value={editRun.lead_source || ''} onValueChange={v => setEditRun({ ...editRun, lead_source: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LEAD_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Coach</Label>
                <Select value={editRun.coach_name || ''} onValueChange={v => setEditRun({ ...editRun, coach_name: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ALL_STAFF.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Intro Owner</Label>
                <Select value={editRun.intro_owner || '__NONE__'} onValueChange={v => setEditRun({ ...editRun, intro_owner: v === '__NONE__' ? null : v } as any)}>
                  <SelectTrigger><SelectValue placeholder="Select owner..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__NONE__">— Unassigned —</SelectItem>
                    {SALES_ASSOCIATES.map(sa => <SelectItem key={sa} value={sa}>{sa}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Result/Outcome</Label>
                <Select value={editRun.result} onValueChange={v => setEditRun({ ...editRun, result: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VALID_OUTCOMES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="border-t pt-3"><Label className="text-xs font-semibold mb-2 block">Sale Info</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Buy Date</Label><DatePickerField value={editRun.buy_date || ''} onChange={v => setEditRun({ ...editRun, buy_date: v })} /></div>
                  <div><Label className="text-xs">Commission $</Label><Input type="number" step="0.01" value={editRun.commission_amount || ''} onChange={e => setEditRun({ ...editRun, commission_amount: parseFloat(e.target.value) || 0 })} /></div>
                </div>
              </div>
              <div><Label className="text-xs">Notes</Label><Textarea value={editRun.notes || ''} onChange={e => setEditRun({ ...editRun, notes: e.target.value })} className="min-h-[60px]" /></div>
              <div><Label className="text-xs">Edit Reason</Label><Input value={editRunReason} onChange={e => setEditRunReason(e.target.value)} placeholder="Why are you making this change?" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditRun(null); onClose(); }}>Cancel</Button>
            <Button disabled={isSaving} onClick={() => withSave(async () => {
              if (!editRun) return;
              const effectiveIntroOwner = editRun.intro_owner || editRun.ran_by || null;

              const resultChanged = editRun.result !== originalRunResult;

              // Non-outcome fields: always safe to update directly
              const nonOutcomeUpdate: Record<string, unknown> = {
                run_date: editRun.run_date,
                class_time: editRun.class_time,
                lead_source: editRun.lead_source,
                intro_owner: effectiveIntroOwner,
                ran_by: editRun.ran_by,
                goal_quality: editRun.goal_quality,
                pricing_engagement: editRun.pricing_engagement,
                notes: editRun.notes,
                coach_name: editRun.coach_name,
                goal_why_captured: editRun.goal_why_captured,
                relationship_experience: editRun.relationship_experience,
                made_a_friend: editRun.made_a_friend,
                last_edited_at: new Date().toISOString(),
                last_edited_by: userName,
                edit_reason: editRunReason || 'Pipeline edit',
              };

              // If result is NOT changing, allow direct buy_date/commission edits
              if (!resultChanged) {
                nonOutcomeUpdate.buy_date = editRun.buy_date;
                nonOutcomeUpdate.commission_amount = editRun.commission_amount;
              } else {
                // Guardrail: ensure no outcome-owned fields leak into the direct update
                assertNoOutcomeOwnedFields(nonOutcomeUpdate, 'PipelineDialogs:EditRun');
              }

              await supabase.from('intros_run').update(nonOutcomeUpdate).eq('id', editRun.id);

              // Sync intro_owner/coach to linked booking
              if (editRun.linked_intro_booked_id && editRun.result !== 'No-show') {
                const updateData: Record<string, unknown> = {
                  last_edited_at: new Date().toISOString(),
                  last_edited_by: `${userName} (Auto-Sync)`,
                  edit_reason: 'Synced from linked run',
                };
                if (effectiveIntroOwner) { updateData.intro_owner = effectiveIntroOwner; updateData.intro_owner_locked = true; }
                if (editRun.coach_name) { updateData.coach_name = editRun.coach_name; }
                await supabase.from('intros_booked').update(updateData).eq('id', editRun.linked_intro_booked_id);
              }

              // If result changed → canonical outcome update owns result, result_canon, buy_date, commission, booking_status
              if (resultChanged && editRun.linked_intro_booked_id) {
                await updateOutcomeFromPipeline({
                  bookingId: editRun.linked_intro_booked_id,
                  runId: editRun.id,
                  memberName: editRun.member_name,
                  classDate: editRun.run_date || '',
                  newResultDisplay: editRun.result,
                  previousResult: originalRunResult,
                  commissionAmount: editRun.commission_amount || 0,
                  editedBy: userName,
                  leadSource: editRun.lead_source || undefined,
                  editReason: editRunReason || 'Pipeline edit',
                });
              }

              toast.success('Run updated');
              setEditRun(null);
            })}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── PURCHASE ──
  if (type === 'purchase' && booking) {
    if (purchaseData.intro_owner === '' && booking.intro_owner) {
      setTimeout(() => setPurchaseData(p => ({ ...p, intro_owner: booking.intro_owner || '' })), 0);
    }
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark as Purchased</DialogTitle><DialogDescription>Record a sale for {booking.member_name}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Date Closed</Label><DatePickerField value={purchaseData.date_closed} onChange={v => setPurchaseData({ ...purchaseData, date_closed: v })} /></div>
            <div><Label className="text-xs">Membership Type *</Label>
              <Select value={purchaseData.membership_type} onValueChange={v => setPurchaseData({ ...purchaseData, membership_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select membership..." /></SelectTrigger>
                <SelectContent>{MEMBERSHIP_TYPES.map(m => <SelectItem key={m.label} value={m.label}>{m.label} (${m.commission} comm)</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Sale Type</Label>
              <Select value={purchaseData.sale_type} onValueChange={v => setPurchaseData({ ...purchaseData, sale_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Intro">Intro</SelectItem><SelectItem value="Outside Intro">Outside Intro</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Intro Owner *</Label>
              <Select value={purchaseData.intro_owner} onValueChange={v => setPurchaseData({ ...purchaseData, intro_owner: v })}>
                <SelectTrigger><SelectValue placeholder="Select owner..." /></SelectTrigger>
                <SelectContent>{SALES_ASSOCIATES.map(sa => <SelectItem key={sa} value={sa}>{sa}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={isSaving} onClick={() => withSave(async () => {
              if (!purchaseData.membership_type) { toast.error('Membership type is required'); return; }
              if (purchaseData.sale_type === 'Intro' && !purchaseData.intro_owner) { toast.error('Intro owner is required'); return; }
              const mc = MEMBERSHIP_TYPES.find(m => m.label === purchaseData.membership_type);
              const commission = mc?.commission || 0;
              // Only record into sales_outside_intro for "Outside Intro" sales
              if (purchaseData.sale_type === 'Outside Intro') {
                await supabase.from('sales_outside_intro').insert({
                  sale_id: `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  sale_type: 'outside_intro',
                  member_name: booking.member_name,
                  lead_source: booking.lead_source,
                  membership_type: purchaseData.membership_type,
                  commission_amount: commission,
                  intro_owner: purchaseData.intro_owner || null,
                  date_closed: purchaseData.date_closed,
                });
              }
              // Canonical outcome update (runs for BOTH sale types)
              await updateOutcomeFromPipeline({
                bookingId: booking.id,
                memberName: booking.member_name,
                classDate: booking.class_date,
                newResultDisplay: purchaseData.membership_type,
                commissionAmount: commission,
                editedBy: userName,
                leadSource: booking.lead_source,
                editReason: 'Marked as purchased via Pipeline',
              });
              toast.success('Sale recorded and booking closed');
              setPurchaseData({ date_closed: getLocalDateString(), membership_type: '', sale_type: 'Intro', intro_owner: '' });
            })}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <DollarSign className="w-4 h-4 mr-1" />} Record Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── SET OWNER ──
  if (type === 'set_owner' && booking) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set Intro Owner</DialogTitle>
            <DialogDescription>{booking.intro_owner_locked ? `Override (currently ${booking.intro_owner})` : 'Assign an intro owner'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={newIntroOwner} onValueChange={setNewIntroOwner}>
              <SelectTrigger><SelectValue placeholder="Select owner..." /></SelectTrigger>
              <SelectContent><SelectItem value="__CLEAR__">— Clear (unlock) —</SelectItem>{SALES_ASSOCIATES.map(sa => <SelectItem key={sa} value={sa}>{sa}</SelectItem>)}</SelectContent>
            </Select>
            {(booking.intro_owner_locked || newIntroOwner === '__CLEAR__') && (
              <div><Label className="text-xs">Reason</Label><Textarea value={ownerOverrideReason} onChange={e => setOwnerOverrideReason(e.target.value)} placeholder="Why?" className="min-h-[60px]" /></div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={isSaving} onClick={() => withSave(async () => {
              const isClearing = !newIntroOwner || newIntroOwner === '__CLEAR__';
              if (booking.intro_owner_locked && !isClearing && !ownerOverrideReason) { toast.error('Override reason required'); return; }
              await supabase.from('intros_booked').update({
                intro_owner: isClearing ? null : newIntroOwner,
                intro_owner_locked: !isClearing,
                last_edited_at: new Date().toISOString(),
                last_edited_by: userName,
                edit_reason: ownerOverrideReason || (isClearing ? 'Cleared intro owner' : 'Set intro owner'),
              }).eq('id', booking.id);
              toast.success(isClearing ? 'Intro owner cleared' : `Intro owner set to ${newIntroOwner}`);
              setNewIntroOwner(''); setOwnerOverrideReason('');
            })}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <UserCheck className="w-4 h-4 mr-1" />}
              {newIntroOwner === '__CLEAR__' ? 'Clear & Unlock' : 'Set Owner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── NOT INTERESTED ──
  if (type === 'not_interested' && booking) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark Not Interested</DialogTitle>
            <DialogDescription>Mark {booking.member_name} as not interested?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={isSaving} onClick={() => withSave(async () => {
              await supabase.from('intros_booked').update({
                booking_status: 'Not interested',
                booking_status_canon: 'NOT_INTERESTED',
                closed_at: new Date().toISOString(),
                closed_by: userName,
                last_edited_at: new Date().toISOString(),
                last_edited_by: userName,
                edit_reason: 'Marked as not interested',
              }).eq('id', booking.id);
              toast.success('Marked as not interested');
            })}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── ARCHIVE ──
  if (type === 'archive' && booking) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader><DialogTitle>Archive Booking</DialogTitle><DialogDescription>Archive {booking.member_name}?</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={isSaving} onClick={() => withSave(async () => {
              await supabase.from('intros_booked').update({
                booking_status: 'Deleted (soft)',
                booking_status_canon: 'DELETED_SOFT',
                last_edited_at: new Date().toISOString(),
                last_edited_by: userName,
                edit_reason: 'Archived via Pipeline',
              }).eq('id', booking.id);
              toast.success('Booking archived');
            })}>Archive</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── HARD DELETE BOOKING ──
  if (type === 'hard_delete_booking' && booking) {
    return (
      <Dialog open onOpenChange={() => { setDeleteConfirmText(''); onClose(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-destructive">Permanently Delete Booking</DialogTitle>
            <DialogDescription>This will permanently delete the booking for {booking.member_name}. Type DELETE to confirm.</DialogDescription>
          </DialogHeader>
          <Input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder="Type DELETE to confirm" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteConfirmText(''); onClose(); }}>Cancel</Button>
            <Button variant="destructive" disabled={isSaving || deleteConfirmText !== 'DELETE'} onClick={() => withSave(async () => {
              await supabase.from('intros_booked').delete().eq('id', booking.id);
              toast.success('Booking permanently deleted');
              setDeleteConfirmText('');
            })}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── HARD DELETE RUN ──
  if (type === 'hard_delete_run' && run) {
    return (
      <Dialog open onOpenChange={() => { setDeleteConfirmText(''); onClose(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-destructive">Permanently Delete Intro Run</DialogTitle>
            <DialogDescription>Delete run for {run.member_name} ({run.run_date} — {run.result}). Type DELETE to confirm.</DialogDescription>
          </DialogHeader>
          <Input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder="Type DELETE to confirm" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteConfirmText(''); onClose(); }}>Cancel</Button>
            <Button variant="destructive" disabled={isSaving || deleteConfirmText !== 'DELETE'} onClick={() => withSave(async () => {
              await supabase.from('intros_run').delete().eq('id', run.id);
              toast.success('Run permanently deleted');
              setDeleteConfirmText('');
            })}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── LINK RUN ──
  if (type === 'link_run' && run && journey) {
    const available = journey.bookings.filter(b =>
      b.member_name.toLowerCase() === run.member_name.toLowerCase() &&
      (b.booking_status_canon === 'ACTIVE' || !b.booking_status || b.booking_status === 'Active' || b.booking_status === 'No-show')
    );
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader><DialogTitle>Link Run to Booking</DialogTitle><DialogDescription>Select a booking to link with this run for {run.member_name}</DialogDescription></DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {available.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No available bookings</p>
            ) : available.map(b => (
              <div key={b.id} className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50" onClick={() => withSave(async () => {
                await supabase.from('intros_run').update({ linked_intro_booked_id: b.id, last_edited_at: new Date().toISOString(), last_edited_by: userName, edit_reason: 'Linked to booking' }).eq('id', run.id);
                if (run.result !== 'No-show' && run.ran_by) await syncIntroOwnerToBooking(b.id, run.ran_by, userName);
                toast.success('Run linked to booking');
              })}>
                <div className="font-medium">{b.class_date} {b.intro_time && `@ ${b.intro_time}`}</div>
                <div className="text-xs text-muted-foreground">Booked by: {capitalizeName(b.booked_by || b.sa_working_shift)} | {b.lead_source}</div>
              </div>
            ))}
          </div>
          <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── UNLINK RUN ──
  if (type === 'unlink_run' && run) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader><DialogTitle>Unlink Run</DialogTitle><DialogDescription>Unlink {run.member_name} run from its booking?</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={isSaving} onClick={() => withSave(async () => {
              await supabase.from('intros_run').update({ linked_intro_booked_id: null, last_edited_at: new Date().toISOString(), last_edited_by: userName, edit_reason: 'Unlinked from booking' }).eq('id', run.id);
              toast.success('Run unlinked');
            })}>Unlink</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── CREATE BOOKING ──
  if (type === 'create_booking' || type === 'create_matching_booking' || type === 'book_2nd_intro') {
    const fromRun = type === 'create_matching_booking' ? run : null;
    const secondIntroOriginatingId = type === 'book_2nd_intro' && journey
      ? (journey.bookings.find(b => !b.originating_booking_id) || journey.bookings[0])?.id || null
      : null;

    // Initialize form from context
    if (type === 'create_matching_booking' && fromRun && newBooking.member_name !== fromRun.member_name) {
      setTimeout(() => setNewBooking({
        member_name: fromRun.member_name,
        class_date: fromRun.run_date || getLocalDateString(),
        intro_time: fromRun.class_time || '',
        coach_name: '', sa_working_shift: '',
        lead_source: fromRun.lead_source || '', fitness_goal: '',
      }), 0);
    }
    if (type === 'book_2nd_intro' && journey && newBooking.member_name !== journey.memberName) {
      const first = journey.bookings.find(b => !b.originating_booking_id) || journey.bookings[0];
      if (first) {
        setTimeout(() => setNewBooking({
          member_name: journey.memberName,
          class_date: getLocalDateString(), intro_time: '',
          coach_name: first.coach_name || '', sa_working_shift: '',
          lead_source: first.lead_source || '', fitness_goal: first.fitness_goal || '',
        }), 0);
      }
    }

    return (
      <Dialog open onOpenChange={() => { setNewBooking({ member_name: '', class_date: getLocalDateString(), intro_time: '', coach_name: '', sa_working_shift: '', lead_source: '', fitness_goal: '' }); onClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{secondIntroOriginatingId ? 'Book 2nd Intro' : fromRun ? 'Create Matching Booking' : 'Create New Booking'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {!fromRun && !secondIntroOriginatingId && (
              <div className="flex items-center gap-2 pb-1">
                <Switch checked={pickFromPipeline} onCheckedChange={v => { setPickFromPipeline(v); setPipelineSearch(''); if (!v) setNewBooking(p => ({ ...p, member_name: '', lead_source: '', coach_name: '', fitness_goal: '' })); }} />
                <Label className="text-sm">Pick from existing pipeline</Label>
              </div>
            )}
            {pickFromPipeline && !fromRun && !secondIntroOriginatingId ? (
              <div className="space-y-2">
                <Input value={pipelineSearch} onChange={e => setPipelineSearch(e.target.value)} placeholder="Search name..." autoFocus />
                {pipelineSearch.length >= 2 && (
                  <ScrollArea className="max-h-48 border rounded-md">
                    {journeys.filter(j => j.memberName.toLowerCase().includes(pipelineSearch.toLowerCase())).slice(0, 15).map(j => (
                      <button key={j.memberKey} type="button" className="w-full text-left px-3 py-2 hover:bg-muted/80 border-b last:border-b-0"
                        onClick={() => { setNewBooking(p => ({ ...p, member_name: j.memberName, lead_source: j.bookings[0]?.lead_source || '', coach_name: j.bookings[0]?.coach_name || '', fitness_goal: j.bookings[0]?.fitness_goal || '' })); setPipelineSearch(''); setPickFromPipeline(false); }}>
                        <span className="font-medium text-sm">{j.memberName}</span>
                      </button>
                    ))}
                  </ScrollArea>
                )}
                {newBooking.member_name && (
                  <div className="p-2 bg-primary/10 rounded-lg text-xs flex items-center gap-2 border border-primary/20">
                    <User className="w-3.5 h-3.5 text-primary" />
                    <span className="font-medium">Selected: {newBooking.member_name}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto" onClick={() => { setNewBooking(p => ({ ...p, member_name: '' })); setPickFromPipeline(true); }}><X className="w-3 h-3" /></Button>
                  </div>
                )}
              </div>
            ) : (
              <div><Label className="text-xs">Member Name *</Label><Input value={newBooking.member_name} onChange={e => setNewBooking({ ...newBooking, member_name: e.target.value })} disabled={!!fromRun || !!secondIntroOriginatingId} /></div>
            )}
            <div className="flex items-center gap-2"><Switch checked={isSelfBooked} onCheckedChange={setIsSelfBooked} /><Label className="text-sm">Self-booked</Label></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Date *</Label><DatePickerField value={newBooking.class_date} onChange={v => setNewBooking({ ...newBooking, class_date: v })} /></div>
              <div><Label className="text-xs">Time</Label><ClassTimeSelect value={newBooking.intro_time} onValueChange={v => setNewBooking({ ...newBooking, intro_time: v })} /></div>
            </div>
            {!isSelfBooked && (
              <>
                <div><Label className="text-xs">Booked By *</Label>
                  <Select value={newBooking.sa_working_shift} onValueChange={v => setNewBooking({ ...newBooking, sa_working_shift: v })}>
                    <SelectTrigger><SelectValue placeholder="Select SA..." /></SelectTrigger>
                    <SelectContent>{SALES_ASSOCIATES.map(sa => <SelectItem key={sa} value={sa}>{sa}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Lead Source</Label>
                  <Select value={newBooking.lead_source} onValueChange={v => setNewBooking({ ...newBooking, lead_source: v })}>
                    <SelectTrigger><SelectValue placeholder="Select source..." /></SelectTrigger>
                    <SelectContent>{LEAD_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div><Label className="text-xs">Coach</Label>
              <Select value={newBooking.coach_name} onValueChange={v => setNewBooking({ ...newBooking, coach_name: v })}>
                <SelectTrigger><SelectValue placeholder="Select coach..." /></SelectTrigger>
                <SelectContent>{ALL_STAFF.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={isSaving} onClick={() => withSave(async () => {
              if (!newBooking.member_name) { toast.error('Name required'); return; }
              if (!isSelfBooked && !newBooking.sa_working_shift) { toast.error('Booked By required'); return; }
              const bookedBy = isSelfBooked ? 'Self-booked' : newBooking.sa_working_shift;
              const leadSource = isSelfBooked ? 'Online Intro Offer (self-booked)' : (newBooking.lead_source || 'Source Not Found');
              const introOwner = fromRun?.intro_owner || fromRun?.ran_by || null;
              const { data: inserted, error } = await supabase.from('intros_booked').insert({
                booking_id: `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                member_name: newBooking.member_name,
                class_date: newBooking.class_date,
                intro_time: newBooking.intro_time || null,
                coach_name: newBooking.coach_name || 'TBD',
                sa_working_shift: bookedBy,
                booked_by: bookedBy,
                lead_source: leadSource,
                fitness_goal: newBooking.fitness_goal || null,
                booking_status: 'Active',
                booking_status_canon: 'ACTIVE',
                intro_owner: introOwner,
                intro_owner_locked: !!introOwner,
                originating_booking_id: secondIntroOriginatingId || null,
              }).select().single();
              if (error) throw error;
              if (fromRun && inserted) {
                await supabase.from('intros_run').update({ linked_intro_booked_id: inserted.id, last_edited_at: new Date().toISOString(), last_edited_by: userName, edit_reason: 'Linked to newly created booking' }).eq('id', fromRun.id);
              }
              // Auto-create questionnaire record
              if (inserted?.id && !secondIntroOriginatingId) {
                import('@/lib/introHelpers').then(({ autoCreateQuestionnaire }) => {
                  autoCreateQuestionnaire({ bookingId: inserted.id, memberName: newBooking.member_name, classDate: newBooking.class_date }).catch(() => {});
                });
              }
              toast.success(secondIntroOriginatingId ? '2nd intro booked' : 'Booking created');
              setNewBooking({ member_name: '', class_date: getLocalDateString(), intro_time: '', coach_name: '', sa_working_shift: '', lead_source: '', fitness_goal: '' });
            })}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              {secondIntroOriginatingId ? 'Book 2nd Intro' : fromRun ? 'Create & Link' : 'Create Booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── LOG 2ND INTRO RUN ──
  // Step 1: we auto-create the 2nd booking on mount (via isSaving guard), then show the run form inline.
  if (type === 'log_2nd_intro' && journey) {
    const first = journey.bookings.find(b => !b.originating_booking_id) || journey.bookings[0];

    // If we have a linked_intro_booked_id in newRun, we already created the booking — show run form
    const bookingCreated = !!newRun.linked_intro_booked_id && newRun.member_name === journey.memberName;

    return (
      <Dialog open onOpenChange={() => {
        setNewRun({ member_name: '', run_date: getLocalDateString(), class_time: '', ran_by: '', lead_source: '', result: '', notes: '', linked_intro_booked_id: '' });
        onClose();
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log 2nd Intro Run</DialogTitle>
            <DialogDescription>
              {bookingCreated
                ? `2nd intro booking created. Now log the run for ${journey.memberName}.`
                : `Creates a linked 2nd intro booking then lets you log the run for ${journey.memberName}.`}
            </DialogDescription>
          </DialogHeader>

          {!bookingCreated ? (
            // Step 1: confirm booking creation
            <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg space-y-1">
              <p><span className="font-medium">Member:</span> {journey.memberName}</p>
              {first && <p><span className="font-medium">Lead source:</span> {first.lead_source}</p>}
              <p className="text-xs mt-1">A new intros_booked record will be created with <code>originating_booking_id</code> set to the original booking.</p>
            </div>
          ) : (
            // Step 2: run form (inline — no dialog switch needed)
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Run Date *</Label><DatePickerField value={newRun.run_date} onChange={v => setNewRun({ ...newRun, run_date: v })} /></div>
                <div><Label className="text-xs">Time *</Label><ClassTimeSelect value={newRun.class_time} onValueChange={v => setNewRun({ ...newRun, class_time: v })} /></div>
              </div>
              <div><Label className="text-xs">Ran By *</Label>
                <Select value={newRun.ran_by} onValueChange={v => setNewRun({ ...newRun, ran_by: v })}>
                  <SelectTrigger><SelectValue placeholder="Select SA..." /></SelectTrigger>
                  <SelectContent>{SALES_ASSOCIATES.map(sa => <SelectItem key={sa} value={sa}>{sa}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Lead Source</Label>
                <Select value={newRun.lead_source} onValueChange={v => setNewRun({ ...newRun, lead_source: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LEAD_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Result/Outcome *</Label>
                <Select value={newRun.result} onValueChange={v => setNewRun({ ...newRun, result: v })}>
                  <SelectTrigger><SelectValue placeholder="Select outcome..." /></SelectTrigger>
                  <SelectContent>{VALID_OUTCOMES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Notes</Label><Textarea value={newRun.notes} onChange={e => setNewRun({ ...newRun, notes: e.target.value })} placeholder="Notes..." className="min-h-[60px]" /></div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setNewRun({ member_name: '', run_date: getLocalDateString(), class_time: '', ran_by: '', lead_source: '', result: '', notes: '', linked_intro_booked_id: '' });
              onClose();
            }}>Cancel</Button>

            {!bookingCreated ? (
              // Step 1 button: create the 2nd booking
              <Button disabled={isSaving} onClick={async () => {
                if (!first) { toast.error('No original booking found'); return; }
                setIsSaving(true);
                try {
                  const { data: inserted, error } = await supabase.from('intros_booked').insert({
                    booking_id: `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    member_name: journey.memberName,
                    class_date: getLocalDateString(),
                    coach_name: first.coach_name || 'TBD',
                    sa_working_shift: first.sa_working_shift,
                    booked_by: first.booked_by || first.sa_working_shift,
                    lead_source: first.lead_source,
                    fitness_goal: first.fitness_goal || null,
                    booking_status: 'Active',
                    booking_status_canon: 'ACTIVE',
                    originating_booking_id: first.id,
                    rebooked_from_booking_id: first.id,
                    rebook_reason: 'second_intro',
                    email: first.email || null,
                    phone: first.phone || null,
                  }).select().single();
                  if (error) throw error;
                  // Pre-fill run form with the new booking id, then stay in dialog
                  setNewRun({
                    member_name: journey.memberName,
                    run_date: getLocalDateString(),
                    class_time: first.intro_time || '',
                    ran_by: '',
                    lead_source: first.lead_source || '',
                    result: '',
                    notes: '',
                    linked_intro_booked_id: inserted.id,
                  });
                  toast.success('2nd intro booking created — now log the run below');
                } catch (e: any) {
                  toast.error(e?.message || 'Failed to create 2nd intro booking');
                } finally {
                  setIsSaving(false);
                }
              }}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CalendarPlus className="w-4 h-4 mr-1" />}
                Create 2nd Booking & Continue
              </Button>
            ) : (
              // Step 2 button: log the run
              <Button disabled={isSaving} onClick={() => withSave(async () => {
                if (!newRun.ran_by) { toast.error('Ran By required'); return; }
                if (!newRun.result) { toast.error('Result required'); return; }
                if (!newRun.class_time) { toast.error('Time required'); return; }
                await supabase.from('intros_run').insert({
                  run_id: `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  member_name: newRun.member_name,
                  run_date: newRun.run_date,
                  class_time: newRun.class_time,
                  ran_by: newRun.ran_by,
                  intro_owner: newRun.ran_by,
                  lead_source: newRun.lead_source || 'Source Not Found',
                  result: newRun.result,
                  result_canon: normalizeIntroResultStrict(newRun.result, 'PipelineDialogs:Log2ndIntroRun'),
                  notes: newRun.notes || null,
                  linked_intro_booked_id: newRun.linked_intro_booked_id,
                });
                if (newRun.result !== 'No-show') {
                  await syncIntroOwnerToBooking(newRun.linked_intro_booked_id, newRun.ran_by, userName);
                }
                toast.success('2nd intro run logged');
                setNewRun({ member_name: '', run_date: getLocalDateString(), class_time: '', ran_by: '', lead_source: '', result: '', notes: '', linked_intro_booked_id: '' });
              })}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                Log Run
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── CREATE RUN ──
  if (type === 'create_run' && journey) {
    if (newRun.member_name !== journey.memberName) {
      const latestBooking = journey.bookings.find(b => b.booking_status_canon === 'ACTIVE' || !b.booking_status || b.booking_status === 'Active');
      setTimeout(() => setNewRun({
        member_name: journey.memberName,
        run_date: getLocalDateString(),
        class_time: latestBooking?.intro_time || '',
        ran_by: '', lead_source: latestBooking?.lead_source || '',
        result: '', notes: '',
        linked_intro_booked_id: latestBooking?.id || '',
      }), 0);
    }
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Intro Run</DialogTitle><DialogDescription>Log intro run for {journey.memberName}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Run Date *</Label><DatePickerField value={newRun.run_date} onChange={v => setNewRun({ ...newRun, run_date: v })} /></div>
              <div><Label className="text-xs">Time *</Label><ClassTimeSelect value={newRun.class_time} onValueChange={v => setNewRun({ ...newRun, class_time: v })} /></div>
            </div>
            <div><Label className="text-xs">Ran By *</Label>
              <Select value={newRun.ran_by} onValueChange={v => setNewRun({ ...newRun, ran_by: v })}>
                <SelectTrigger><SelectValue placeholder="Select SA..." /></SelectTrigger>
                <SelectContent>{SALES_ASSOCIATES.map(sa => <SelectItem key={sa} value={sa}>{sa}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Lead Source</Label>
              <Select value={newRun.lead_source} onValueChange={v => setNewRun({ ...newRun, lead_source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEAD_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Result/Outcome *</Label>
              <Select value={newRun.result} onValueChange={v => setNewRun({ ...newRun, result: v })}>
                <SelectTrigger><SelectValue placeholder="Select outcome..." /></SelectTrigger>
                <SelectContent>{VALID_OUTCOMES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {journey.bookings.length > 0 && (
              <div><Label className="text-xs">Link to Booking</Label>
                <Select value={newRun.linked_intro_booked_id} onValueChange={v => setNewRun({ ...newRun, linked_intro_booked_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select booking..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__NONE__">— No link —</SelectItem>
                    {journey.bookings.filter(b => b.booking_status_canon === 'ACTIVE' || !b.booking_status || b.booking_status === 'Active')
                      .map(b => <SelectItem key={b.id} value={b.id}>{b.class_date} {b.intro_time ? `@ ${b.intro_time}` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label className="text-xs">Notes</Label><Textarea value={newRun.notes} onChange={e => setNewRun({ ...newRun, notes: e.target.value })} placeholder="Notes..." className="min-h-[60px]" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={isSaving} onClick={() => withSave(async () => {
              if (!newRun.ran_by) { toast.error('Ran By required'); return; }
              if (!newRun.result) { toast.error('Result required'); return; }
              if (!newRun.class_time) { toast.error('Time required'); return; }
              const linkedId = newRun.linked_intro_booked_id && newRun.linked_intro_booked_id !== '__NONE__' ? newRun.linked_intro_booked_id : null;
              await supabase.from('intros_run').insert({
                run_id: `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                member_name: newRun.member_name,
                run_date: newRun.run_date,
                class_time: newRun.class_time,
                ran_by: newRun.ran_by,
                intro_owner: newRun.ran_by,
                lead_source: newRun.lead_source || 'Source Not Found',
                result: newRun.result,
                result_canon: normalizeIntroResultStrict(newRun.result, 'PipelineDialogs:CreateRun'),
                notes: newRun.notes || null,
                linked_intro_booked_id: linkedId,
              });
              if (linkedId && newRun.result !== 'No-show') {
                await syncIntroOwnerToBooking(linkedId, newRun.ran_by, userName);
              }
              toast.success('Intro run logged');
            })}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />} Add Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── AUTO-FIX ──
  if (type === 'auto_fix') {
    return (
      <Dialog open onOpenChange={() => { setFixResults(null); onClose(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Fix Attribution Inconsistencies</DialogTitle>
            <DialogDescription>Found inconsistencies. This will sync intro_owner from runs to linked bookings.</DialogDescription>
          </DialogHeader>
          {fixResults && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-success" /> Fixed {fixResults.fixed} records</div>
              {fixResults.errors > 0 && <div className="flex items-center gap-2 mt-2 text-destructive"><AlertTriangle className="w-5 h-5" /> {fixResults.errors} errors</div>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFixResults(null); onClose(); }}>Cancel</Button>
            <Button disabled={isFixing} onClick={async () => {
              setIsFixing(true);
              let fixed = 0, errors = 0;
              try {
                const inconsistent = journeys.filter(j => j.hasInconsistency);
                for (const j of inconsistent) {
                  for (const r of j.runs) {
                    if (r.linked_intro_booked_id && r.result !== 'No-show') {
                      const runOwner = r.intro_owner || r.ran_by;
                      if (runOwner) {
                        const linked = j.bookings.find(b => b.id === r.linked_intro_booked_id);
                        if (linked && linked.intro_owner !== runOwner) {
                          const ok = await syncIntroOwnerToBooking(r.linked_intro_booked_id, runOwner, userName);
                          ok ? fixed++ : errors++;
                        }
                      }
                    }
                  }
                  for (const b of j.bookings) {
                    if (b.intro_owner && b.intro_owner.includes('T') && b.intro_owner.includes(':')) {
                      const linkedRun = j.runs.find(r => r.linked_intro_booked_id === b.id && r.result !== 'No-show');
                      const correct = linkedRun?.intro_owner || linkedRun?.ran_by || null;
                      const { error } = await supabase.from('intros_booked').update({
                        intro_owner: correct, intro_owner_locked: !!correct,
                        last_edited_at: new Date().toISOString(),
                        last_edited_by: `${userName} (Auto-Fix)`,
                        edit_reason: 'Fixed corrupted intro_owner',
                      }).eq('id', b.id);
                      error ? errors++ : fixed++;
                    }
                  }
                }
                setFixResults({ fixed, errors });
                if (fixed > 0) { toast.success(`Fixed ${fixed} inconsistencies`); await onRefresh(); }
              } catch (e) { console.error(e); toast.error('Auto-fix failed'); }
              finally { setIsFixing(false); }
            }}>
              {isFixing ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Fixing...</> : <><Wand2 className="w-4 h-4 mr-1" /> Fix All</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}
