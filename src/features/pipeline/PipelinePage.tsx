/**
 * ACCEPTANCE TESTS (manual):
 * 1. Edit outcome to Premier → booking closes, buy_date set, AMC idempotency, follow-ups cleared
 * 2. Edit outcome Didn't Buy → No-show → follow-up regeneration correct
 * 3. Edit booking date/time/coach → views update, no duplicates
 * 4. Record purchase → Pipeline row updates, metrics reflect sale
 * 5. Scrolling performance: 500+ rows smooth (virtualized)
 * 6. All outcome edits flow through applyIntroOutcomeUpdate
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  RefreshCw, Loader2, Plus, Wand2, User, DollarSign, UserCheck, Trash2, Save,
  CalendarPlus, CheckCircle, AlertTriangle, X, GitBranch,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ALL_STAFF, SALES_ASSOCIATES, LEAD_SOURCES, MEMBERSHIP_TYPES } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { getLocalDateString, capitalizeName } from '@/lib/utils';
import { normalizeBookingStatus, formatBookingStatusForDb } from '@/lib/domain/outcomes/types';
import { usePipelineData } from './usePipelineData';
import PipelineFiltersBar from './components/PipelineFiltersBar';
import PipelineTable from './components/PipelineTable';
import MembershipPurchasesPanel from '@/components/admin/MembershipPurchasesPanel';
import {
  updateBookingFieldsFromPipeline,
  saveRunFromPipeline,
  updateOutcomeFromPipeline,
  hardDeleteBooking,
  hardDeleteRun,
  linkRunToBooking,
  unlinkRun as unlinkRunAction,
  softDeleteBooking,
  markNotInterested,
  setIntroOwner,
  autoFixInconsistencies,
  syncIntroOwnerToBooking,
} from './pipelineActions';
import type { PipelineBooking, PipelineRun, ClientJourney } from './pipelineTypes';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const BOOKING_STATUSES = ['Active', 'No-show', 'Not interested', 'Closed (Purchased)', 'Duplicate', 'Deleted (soft)'] as const;
const VALID_OUTCOMES = [
  'Closed', 'Follow-up needed', 'Booked 2nd intro', 'No-show',
  'Premier + OTBeat', 'Premier w/o OTBeat', 'Elite + OTBeat', 'Elite w/o OTBeat',
  'Basic + OTBeat', 'Basic w/o OTBeat',
];

export default function PipelinePage() {
  const { user } = useAuth();
  const { refreshData: refreshGlobalData, pendingQueueCount } = useData();
  const isOnline = useOnlineStatus();
  const userName = user?.name || 'Admin';

  const pipeline = usePipelineData();
  const [isSaving, setIsSaving] = useState(false);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  // Dialog states
  const [editingBooking, setEditingBooking] = useState<PipelineBooking | null>(null);
  const [editBookingReason, setEditBookingReason] = useState('');
  const [editingRun, setEditingRun] = useState<PipelineRun | null>(null);
  const [editRunReason, setEditRunReason] = useState('');
  const [originalRunResult, setOriginalRunResult] = useState('');

  // Purchase dialog
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [purchasingBooking, setPurchasingBooking] = useState<PipelineBooking | null>(null);
  const [purchaseData, setPurchaseData] = useState({ date_closed: getLocalDateString(), membership_type: '', sale_type: 'Intro' as 'Intro' | 'Outside Intro', intro_owner: '' });

  // Set owner dialog
  const [showSetOwnerDialog, setShowSetOwnerDialog] = useState(false);
  const [ownerBooking, setOwnerBooking] = useState<PipelineBooking | null>(null);
  const [newIntroOwner, setNewIntroOwner] = useState('');
  const [ownerOverrideReason, setOwnerOverrideReason] = useState('');

  // Delete dialogs
  const [showHardDeleteDialog, setShowHardDeleteDialog] = useState(false);
  const [deletingBooking, setDeletingBooking] = useState<PipelineBooking | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showHardDeleteRunDialog, setShowHardDeleteRunDialog] = useState(false);
  const [deletingRun, setDeletingRun] = useState<PipelineRun | null>(null);
  const [deleteRunConfirmText, setDeleteRunConfirmText] = useState('');

  // Link dialog
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkingRun, setLinkingRun] = useState<PipelineRun | null>(null);
  const [availableBookingsForLink, setAvailableBookingsForLink] = useState<PipelineBooking[]>([]);

  // Create booking dialog
  const [showCreateBookingDialog, setShowCreateBookingDialog] = useState(false);
  const [isSelfBooked, setIsSelfBooked] = useState(false);
  const [creatingBookingFromRun, setCreatingBookingFromRun] = useState<PipelineRun | null>(null);
  const [secondIntroOriginatingId, setSecondIntroOriginatingId] = useState<string | null>(null);
  const [pickFromPipeline, setPickFromPipeline] = useState(false);
  const [pipelineSearch, setPipelineSearch] = useState('');
  const [newBooking, setNewBooking] = useState({ member_name: '', class_date: getLocalDateString(), intro_time: '', coach_name: '', sa_working_shift: '', lead_source: '', fitness_goal: '' });

  // Create run dialog
  const [showCreateRunDialog, setShowCreateRunDialog] = useState(false);
  const [creatingRunForJourney, setCreatingRunForJourney] = useState<ClientJourney | null>(null);
  const [newRun, setNewRun] = useState({ member_name: '', run_date: getLocalDateString(), class_time: '', ran_by: '', lead_source: '', result: '', notes: '', linked_intro_booked_id: '' });

  // Fix dialog
  const [showFixDialog, setShowFixDialog] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [fixResults, setFixResults] = useState<{ fixed: number; errors: number } | null>(null);

  // VIP bulk schedule
  const [bulkScheduleGroup, setBulkScheduleGroup] = useState<string | null>(null);
  const [bulkDate, setBulkDate] = useState('');
  const [bulkTime, setBulkTime] = useState('');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const toggleExpand = (key: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const refreshAll = async () => {
    await pipeline.fetchData();
    await refreshGlobalData();
  };

  // ── Handlers (delegate to pipelineActions) ──

  const handleSaveBooking = async () => {
    if (!editingBooking) return;
    setIsSaving(true);
    try {
      await updateBookingFieldsFromPipeline({
        bookingId: editingBooking.id,
        updates: {
          member_name: editingBooking.member_name,
          class_date: editingBooking.class_date,
          intro_time: editingBooking.intro_time,
          coach_name: editingBooking.coach_name,
          sa_working_shift: editingBooking.sa_working_shift,
          booked_by: editingBooking.booked_by,
          lead_source: editingBooking.lead_source,
          fitness_goal: editingBooking.fitness_goal,
          booking_status: editingBooking.booking_status,
        },
        editedBy: userName,
        editReason: editBookingReason || 'Pipeline edit',
      });
      toast.success('Booking updated');
      setEditingBooking(null);
      await refreshAll();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save booking');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRun = async () => {
    if (!editingRun) return;
    setIsSaving(true);
    try {
      await saveRunFromPipeline({ run: editingRun, originalResult: originalRunResult, editedBy: userName, editReason: editRunReason || 'Pipeline edit' });
      toast.success('Run updated');
      setEditingRun(null);
      await refreshAll();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save run');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmPurchase = async () => {
    if (!purchasingBooking || !purchaseData.membership_type) { toast.error('Membership type required'); return; }
    if (purchaseData.sale_type === 'Intro' && !purchaseData.intro_owner) { toast.error('Intro owner required'); return; }
    setIsSaving(true);
    try {
      const cfg = MEMBERSHIP_TYPES.find(m => m.label === purchaseData.membership_type);
      const commission = cfg?.commission || 0;
      const saleId = `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await supabase.from('sales_outside_intro').insert({
        sale_id: saleId,
        sale_type: purchaseData.sale_type === 'Intro' ? 'intro' : 'outside_intro',
        member_name: purchasingBooking.member_name,
        lead_source: purchasingBooking.lead_source,
        membership_type: purchaseData.membership_type,
        commission_amount: commission,
        intro_owner: purchaseData.intro_owner || null,
        date_closed: purchaseData.date_closed,
      });
      await updateOutcomeFromPipeline({
        bookingId: purchasingBooking.id,
        memberName: purchasingBooking.member_name,
        classDate: purchasingBooking.class_date,
        newResultDisplay: purchaseData.membership_type,
        commissionAmount: commission,
        leadSource: purchasingBooking.lead_source,
        editedBy: userName,
        editReason: 'Marked as purchased via Pipeline',
      });
      toast.success('Sale recorded');
      setShowPurchaseDialog(false);
      await refreshAll();
    } catch (e) {
      console.error(e);
      toast.error('Failed to record purchase');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkNotInterested = async (b: PipelineBooking) => {
    if (!isOnline) { toast.error('Cannot perform this action offline'); return; }
    setIsSaving(true);
    try {
      await markNotInterested(b.id, userName);
      toast.success('Marked as not interested');
      await refreshAll();
    } catch (e) { console.error(e); toast.error('Failed'); } finally { setIsSaving(false); }
  };

  const handleConfirmSetOwner = async () => {
    if (!ownerBooking) return;
    setIsSaving(true);
    try {
      await setIntroOwner(ownerBooking.id, newIntroOwner === '__CLEAR__' ? null : newIntroOwner, userName, ownerOverrideReason);
      toast.success(newIntroOwner === '__CLEAR__' ? 'Owner cleared' : `Owner set to ${newIntroOwner}`);
      setShowSetOwnerDialog(false);
      await refreshAll();
    } catch (e) { console.error(e); toast.error('Failed'); } finally { setIsSaving(false); }
  };

  const handleSoftDelete = async (b: PipelineBooking) => {
    setIsSaving(true);
    try {
      await softDeleteBooking(b.id, userName);
      toast.success('Archived');
      await refreshAll();
    } catch (e) { console.error(e); toast.error('Failed'); } finally { setIsSaving(false); }
  };

  const handleConfirmHardDelete = async () => {
    if (!deletingBooking || deleteConfirmText !== 'DELETE') return;
    setIsSaving(true);
    try {
      await hardDeleteBooking(deletingBooking.id);
      toast.success('Booking permanently deleted');
      setShowHardDeleteDialog(false);
      await refreshAll();
    } catch (e) { console.error(e); toast.error('Failed'); } finally { setIsSaving(false); }
  };

  const handleConfirmHardDeleteRun = async () => {
    if (!deletingRun || deleteRunConfirmText !== 'DELETE') return;
    setIsSaving(true);
    try {
      await hardDeleteRun(deletingRun.id);
      toast.success('Run permanently deleted');
      setShowHardDeleteRunDialog(false);
      await refreshAll();
    } catch (e) { console.error(e); toast.error('Failed'); } finally { setIsSaving(false); }
  };

  const handleLinkRunToBooking = async (bookingId: string) => {
    if (!linkingRun) return;
    setIsSaving(true);
    try {
      await linkRunToBooking(linkingRun.id, bookingId, linkingRun.ran_by, linkingRun.result, userName);
      toast.success('Run linked');
      setShowLinkDialog(false);
      await refreshAll();
    } catch (e) { console.error(e); toast.error('Failed'); } finally { setIsSaving(false); }
  };

  const handleUnlinkRun = async (run: PipelineRun) => {
    setIsSaving(true);
    try {
      await unlinkRunAction(run.id, userName);
      toast.success('Run unlinked');
      await refreshAll();
    } catch (e) { console.error(e); toast.error('Failed'); } finally { setIsSaving(false); }
  };

  const handleLog2ndIntroRun = async (journey: ClientJourney) => {
    const first = journey.bookings.find(b => !b.originating_booking_id) || journey.bookings[0];
    if (!first) { toast.error('No original booking found'); return; }
    setIsSaving(true);
    try {
      const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const { data: ins, error } = await supabase.from('intros_booked').insert({
        booking_id: bookingId, member_name: journey.memberName, class_date: getLocalDateString(),
        coach_name: first.coach_name || 'TBD', sa_working_shift: first.sa_working_shift,
        booked_by: first.booked_by || first.sa_working_shift, lead_source: first.lead_source,
        fitness_goal: first.fitness_goal || null, booking_status: 'Active', booking_status_canon: 'ACTIVE',
        originating_booking_id: first.id, email: first.email || null, phone: first.phone || null,
      }).select().single();
      if (error) throw error;
      setCreatingRunForJourney(journey);
      setNewRun({ member_name: journey.memberName, run_date: getLocalDateString(), class_time: '', ran_by: '', lead_source: first.lead_source || '', result: '', notes: '', linked_intro_booked_id: ins.id });
      setShowCreateRunDialog(true);
      toast.info('2nd intro booking created — now log the run');
    } catch (e) { console.error(e); toast.error('Failed'); } finally { setIsSaving(false); }
  };

  const handleCreateBooking = async () => {
    if (!newBooking.member_name) { toast.error('Name required'); return; }
    if (!isSelfBooked && !newBooking.sa_working_shift) { toast.error('Booked By required'); return; }
    setIsSaving(true);
    try {
      const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const bookedBy = isSelfBooked ? 'Self-booked' : newBooking.sa_working_shift;
      const leadSource = isSelfBooked ? 'Online Intro Offer (self-booked)' : (newBooking.lead_source || 'Source Not Found');
      const introOwner = creatingBookingFromRun?.intro_owner || creatingBookingFromRun?.ran_by || null;
      const { data: ins, error } = await supabase.from('intros_booked').insert({
        booking_id: bookingId, member_name: newBooking.member_name, class_date: newBooking.class_date,
        intro_time: newBooking.intro_time || null, coach_name: newBooking.coach_name || 'TBD',
        sa_working_shift: bookedBy, booked_by: bookedBy, lead_source: leadSource,
        fitness_goal: newBooking.fitness_goal || null, booking_status: 'Active', booking_status_canon: 'ACTIVE',
        intro_owner: introOwner, intro_owner_locked: !!introOwner,
        originating_booking_id: secondIntroOriginatingId || null,
      }).select().single();
      if (error) throw error;
      if (creatingBookingFromRun && ins) {
        await supabase.from('intros_run').update({ linked_intro_booked_id: ins.id, last_edited_at: new Date().toISOString(), last_edited_by: userName, edit_reason: 'Linked to new booking' }).eq('id', creatingBookingFromRun.id);
      }
      toast.success(secondIntroOriginatingId ? '2nd intro booked' : 'Booking created');
      setShowCreateBookingDialog(false);
      setCreatingBookingFromRun(null);
      setSecondIntroOriginatingId(null);
      await refreshAll();
    } catch (e) { console.error(e); toast.error('Failed'); } finally { setIsSaving(false); }
  };

  const handleCreateRun = async () => {
    if (!newRun.member_name || !newRun.ran_by || !newRun.result || !newRun.class_time) { toast.error('Fill required fields'); return; }
    setIsSaving(true);
    try {
      const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const linkedId = newRun.linked_intro_booked_id && newRun.linked_intro_booked_id !== '__NONE__' ? newRun.linked_intro_booked_id : null;
      await supabase.from('intros_run').insert({
        run_id: runId, member_name: newRun.member_name, run_date: newRun.run_date,
        class_time: newRun.class_time, ran_by: newRun.ran_by, intro_owner: newRun.ran_by,
        lead_source: newRun.lead_source || 'Source Not Found', result: newRun.result,
        notes: newRun.notes || null, linked_intro_booked_id: linkedId,
      });
      if (linkedId && newRun.result !== 'No-show') {
        await syncIntroOwnerToBooking(linkedId, newRun.ran_by, userName);
      }
      toast.success('Run logged');
      setShowCreateRunDialog(false);
      setCreatingRunForJourney(null);
      await refreshAll();
    } catch (e) { console.error(e); toast.error('Failed'); } finally { setIsSaving(false); }
  };

  const handleAutoFix = async () => {
    setIsFixing(true);
    setFixResults(null);
    try {
      const result = await autoFixInconsistencies(pipeline.journeys, userName);
      setFixResults(result);
      if (result.fixed > 0) {
        toast.success(`Fixed ${result.fixed} inconsistencies`);
        await refreshAll();
      }
    } catch (e) { console.error(e); toast.error('Auto-fix failed'); } finally { setIsFixing(false); }
  };

  const handleBulkSchedule = async (groupName: string) => {
    if (!bulkDate || !bulkTime) { toast.error('Set date and time'); return; }
    setIsBulkUpdating(true);
    try {
      const { data: updated, error } = await supabase.from('intros_booked').update({ class_date: bulkDate, intro_time: bulkTime }).eq('vip_class_name', groupName).is('deleted_at', null).select('id');
      if (error) throw error;
      if (updated?.length) {
        await supabase.from('intro_questionnaires').update({ scheduled_class_date: bulkDate, scheduled_class_time: bulkTime }).in('booking_id', updated.map(b => b.id));
      }
      toast.success(`Updated ${updated?.length || 0} bookings`);
      setBulkScheduleGroup(null);
      await pipeline.fetchData();
    } catch (e) { console.error(e); toast.error('Failed'); } finally { setIsBulkUpdating(false); }
  };

  const handleMarkRunNotInterested = async (run: PipelineRun, journey: ClientJourney) => {
    if (run.linked_intro_booked_id) {
      const linked = journey.bookings.find(b => b.id === run.linked_intro_booked_id);
      if (linked) { await handleMarkNotInterested(linked); return; }
    }
    // Create temp booking and mark
    setIsSaving(true);
    try {
      const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await supabase.from('intros_booked').insert({
        booking_id: bookingId, member_name: run.member_name, class_date: run.run_date || getLocalDateString(),
        intro_time: run.class_time || null, coach_name: 'TBD', sa_working_shift: run.ran_by || 'Unknown',
        booked_by: run.ran_by || 'Unknown', lead_source: run.lead_source || 'Source Not Found',
        booking_status: 'Not interested', booking_status_canon: 'NOT_INTERESTED',
        intro_owner: run.intro_owner || run.ran_by, closed_at: new Date().toISOString(), closed_by: userName,
      });
      toast.success('Marked as Not Interested');
      await refreshAll();
    } catch (e) { console.error(e); toast.error('Failed'); } finally { setIsSaving(false); }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="mb-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            Client Pipeline
          </h1>
          <div className="flex items-center gap-2">
            {!isOnline && <Badge variant="destructive" className="text-[10px]">Offline</Badge>}
            {pendingQueueCount > 0 && <Badge variant="outline" className="text-[10px]">Pending: {pendingQueueCount}</Badge>}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Track clients from booking through purchase</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4" /> Client Journey View
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                setNewBooking({ member_name: '', class_date: getLocalDateString(), intro_time: '', coach_name: '', sa_working_shift: '', lead_source: '', fitness_goal: '' });
                setIsSelfBooked(false); setCreatingBookingFromRun(null); setSecondIntroOriginatingId(null); setPickFromPipeline(false); setPipelineSearch('');
                setShowCreateBookingDialog(true);
              }}>
                <Plus className="w-4 h-4 mr-1" /> Add Booking
              </Button>
              {pipeline.inconsistencyCount > 0 && (
                <Button variant="outline" size="sm" onClick={() => setShowFixDialog(true)} className="text-warning">
                  <Wand2 className="w-4 h-4 mr-1" /> Fix {pipeline.inconsistencyCount}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={pipeline.fetchData} disabled={pipeline.isLoading}>
                <RefreshCw className={`w-4 h-4 ${pipeline.isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Unified view of client bookings, runs, and outcomes. Click to expand and edit.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <PipelineFiltersBar
            searchTerm={pipeline.searchTerm} onSearchChange={pipeline.setSearchTerm}
            activeTab={pipeline.activeTab} onTabChange={pipeline.setActiveTab}
            filterInconsistencies={pipeline.filterInconsistencies} onToggleInconsistencies={() => pipeline.setFilterInconsistencies(!pipeline.filterInconsistencies)}
            inconsistencyCount={pipeline.inconsistencyCount} tabCounts={pipeline.tabCounts}
            selectedLeadSource={pipeline.selectedLeadSource} onLeadSourceChange={pipeline.setSelectedLeadSource}
            leadSourceOptions={pipeline.leadSourceOptions}
          />

          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2 bg-muted/50 rounded"><div className="font-bold">{pipeline.filteredJourneys.length}</div><div className="text-muted-foreground">Showing</div></div>
            <div className="p-2 bg-muted/50 rounded"><div className="font-bold text-success">{pipeline.journeys.filter(j => j.hasSale).length}</div><div className="text-muted-foreground">Purchased</div></div>
            <div className="p-2 bg-muted/50 rounded"><div className="font-bold text-primary">{pipeline.journeys.filter(j => j.status === 'active').length}</div><div className="text-muted-foreground">Active</div></div>
            <div className="p-2 bg-muted/50 rounded"><div className="font-bold text-warning">{pipeline.inconsistencyCount}</div><div className="text-muted-foreground">Issues</div></div>
          </div>

          {pipeline.isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <PipelineTable
              journeys={pipeline.filteredJourneys}
              expandedClients={expandedClients}
              onToggleExpand={toggleExpand}
              vipInfoMap={pipeline.vipInfoMap}
              isVipTab={pipeline.activeTab === 'vip_class'}
              vipGroups={pipeline.vipGroups}
              isSaving={isSaving}
              onEditBooking={(b) => { setEditingBooking({ ...b }); setEditBookingReason(''); }}
              onEditRun={(r) => { setEditingRun({ ...r }); setOriginalRunResult(r.result); setEditRunReason(''); }}
              onPurchase={(b) => { setPurchasingBooking(b); setPurchaseData({ date_closed: getLocalDateString(), membership_type: '', sale_type: 'Intro', intro_owner: b.intro_owner || '' }); setShowPurchaseDialog(true); }}
              onMarkNotInterested={handleMarkNotInterested}
              onSetOwner={(b) => { setOwnerBooking(b); setNewIntroOwner(b.intro_owner || ''); setOwnerOverrideReason(''); setShowSetOwnerDialog(true); }}
              onSoftDelete={handleSoftDelete}
              onHardDeleteBooking={(b) => { setDeletingBooking(b); setDeleteConfirmText(''); setShowHardDeleteDialog(true); }}
              onHardDeleteRun={(r) => { setDeletingRun(r); setDeleteRunConfirmText(''); setShowHardDeleteRunDialog(true); }}
              onLog2ndIntroRun={handleLog2ndIntroRun}
              onBook2ndIntro={(j) => {
                const first = j.bookings.find(b => !b.originating_booking_id) || j.bookings[0];
                if (!first) return;
                setNewBooking({ member_name: j.memberName, class_date: getLocalDateString(), intro_time: '', coach_name: first.coach_name || '', sa_working_shift: '', lead_source: first.lead_source || '', fitness_goal: first.fitness_goal || '' });
                setIsSelfBooked(false); setCreatingBookingFromRun(null); setSecondIntroOriginatingId(first.id); setShowCreateBookingDialog(true);
              }}
              onCreateRun={(j) => {
                setCreatingRunForJourney(j);
                const lb = j.bookings.find(b => !b.booking_status || normalizeBookingStatus(b.booking_status) === 'ACTIVE');
                setNewRun({ member_name: j.memberName, run_date: getLocalDateString(), class_time: lb?.intro_time || '', ran_by: '', lead_source: lb?.lead_source || '', result: '', notes: '', linked_intro_booked_id: lb?.id || '' });
                setShowCreateRunDialog(true);
              }}
              onLinkRun={(r, bookings) => {
                setLinkingRun(r);
                setAvailableBookingsForLink(bookings.filter(b => b.member_name.toLowerCase() === r.member_name.toLowerCase() && (!b.booking_status || ['Active', 'No-show'].includes(b.booking_status))));
                setShowLinkDialog(true);
              }}
              onCreateMatchingBooking={(r) => {
                setNewBooking({ member_name: r.member_name, class_date: r.run_date || getLocalDateString(), intro_time: r.class_time || '', coach_name: '', sa_working_shift: '', lead_source: r.lead_source || '', fitness_goal: '' });
                setIsSelfBooked(r.lead_source === 'Online Intro Offer (self-booked)');
                setCreatingBookingFromRun(r); setSecondIntroOriginatingId(null); setShowCreateBookingDialog(true);
              }}
              onUnlinkRun={handleUnlinkRun}
              onMarkRunNotInterested={handleMarkRunNotInterested}
              userName={userName}
              bulkScheduleGroup={bulkScheduleGroup}
              onBulkScheduleGroup={setBulkScheduleGroup}
              bulkDate={bulkDate}
              onBulkDateChange={setBulkDate}
              bulkTime={bulkTime}
              onBulkTimeChange={setBulkTime}
              onBulkSchedule={handleBulkSchedule}
              isBulkUpdating={isBulkUpdating}
            />
          )}

          {/* ── DIALOGS ── */}

          {/* Edit Booking */}
          <Dialog open={!!editingBooking} onOpenChange={(o) => !o && setEditingBooking(null)}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Edit Booking</DialogTitle><DialogDescription>Update booking details for {editingBooking?.member_name}</DialogDescription></DialogHeader>
              {editingBooking && (
                <div className="space-y-3">
                  <div><Label className="text-xs">Member Name</Label><Input value={editingBooking.member_name} onChange={(e) => setEditingBooking({...editingBooking, member_name: e.target.value})} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Date</Label><Input type="date" value={editingBooking.class_date} onChange={(e) => setEditingBooking({...editingBooking, class_date: e.target.value})} /></div>
                    <div><Label className="text-xs">Time</Label><Input type="time" value={editingBooking.intro_time || ''} onChange={(e) => setEditingBooking({...editingBooking, intro_time: e.target.value})} /></div>
                  </div>
                  <div><Label className="text-xs">Booked By</Label><Select value={editingBooking.booked_by || editingBooking.sa_working_shift || ''} onValueChange={(v) => setEditingBooking({...editingBooking, booked_by: v, sa_working_shift: v})}><SelectTrigger><SelectValue placeholder="Select SA..." /></SelectTrigger><SelectContent><SelectItem value="Self-booked">Self-booked</SelectItem>{SALES_ASSOCIATES.map(sa => <SelectItem key={sa} value={sa}>{sa}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label className="text-xs">Lead Source</Label><Select value={editingBooking.lead_source || ''} onValueChange={(v) => setEditingBooking({...editingBooking, lead_source: v})}><SelectTrigger><SelectValue placeholder="Select source..." /></SelectTrigger><SelectContent>{LEAD_SOURCES.map(src => <SelectItem key={src} value={src}>{src}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label className="text-xs">Coach</Label><Select value={editingBooking.coach_name || ''} onValueChange={(v) => setEditingBooking({...editingBooking, coach_name: v === '__TBD__' ? 'TBD' : v})}><SelectTrigger><SelectValue placeholder="Select coach..." /></SelectTrigger><SelectContent><SelectItem value="__TBD__">— TBD —</SelectItem>{ALL_STAFF.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label className="text-xs">Status</Label><Select value={editingBooking.booking_status || 'Active'} onValueChange={(v) => setEditingBooking({...editingBooking, booking_status: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BOOKING_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label className="text-xs">Fitness Goal</Label><Textarea value={editingBooking.fitness_goal || ''} onChange={(e) => setEditingBooking({...editingBooking, fitness_goal: e.target.value})} className="min-h-[60px]" /></div>
                  <div><Label className="text-xs">Edit Reason</Label><Input value={editBookingReason} onChange={(e) => setEditBookingReason(e.target.value)} placeholder="Why?" /></div>
                </div>
              )}
              <DialogFooter><Button variant="outline" onClick={() => setEditingBooking(null)}>Cancel</Button><Button onClick={handleSaveBooking} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Run */}
          <Dialog open={!!editingRun} onOpenChange={(o) => !o && setEditingRun(null)}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Edit Run</DialogTitle><DialogDescription>Update run for {editingRun?.member_name}</DialogDescription></DialogHeader>
              {editingRun && (
                <div className="space-y-3">
                  <div><Label className="text-xs">Member Name</Label><Input value={editingRun.member_name} onChange={(e) => setEditingRun({...editingRun, member_name: e.target.value})} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Run Date</Label><Input type="date" value={editingRun.run_date || ''} onChange={(e) => setEditingRun({...editingRun, run_date: e.target.value})} /></div>
                    <div><Label className="text-xs">Time</Label><Input type="time" value={editingRun.class_time} onChange={(e) => setEditingRun({...editingRun, class_time: e.target.value})} /></div>
                  </div>
                  <div><Label className="text-xs">Ran By</Label><Select value={editingRun.ran_by || ''} onValueChange={(v) => setEditingRun({...editingRun, ran_by: v})}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{SALES_ASSOCIATES.map(sa => <SelectItem key={sa} value={sa}>{sa}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label className="text-xs">Result/Outcome</Label><Select value={editingRun.result} onValueChange={(v) => setEditingRun({...editingRun, result: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{VALID_OUTCOMES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label className="text-xs">Lead Source</Label><Select value={editingRun.lead_source || ''} onValueChange={(v) => setEditingRun({...editingRun, lead_source: v})}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{LEAD_SOURCES.map(src => <SelectItem key={src} value={src}>{src}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label className="text-xs">Coach</Label><Select value={editingRun.coach_name || ''} onValueChange={(v) => setEditingRun({...editingRun, coach_name: v})}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{ALL_STAFF.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                  <div className="border-t pt-3"><Label className="text-xs font-semibold mb-2 block">Sale Info</Label><div className="grid grid-cols-2 gap-2"><div><Label className="text-xs">Buy Date</Label><Input type="date" value={editingRun.buy_date || ''} onChange={(e) => setEditingRun({...editingRun, buy_date: e.target.value})} /></div><div><Label className="text-xs">Commission $</Label><Input type="number" step="0.01" value={editingRun.commission_amount || ''} onChange={(e) => setEditingRun({...editingRun, commission_amount: parseFloat(e.target.value) || 0})} /></div></div></div>
                  <div><Label className="text-xs">Notes</Label><Textarea value={editingRun.notes || ''} onChange={(e) => setEditingRun({...editingRun, notes: e.target.value})} className="min-h-[60px]" /></div>
                  <div><Label className="text-xs">Edit Reason</Label><Input value={editRunReason} onChange={(e) => setEditRunReason(e.target.value)} placeholder="Why?" /></div>
                </div>
              )}
              <DialogFooter><Button variant="outline" onClick={() => setEditingRun(null)}>Cancel</Button><Button onClick={handleSaveRun} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Purchase Dialog */}
          <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle>Mark as Purchased</DialogTitle><DialogDescription>Record a sale for {purchasingBooking?.member_name}</DialogDescription></DialogHeader>
              <div className="space-y-3">
                <div><Label className="text-xs">Date Closed</Label><Input type="date" value={purchaseData.date_closed} onChange={(e) => setPurchaseData({...purchaseData, date_closed: e.target.value})} /></div>
                <div><Label className="text-xs">Membership Type *</Label><Select value={purchaseData.membership_type} onValueChange={(v) => setPurchaseData({...purchaseData, membership_type: v})}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{MEMBERSHIP_TYPES.map(m => <SelectItem key={m.label} value={m.label}>{m.label} (${m.commission})</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="text-xs">Sale Type</Label><Select value={purchaseData.sale_type} onValueChange={(v) => setPurchaseData({...purchaseData, sale_type: v as any})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Intro">Intro</SelectItem><SelectItem value="Outside Intro">Outside Intro</SelectItem></SelectContent></Select></div>
                <div><Label className="text-xs">Intro Owner *</Label><Select value={purchaseData.intro_owner} onValueChange={(v) => setPurchaseData({...purchaseData, intro_owner: v})}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{SALES_ASSOCIATES.map(sa => <SelectItem key={sa} value={sa}>{sa}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setShowPurchaseDialog(false)}>Cancel</Button><Button onClick={handleConfirmPurchase} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <DollarSign className="w-4 h-4 mr-1" />}Record Sale</Button></DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Set Owner Dialog */}
          <Dialog open={showSetOwnerDialog} onOpenChange={setShowSetOwnerDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle>Set Intro Owner</DialogTitle><DialogDescription>{ownerBooking?.intro_owner_locked ? `Override (currently ${ownerBooking.intro_owner})` : 'Assign intro owner'}</DialogDescription></DialogHeader>
              <div className="space-y-3">
                <div><Label className="text-xs">Intro Owner</Label><Select value={newIntroOwner} onValueChange={setNewIntroOwner}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent><SelectItem value="__CLEAR__">— Clear (unlock) —</SelectItem>{SALES_ASSOCIATES.map(sa => <SelectItem key={sa} value={sa}>{sa}</SelectItem>)}</SelectContent></Select></div>
                {(ownerBooking?.intro_owner_locked || newIntroOwner === '__CLEAR__') && <div><Label className="text-xs">Reason</Label><Textarea value={ownerOverrideReason} onChange={(e) => setOwnerOverrideReason(e.target.value)} placeholder="Why?" className="min-h-[60px]" /></div>}
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setShowSetOwnerDialog(false)}>Cancel</Button><Button onClick={handleConfirmSetOwner} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <UserCheck className="w-4 h-4 mr-1" />}{newIntroOwner === '__CLEAR__' ? 'Clear' : 'Set Owner'}</Button></DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Hard Delete Booking */}
          <Dialog open={showHardDeleteDialog} onOpenChange={setShowHardDeleteDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle className="text-destructive">Permanently Delete Booking</DialogTitle><DialogDescription>This will permanently delete the booking for {deletingBooking?.member_name}. Type DELETE to confirm.</DialogDescription></DialogHeader>
              <Input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder="Type DELETE" />
              <DialogFooter><Button variant="outline" onClick={() => setShowHardDeleteDialog(false)}>Cancel</Button><Button variant="destructive" onClick={handleConfirmHardDelete} disabled={isSaving || deleteConfirmText !== 'DELETE'}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}Delete</Button></DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Hard Delete Run */}
          <Dialog open={showHardDeleteRunDialog} onOpenChange={setShowHardDeleteRunDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle className="text-destructive">Permanently Delete Run</DialogTitle><DialogDescription>Delete run for {deletingRun?.member_name} ({deletingRun?.run_date} — {deletingRun?.result}). Type DELETE.</DialogDescription></DialogHeader>
              <Input value={deleteRunConfirmText} onChange={(e) => setDeleteRunConfirmText(e.target.value)} placeholder="Type DELETE" />
              <DialogFooter><Button variant="outline" onClick={() => setShowHardDeleteRunDialog(false)}>Cancel</Button><Button variant="destructive" onClick={handleConfirmHardDeleteRun} disabled={isSaving || deleteRunConfirmText !== 'DELETE'}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}Delete</Button></DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Link Run to Booking */}
          <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle>Link Run to Booking</DialogTitle><DialogDescription>Select a booking to link with {linkingRun?.member_name}'s run</DialogDescription></DialogHeader>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {availableBookingsForLink.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No available bookings</p> : availableBookingsForLink.map(b => (
                  <div key={b.id} className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50" onClick={() => handleLinkRunToBooking(b.id)}>
                    <div className="font-medium">{b.class_date} {b.intro_time && `@ ${b.intro_time}`}</div>
                    <div className="text-xs text-muted-foreground">Booked by: {capitalizeName(b.booked_by || b.sa_working_shift)} | {b.lead_source}</div>
                  </div>
                ))}
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setShowLinkDialog(false)}>Cancel</Button></DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Create Booking */}
          <Dialog open={showCreateBookingDialog} onOpenChange={(o) => { setShowCreateBookingDialog(o); if (!o) { setCreatingBookingFromRun(null); setSecondIntroOriginatingId(null); } }}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{secondIntroOriginatingId ? 'Book 2nd Intro' : creatingBookingFromRun ? 'Create Matching Booking' : 'Create New Booking'}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                {!creatingBookingFromRun && !secondIntroOriginatingId && (
                  <div className="flex items-center gap-2 pb-1"><Switch checked={pickFromPipeline} onCheckedChange={(c) => { setPickFromPipeline(c); setPipelineSearch(''); if (!c) setNewBooking(prev => ({ ...prev, member_name: '', lead_source: '', coach_name: '', fitness_goal: '' })); }} /><Label className="text-sm">Pick from existing pipeline</Label></div>
                )}
                {pickFromPipeline && !creatingBookingFromRun && !secondIntroOriginatingId ? (
                  <div className="space-y-2">
                    <Input value={pipelineSearch} onChange={(e) => setPipelineSearch(e.target.value)} placeholder="Type a name..." autoFocus />
                    {pipelineSearch.length >= 2 && (
                      <ScrollArea className="max-h-48 border rounded-md">
                        {pipeline.journeys.filter(j => j.memberName.toLowerCase().includes(pipelineSearch.toLowerCase())).slice(0, 15).map(j => (
                          <button key={j.memberKey} type="button" className="w-full text-left px-3 py-2 hover:bg-muted/80 border-b" onClick={() => { setNewBooking(prev => ({ ...prev, member_name: j.memberName, lead_source: j.bookings[0]?.lead_source || '', coach_name: j.bookings[0]?.coach_name || '', fitness_goal: j.bookings[0]?.fitness_goal || '' })); setPipelineSearch(''); setPickFromPipeline(false); }}>
                            <span className="font-medium text-sm">{j.memberName}</span>
                          </button>
                        ))}
                      </ScrollArea>
                    )}
                  </div>
                ) : (
                  <div><Label className="text-xs">Member Name *</Label><Input value={newBooking.member_name} onChange={(e) => setNewBooking({...newBooking, member_name: e.target.value})} disabled={!!creatingBookingFromRun || !!secondIntroOriginatingId} /></div>
                )}
                <div className="flex items-center gap-2"><Switch checked={isSelfBooked} onCheckedChange={setIsSelfBooked} /><Label className="text-sm">Self-booked</Label></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Date *</Label><Input type="date" value={newBooking.class_date} onChange={(e) => setNewBooking({...newBooking, class_date: e.target.value})} /></div>
                  <div><Label className="text-xs">Time</Label><Input type="time" value={newBooking.intro_time} onChange={(e) => setNewBooking({...newBooking, intro_time: e.target.value})} /></div>
                </div>
                {!isSelfBooked && (
                  <>
                    <div><Label className="text-xs">Booked By *</Label><Select value={newBooking.sa_working_shift} onValueChange={(v) => setNewBooking({...newBooking, sa_working_shift: v})}><SelectTrigger><SelectValue placeholder="Select SA..." /></SelectTrigger><SelectContent>{SALES_ASSOCIATES.map(sa => <SelectItem key={sa} value={sa}>{sa}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label className="text-xs">Lead Source</Label><Select value={newBooking.lead_source} onValueChange={(v) => setNewBooking({...newBooking, lead_source: v})}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{LEAD_SOURCES.map(src => <SelectItem key={src} value={src}>{src}</SelectItem>)}</SelectContent></Select></div>
                  </>
                )}
                <div><Label className="text-xs">Coach</Label><Select value={newBooking.coach_name} onValueChange={(v) => setNewBooking({...newBooking, coach_name: v})}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{ALL_STAFF.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => { setShowCreateBookingDialog(false); setCreatingBookingFromRun(null); setSecondIntroOriginatingId(null); }}>Cancel</Button><Button onClick={handleCreateBooking} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}{secondIntroOriginatingId ? 'Book 2nd' : 'Create'}</Button></DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Create Run */}
          <Dialog open={showCreateRunDialog} onOpenChange={setShowCreateRunDialog}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add Intro Run</DialogTitle><DialogDescription>Log run for {creatingRunForJourney?.memberName || 'client'}</DialogDescription></DialogHeader>
              <div className="space-y-3">
                <div><Label className="text-xs">Member Name</Label><Input value={newRun.member_name} onChange={(e) => setNewRun({...newRun, member_name: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Run Date *</Label><Input type="date" value={newRun.run_date} onChange={(e) => setNewRun({...newRun, run_date: e.target.value})} /></div>
                  <div><Label className="text-xs">Time *</Label><Input type="time" value={newRun.class_time} onChange={(e) => setNewRun({...newRun, class_time: e.target.value})} /></div>
                </div>
                <div><Label className="text-xs">Ran By *</Label><Select value={newRun.ran_by} onValueChange={(v) => setNewRun({...newRun, ran_by: v})}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{SALES_ASSOCIATES.map(sa => <SelectItem key={sa} value={sa}>{sa}</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="text-xs">Result *</Label><Select value={newRun.result} onValueChange={(v) => setNewRun({...newRun, result: v})}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{VALID_OUTCOMES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="text-xs">Lead Source</Label><Select value={newRun.lead_source} onValueChange={(v) => setNewRun({...newRun, lead_source: v})}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{LEAD_SOURCES.map(src => <SelectItem key={src} value={src}>{src}</SelectItem>)}</SelectContent></Select></div>
                {creatingRunForJourney && creatingRunForJourney.bookings.length > 0 && (
                  <div><Label className="text-xs">Link to Booking</Label><Select value={newRun.linked_intro_booked_id} onValueChange={(v) => setNewRun({...newRun, linked_intro_booked_id: v})}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent><SelectItem value="__NONE__">— No link —</SelectItem>{creatingRunForJourney.bookings.filter(b => !b.booking_status || normalizeBookingStatus(b.booking_status) === 'ACTIVE').map(b => <SelectItem key={b.id} value={b.id}>{b.class_date} {b.intro_time ? `@ ${b.intro_time}` : ''}</SelectItem>)}</SelectContent></Select></div>
                )}
                <div><Label className="text-xs">Notes</Label><Textarea value={newRun.notes} onChange={(e) => setNewRun({...newRun, notes: e.target.value})} className="min-h-[60px]" /></div>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setShowCreateRunDialog(false)}>Cancel</Button><Button onClick={handleCreateRun} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}Add Run</Button></DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Auto-fix */}
          <Dialog open={showFixDialog} onOpenChange={setShowFixDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle>Fix Attribution Inconsistencies</DialogTitle><DialogDescription>Found {pipeline.inconsistencyCount} clients with mismatched data.</DialogDescription></DialogHeader>
              {fixResults && <div className="p-4 bg-muted rounded-lg"><div className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-success" /><span>Fixed {fixResults.fixed}</span></div>{fixResults.errors > 0 && <div className="flex items-center gap-2 mt-2 text-destructive"><AlertTriangle className="w-5 h-5" /><span>{fixResults.errors} errors</span></div>}</div>}
              <DialogFooter><Button variant="outline" onClick={() => setShowFixDialog(false)}>Cancel</Button><Button onClick={handleAutoFix} disabled={isFixing}>{isFixing ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />Fixing...</> : <><Wand2 className="w-4 h-4 mr-1" />Fix All</>}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <MembershipPurchasesPanel />
    </div>
  );
}
