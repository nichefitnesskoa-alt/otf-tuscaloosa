/**
 * VipPipelineTable — spreadsheet-style VIP member table for the Pipeline VIP tab.
 * Fetches vip_registrations directly so phone/email are always from the registration source.
 * Includes group creation, link generator, copy-link per group pill, manual add, and convert-to-intro.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Star, Search, Download, Copy, ChevronUp, ChevronDown, Loader2,
  Phone, Mail, CalendarPlus, Share2, MessageSquare, Plus, Link2, Trash2,
  ArrowRight, UserPlus, Edit2, Check, X, Archive, RotateCcw,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import { ScriptPickerSheet } from '@/components/scripts/ScriptPickerSheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { ClassTimeSelect } from '@/components/shared/FormHelpers';
import { ConvertVipToIntroDialog } from '@/components/vip/ConvertVipToIntroDialog';
import { useAuth } from '@/context/AuthContext';

// ── Types ────────────────────────────────────────────────────────────────────

interface VipRow {
  // rowId is registration id when no booking yet, else booking id (kept stable per row)
  rowId: string;
  registrationId: string | null;
  bookingId: string | null;
  memberName: string;
  groupName: string;
  regPhone: string | null;
  regEmail: string | null;
  birthday: string | null;
  weightLbs: number | null;
  bookingPhone: string | null;
  bookingEmail: string | null;
  sessionDate: string | null;
  sessionTime: string | null;
  bookingStatus: string | null;
  vipSessionId: string | null;
}

interface VipGroupMeta {
  id: string;
  vip_class_name: string;
  referring_member_name: string | null;
  archived_at: string | null;
}

type SortKey = 'memberName' | 'groupName' | 'phone' | 'email' | 'birthday' | 'weight' | 'session' | 'status';
type SortDir = 'asc' | 'desc';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—';
  try { return format(parseISO(d), 'MM/dd/yyyy'); } catch { return d; }
}

function fmtTime(t: string | null) {
  if (!t) return '';
  try { return format(parseISO(`2000-01-01T${t}`), 'h:mm a'); } catch { return t; }
}

function sessionLabel(row: VipRow) {
  if (!row.sessionDate) return 'Unscheduled';
  return `${fmtDate(row.sessionDate)}${row.sessionTime ? ' ' + fmtTime(row.sessionTime) : ''}`;
}

function displayPhone(row: VipRow) {
  return row.regPhone || row.bookingPhone || null;
}

function displayEmail(row: VipRow) {
  return row.regEmail || row.bookingEmail || null;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function VipPipelineTable() {
  const { user } = useAuth();
  const [rows, setRows] = useState<VipRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [groups, setGroups] = useState<string[]>([]);
  const [archivedGroups, setArchivedGroups] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [groupMetas, setGroupMetas] = useState<VipGroupMeta[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('memberName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Script picker state
  const [scriptRow, setScriptRow] = useState<VipRow | null>(null);
  const [scriptSheetOpen, setScriptSheetOpen] = useState(false);

  // Assign session dialog state
  const [assignRow, setAssignRow] = useState<VipRow | null>(null);
  const [assignDate, setAssignDate] = useState('');
  const [assignTime, setAssignTime] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkDate, setBulkDate] = useState('');
  const [bulkTime, setBulkTime] = useState('');
  const [showBulkDialog, setShowBulkDialog] = useState(false);

  // Create group state
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<VipRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Delete group state
  const [showDeleteGroup, setShowDeleteGroup] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);

  // Convert to intro state
  const [convertRow, setConvertRow] = useState<VipRow | null>(null);

  // Manual add member state
  const [showAddMember, setShowAddMember] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  // Inline edit referring member
  const [editingReferrer, setEditingReferrer] = useState<string | null>(null);
  const [referrerDraft, setReferrerDraft] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Anchor on vip_sessions (groups) — match Scheduler exactly
      const sb = supabase as any;
      const { data: sessions, error: sErr } = await sb
        .from('vip_sessions')
        .select('id, vip_class_name, referring_member_name, status, reserved_by_group, archived_at, session_date, session_time');
      if (sErr) throw sErr;

      setGroupMetas((sessions || []) as unknown as VipGroupMeta[]);

      // Build session metadata lookup
      const sessionById = new Map<string, any>();
      (sessions || []).forEach((s: any) => sessionById.set(s.id, s));

      // Fetch ALL registrations (excluding the group contact rows)
      const { data: regs, error: rErr } = await sb
        .from('vip_registrations')
        .select('id, booking_id, first_name, last_name, phone, email, birthday, weight_lbs, vip_class_name, vip_session_id, is_group_contact')
        .eq('is_group_contact', false);
      if (rErr) throw rErr;

      // Fetch any bookings referenced by these registrations (for booking-side fields)
      const bookingIds = (regs || []).map((r: any) => r.booking_id).filter(Boolean);
      let bookingMap = new Map<string, any>();
      if (bookingIds.length > 0) {
        const { data: bookings } = await sb
          .from('intros_booked')
          .select('id, member_name, vip_class_name, class_date, intro_time, booking_status, vip_session_id, phone, email, deleted_at')
          .in('id', bookingIds);
        (bookings || []).forEach((b: any) => {
          if (!b.deleted_at) bookingMap.set(b.id, b);
        });
      }

      // Also pull bookings created via "Add Member" that have no registration row yet
      // (lead_source = 'VIP Class', has vip_class_name, not deleted, no matching registration.booking_id)
      const { data: extraBookings } = await sb
        .from('intros_booked')
        .select('id, member_name, vip_class_name, class_date, intro_time, booking_status, vip_session_id, phone, email')
        .eq('lead_source', 'VIP Class')
        .is('deleted_at', null)
        .not('vip_class_name', 'is', null);
      const regBookingIds = new Set(bookingIds);
      const orphanBookings = (extraBookings || []).filter((b: any) => !regBookingIds.has(b.id));

      // Build rows: one per registration (booking optional), plus orphan bookings
      const archivedSet = new Set<string>();
      (sessions || []).forEach((s: any) => {
        if (s.archived_at) {
          if (s.reserved_by_group) archivedSet.add(s.reserved_by_group);
          if (s.vip_class_name) archivedSet.add(s.vip_class_name);
        }
      });
      setArchivedGroups(archivedSet);

      const builtRows: VipRow[] = [];

      for (const r of (regs || [])) {
        const session = r.vip_session_id ? sessionById.get(r.vip_session_id) : null;
        // Group label resolution: reserved_by_group → registration.vip_class_name → session.vip_class_name
        const groupName =
          session?.reserved_by_group ||
          r.vip_class_name ||
          session?.vip_class_name ||
          'Unknown';

        const booking = r.booking_id ? bookingMap.get(r.booking_id) : null;
        const fullName = `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Unknown';

        builtRows.push({
          rowId: booking?.id || r.id,
          registrationId: r.id,
          bookingId: booking?.id || null,
          memberName: booking?.member_name || fullName,
          groupName,
          regPhone: r.phone || null,
          regEmail: r.email || null,
          birthday: r.birthday || null,
          weightLbs: r.weight_lbs || null,
          bookingPhone: booking?.phone || null,
          bookingEmail: booking?.email || null,
          sessionDate: booking?.class_date || session?.session_date || null,
          sessionTime: booking?.intro_time || session?.session_time || null,
          bookingStatus: booking ? booking.booking_status : 'Registered – No booking',
          vipSessionId: booking?.vip_session_id || r.vip_session_id || null,
        });
      }

      // Add orphan bookings (manual adds without registrations)
      for (const b of orphanBookings) {
        builtRows.push({
          rowId: b.id,
          registrationId: null,
          bookingId: b.id,
          memberName: b.member_name,
          groupName: b.vip_class_name || 'Unknown',
          regPhone: null,
          regEmail: null,
          birthday: null,
          weightLbs: null,
          bookingPhone: b.phone,
          bookingEmail: b.email,
          sessionDate: b.class_date,
          sessionTime: b.intro_time,
          bookingStatus: b.booking_status,
          vipSessionId: b.vip_session_id,
        });
      }

      setRows(builtRows);

      // Group list: every reserved/claimed session group + every orphan booking group
      const groupNamesSet = new Set<string>();
      (sessions || []).forEach((s: any) => {
        if (s.status === 'reserved' && s.reserved_by_group) groupNamesSet.add(s.reserved_by_group);
        // Also include sessions that have a vip_class_name as a placeholder group (manual created)
        if (s.vip_class_name && !s.reserved_by_group && s.archived_at === null) groupNamesSet.add(s.vip_class_name);
      });
      builtRows.forEach(r => groupNamesSet.add(r.groupName));
      // Always include archived so the dropdown can show them when toggled
      archivedSet.forEach(g => groupNamesSet.add(g));
      setGroups(Array.from(groupNamesSet).sort());
    } catch (err) {
      console.error('VIP fetch error:', err);
      toast.error('Failed to load VIP data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-select first group when groups load or current selection becomes invalid
  useEffect(() => {
    const visibleGroups = groups.filter(g => !archivedGroups.has(g));
    if (visibleGroups.length > 0 && (!selectedGroup || !visibleGroups.includes(selectedGroup))) {
      setSelectedGroup(visibleGroups[0]);
    }
  }, [groups, selectedGroup, archivedGroups]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = rows;
    if (selectedGroup) {
      result = result.filter(r => r.groupName === selectedGroup);
    }
    if (search.trim().length >= 1) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.memberName.toLowerCase().includes(q) ||
        (displayPhone(r) || '').includes(q) ||
        (displayEmail(r) || '').toLowerCase().includes(q)
      );
    }
    result = [...result].sort((a, b) => {
      let aVal = '';
      let bVal = '';
      switch (sortKey) {
        case 'memberName': aVal = a.memberName; bVal = b.memberName; break;
        case 'groupName': aVal = a.groupName; bVal = b.groupName; break;
        case 'phone': aVal = displayPhone(a) || ''; bVal = displayPhone(b) || ''; break;
        case 'email': aVal = displayEmail(a) || ''; bVal = displayEmail(b) || ''; break;
        case 'birthday': aVal = a.birthday || ''; bVal = b.birthday || ''; break;
        case 'weight': aVal = String(a.weightLbs || 0); bVal = String(b.weightLbs || 0); break;
        case 'session': aVal = a.sessionDate || ''; bVal = b.sessionDate || ''; break;
        case 'status': aVal = a.bookingStatus || ''; bVal = b.bookingStatus || ''; break;
      }
      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [rows, selectedGroup, search, sortKey, sortDir]);

  const groupCounts = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(r => map.set(r.groupName, (map.get(r.groupName) || 0) + 1));
    return map;
  }, [rows]);

  const regLink = selectedGroup
    ? `https://otf-tuscaloosa.lovable.app/vip-register?class=${encodeURIComponent(selectedGroup)}`
    : null;

  const selectedGroupMeta = useMemo(() => {
    if (!selectedGroup) return null;
    return groupMetas.find(g => g.vip_class_name === selectedGroup) || null;
  }, [selectedGroup, groupMetas]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronUp className="w-3 h-3 opacity-20" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-primary" />
      : <ChevronDown className="w-3 h-3 text-primary" />;
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedRows.size === filtered.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filtered.map(r => r.rowId)));
    }
  };

  const handleCopyPhone = (row: VipRow) => {
    const phone = displayPhone(row);
    if (phone) {
      navigator.clipboard.writeText(phone);
      toast.success(`Copied ${phone}`);
    } else {
      toast.error('No phone number for this member');
    }
  };

  const handleAssignSingle = async () => {
    if (!assignRow || !assignDate) return;
    if (!assignRow.bookingId) {
      toast.error('Create a booking first before assigning a session');
      return;
    }
    setAssigning(true);
    try {
      await supabase
        .from('intros_booked')
        .update({ class_date: assignDate, intro_time: assignTime || null, booking_status: 'Active' } as any)
        .eq('id', assignRow.bookingId);
      toast.success(`${assignRow.memberName} assigned to ${fmtDate(assignDate)}`);
      setAssignRow(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to assign session');
    } finally {
      setAssigning(false);
    }
  };

  const handleBulkAssign = async () => {
    if (selectedRows.size === 0 || !bulkDate) {
      toast.error('Select members and set a date first');
      return;
    }
    setBulkAssigning(true);
    try {
      // Map selected rowIds → bookingIds (skip rows without bookings)
      const selectedRowSet = selectedRows;
      const ids = filtered
        .filter(r => selectedRowSet.has(r.rowId) && r.bookingId)
        .map(r => r.bookingId!) as string[];
      const skipped = selectedRows.size - ids.length;
      if (ids.length === 0) {
        toast.error('Selected members have no bookings yet — create bookings first');
        return;
      }
      await supabase
        .from('intros_booked')
        .update({ class_date: bulkDate, intro_time: bulkTime || null, booking_status: 'Active' } as any)
        .in('id', ids);
      toast.success(
        `Assigned ${ids.length} member(s) to ${fmtDate(bulkDate)}${skipped > 0 ? ` (${skipped} skipped — no booking)` : ''}`
      );
      setSelectedRows(new Set());
      setShowBulkDialog(false);
      setBulkDate('');
      setBulkTime('');
      fetchData();
    } catch (err) {
      toast.error('Failed to bulk assign');
    } finally {
      setBulkAssigning(false);
    }
  };

  const handleExportCsv = () => {
    const visibleRows = filtered;
    const headers = ['Name', 'Group', 'Phone', 'Email', 'Birthday', 'Weight (lbs)', 'Session', 'Status'];
    const csvRows = visibleRows.map(r => [
      `"${r.memberName}"`,
      `"${r.groupName}"`,
      `"${displayPhone(r) || ''}"`,
      `"${displayEmail(r) || ''}"`,
      `"${r.birthday ? fmtDate(r.birthday) : ''}"`,
      `"${r.weightLbs || ''}"`,
      `"${sessionLabel(r)}"`,
      `"${r.bookingStatus || 'Unscheduled'}"`,
    ].join(','));
    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vip_${selectedGroup.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) { toast.error('Group name is required'); return; }
    setCreatingGroup(true);
    try {
      const slug = newGroupName.trim();
      // Create a vip_session so referring_member_name can be tracked
      await supabase.from('vip_sessions').insert({ vip_class_name: slug } as any);
      setGroups(prev => Array.from(new Set([...prev, slug])).sort());
      setSelectedGroup(slug);
      setShowCreateGroup(false);
      setNewGroupName('');
      setNewGroupDesc('');
      const link = `https://otf-tuscaloosa.lovable.app/vip-register?class=${encodeURIComponent(slug)}`;
      navigator.clipboard.writeText(link);
      toast.success(`Group "${slug}" created! Registration link copied to clipboard.`);
      fetchData();
    } catch (err) {
      toast.error('Failed to create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  const copyGroupLink = (groupName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const link = `https://otf-tuscaloosa.lovable.app/vip-register?class=${encodeURIComponent(groupName)}`;
    navigator.clipboard.writeText(link);
    toast.success(`Link for ${groupName} copied!`);
  };

  const handleDeleteSingle = async (row: VipRow) => {
    setDeleting(true);
    try {
      if (row.bookingId) {
        await supabase
          .from('intros_booked')
          .update({ deleted_at: new Date().toISOString(), deleted_by: 'staff' } as any)
          .eq('id', row.bookingId);
        await supabase
          .from('vip_registrations')
          .delete()
          .eq('booking_id', row.bookingId);
      }
      if (row.registrationId) {
        await supabase
          .from('vip_registrations')
          .delete()
          .eq('id', row.registrationId);
      }
      toast.success(`${row.memberName} removed from VIP list`);
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to delete member');
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const selectedRowSet = selectedRows;
      const targetRows = filtered.filter(r => selectedRowSet.has(r.rowId));
      const bookingIds = targetRows.map(r => r.bookingId).filter(Boolean) as string[];
      const regIds = targetRows.map(r => r.registrationId).filter(Boolean) as string[];
      if (bookingIds.length > 0) {
        await supabase
          .from('intros_booked')
          .update({ deleted_at: new Date().toISOString(), deleted_by: 'staff' } as any)
          .in('id', bookingIds);
        await supabase
          .from('vip_registrations')
          .delete()
          .in('booking_id', bookingIds);
      }
      if (regIds.length > 0) {
        await supabase
          .from('vip_registrations')
          .delete()
          .in('id', regIds);
      }
      toast.success(`${targetRows.length} member(s) removed from VIP list`);
      setSelectedRows(new Set());
      setShowBulkDelete(false);
      fetchData();
    } catch (err) {
      toast.error('Failed to delete members');
    } finally {
      setBulkDeleting(false);
    }
  };

  // Manual add member to VIP group
  const handleAddMember = async () => {
    const targetGroup = selectedGroup || null;
    if (!addName.trim()) { toast.error('Name is required'); return; }
    if (!targetGroup) { toast.error('Select a VIP group first'); return; }
    setAddingMember(true);
    try {
      const saName = user?.name || 'Unknown';
      const today = format(new Date(), 'yyyy-MM-dd');
      const { error } = await supabase.from('intros_booked').insert({
        member_name: addName.trim(),
        class_date: today,
        coach_name: 'TBD',
        sa_working_shift: saName,
        lead_source: 'VIP Class',
        booked_by: saName,
        phone: addPhone.trim() || null,
        email: addEmail.trim().toLowerCase() || null,
        is_vip: true,
        booking_type_canon: 'VIP',
        booking_status: 'Active',
        booking_status_canon: 'ACTIVE',
        vip_class_name: targetGroup,
      });
      if (error) throw error;
      toast.success(`${addName.trim()} added to ${targetGroup}`);
      setAddName('');
      setAddPhone('');
      setAddEmail('');
      setShowAddMember(false);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  // Save referring member for a group
  const handleSaveReferrer = async (groupName: string) => {
    const meta = groupMetas.find(g => g.vip_class_name === groupName);
    if (meta) {
      await supabase.from('vip_sessions').update({ referring_member_name: referrerDraft.trim() || null } as any).eq('id', meta.id);
    } else {
      // Create session entry
      await supabase.from('vip_sessions').insert({ vip_class_name: groupName, referring_member_name: referrerDraft.trim() || null } as any);
    }
    toast.success('Referral member updated');
    setEditingReferrer(null);
    fetchData();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    setDeletingGroup(true);
    try {
      const now = new Date().toISOString();
      // Archive the group's sessions — match by reserved_by_group (user-facing name) OR vip_class_name
      const r1 = await (supabase as any)
        .from('vip_sessions')
        .update({ archived_at: now })
        .eq('reserved_by_group', selectedGroup)
        .select('id');
      const r2 = await (supabase as any)
        .from('vip_sessions')
        .update({ archived_at: now })
        .eq('vip_class_name', selectedGroup)
        .select('id');

      const updatedCount = (r1.data?.length || 0) + (r2.data?.length || 0);

      // If no vip_sessions row existed for this group, insert a placeholder so it stays archived
      if (updatedCount === 0) {
        await (supabase as any)
          .from('vip_sessions')
          .insert({
            vip_class_name: selectedGroup,
            reserved_by_group: selectedGroup,
            session_date: new Date().toISOString().split('T')[0],
            session_time: '09:00',
            status: 'completed',
            archived_at: now,
          });
      }

      toast.success(`"${selectedGroup}" archived. Client data preserved.`);
      setShowDeleteGroup(false);
      setSelectedGroup('');
      fetchData();
    } catch (err) {
      console.error('Archive group error:', err);
      toast.error('Failed to archive group');
    } finally {
      setDeletingGroup(false);
    }
  };

  const handleUnarchiveGroup = async (groupName: string) => {
    try {
      await (supabase as any)
        .from('vip_sessions')
        .update({ archived_at: null })
        .eq('reserved_by_group', groupName);
      await (supabase as any)
        .from('vip_sessions')
        .update({ archived_at: null })
        .eq('vip_class_name', groupName);
      toast.success(`"${groupName}" restored`);
      fetchData();
    } catch (err) {
      toast.error('Failed to restore group');
    }
  };

  const allSelected = filtered.length > 0 && selectedRows.size === filtered.length;

  return (
    <div className="space-y-3">
      {/* Group Selector + Create Group */}
      <div className="flex gap-2 items-center flex-wrap">
        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
          <SelectTrigger className="w-[220px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[300px] overflow-y-auto">
            {groups
              .filter(g => showArchived || !archivedGroups.has(g))
              .map(g => (
                <SelectItem key={g} value={g}>
                  {archivedGroups.has(g) ? '📦 ' : ''}{g} ({groupCounts.get(g) || 0})
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        {selectedGroup !== 'All' && !archivedGroups.has(selectedGroup) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[10px] gap-1"
            onClick={(e) => copyGroupLink(selectedGroup, e)}
            title={`Copy link for ${selectedGroup}`}
          >
            <Link2 className="w-3 h-3" /> Copy Link
          </Button>
        )}

        {selectedGroup && selectedGroup !== 'All' && !archivedGroups.has(selectedGroup) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => setShowDeleteGroup(true)}
            title={`Archive group ${selectedGroup}`}
          >
            <Archive className="w-3 h-3" /> Archive
          </Button>
        )}

        {selectedGroup && archivedGroups.has(selectedGroup) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[10px] gap-1 text-primary"
            onClick={() => handleUnarchiveGroup(selectedGroup)}
          >
            <RotateCcw className="w-3 h-3" /> Restore
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 rounded-full"
          onClick={() => setShowCreateGroup(true)}
        >
          <Plus className="w-3 h-3" /> New Group
        </Button>
        {archivedGroups.size > 0 && (
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer ml-auto">
            <Checkbox
              checked={showArchived}
              onCheckedChange={(v) => setShowArchived(!!v)}
              className="h-3.5 w-3.5"
            />
            Show archived ({archivedGroups.size})
          </label>
        )}
      </div>

      {/* Registration Link Banner + Referring Member */}
      {regLink && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-accent border border-border flex-wrap">
            <Star className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span className="text-xs font-semibold text-primary">{selectedGroup}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">·</span>
            <code className="text-[10px] text-muted-foreground truncate flex-1 min-w-0 hidden sm:block">{regLink}</code>
            <div className="flex gap-1 flex-shrink-0 ml-auto">
              <Button
                variant="ghost" size="sm"
                className="h-6 px-2 text-[10px] gap-1 text-primary"
                onClick={() => { navigator.clipboard.writeText(regLink!); toast.success('Link copied!'); }}
              >
                <Copy className="w-3 h-3" /> Copy
              </Button>
              <Button
                variant="ghost" size="sm"
                className="h-6 px-2 text-[10px] gap-1 text-primary"
                onClick={() => {
                  const msg = `Register for your Orangetheory Fitness VIP class here: ${regLink}`;
                  navigator.clipboard.writeText(msg);
                  toast.success('Share message copied!');
                }}
              >
                <Share2 className="w-3 h-3" /> Share
              </Button>
            </div>
          </div>

          {/* Referring Member inline edit */}
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs">
            <span className="text-muted-foreground font-medium">Referral Member:</span>
            {editingReferrer === selectedGroup ? (
              <div className="flex items-center gap-1">
                <Input
                  value={referrerDraft}
                  onChange={e => setReferrerDraft(e.target.value)}
                  className="h-6 text-xs w-40"
                  placeholder="Member name…"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSaveReferrer(selectedGroup)}
                />
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleSaveReferrer(selectedGroup)}>
                  <Check className="w-3 h-3 text-success" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditingReferrer(null)}>
                  <X className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            ) : (
              <button
                className="flex items-center gap-1 hover:text-primary transition-colors"
                onClick={() => {
                  setEditingReferrer(selectedGroup);
                  setReferrerDraft(selectedGroupMeta?.referring_member_name || '');
                }}
              >
                <span className={selectedGroupMeta?.referring_member_name ? 'font-medium' : 'text-muted-foreground italic'}>
                  {selectedGroupMeta?.referring_member_name || 'Not assigned'}
                </span>
                <Edit2 className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search name, phone, email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-7 h-8 text-xs"
          />
        </div>
        {selectedGroup !== 'All' && (
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setShowAddMember(true)}>
            <UserPlus className="w-3.5 h-3.5" /> Add Member
          </Button>
        )}
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleExportCsv}>
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
      </div>

      {/* Bulk Action Bar */}
      {selectedRows.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/10 border border-primary/30">
          <span className="text-xs font-medium">{selectedRows.size} selected</span>
          <Button
            size="sm" className="h-7 text-xs gap-1 ml-auto"
            onClick={() => setShowBulkDialog(true)}
          >
            <CalendarPlus className="w-3.5 h-3.5" /> Assign to Session
          </Button>
          <Button
            variant="destructive" size="sm" className="h-7 text-xs gap-1"
            onClick={() => setShowBulkDelete(true)}
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete Selected
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedRows(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 w-8">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={selectAll}
                  className="h-3.5 w-3.5"
                />
              </th>
              <th className="p-2 text-left cursor-pointer hover:text-primary select-none min-w-[130px]" onClick={() => handleSort('memberName')}>
                <div className="flex items-center gap-1">Name <SortIcon col="memberName" /></div>
              </th>
              {selectedGroup === 'All' && (
                <th className="p-2 text-left cursor-pointer hover:text-primary select-none min-w-[110px]" onClick={() => handleSort('groupName')}>
                  <div className="flex items-center gap-1">Group <SortIcon col="groupName" /></div>
                </th>
              )}
              <th className="p-2 text-left cursor-pointer hover:text-primary select-none min-w-[110px]" onClick={() => handleSort('phone')}>
                <div className="flex items-center gap-1">Phone <SortIcon col="phone" /></div>
              </th>
              <th className="p-2 text-left cursor-pointer hover:text-primary select-none min-w-[150px]" onClick={() => handleSort('email')}>
                <div className="flex items-center gap-1">Email <SortIcon col="email" /></div>
              </th>
              <th className="p-2 text-left cursor-pointer hover:text-primary select-none min-w-[90px]" onClick={() => handleSort('birthday')}>
                <div className="flex items-center gap-1">Birthday <SortIcon col="birthday" /></div>
              </th>
              <th className="p-2 text-left cursor-pointer hover:text-primary select-none min-w-[70px]" onClick={() => handleSort('weight')}>
                <div className="flex items-center gap-1">Weight <SortIcon col="weight" /></div>
              </th>
              <th className="p-2 text-left cursor-pointer hover:text-primary select-none min-w-[130px]" onClick={() => handleSort('session')}>
                <div className="flex items-center gap-1">Session <SortIcon col="session" /></div>
              </th>
              <th className="p-2 text-left cursor-pointer hover:text-primary select-none min-w-[90px]" onClick={() => handleSort('status')}>
                <div className="flex items-center gap-1">Status <SortIcon col="status" /></div>
              </th>
              <th className="p-2 text-left min-w-[150px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="py-8 text-center text-muted-foreground">
                  No VIP members found
                </td>
              </tr>
            )}
            {filtered.map((row, idx) => {
              const phone = displayPhone(row);
              const email = displayEmail(row);
              const isExpanded = expandedRows.has(row.bookingId);
              const isSelected = selectedRows.has(row.bookingId);
              return (
                <>
                  <tr
                    key={row.bookingId}
                    className={`border-t transition-colors cursor-pointer ${
                      isSelected ? 'bg-primary/5' : idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                    } hover:bg-muted/40`}
                    onClick={() => toggleRow(row.bookingId)}
                  >
                    <td className="p-2" onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(row.bookingId)}
                        className="h-3.5 w-3.5"
                      />
                    </td>
                    <td className="p-2 font-medium">{row.memberName}</td>
                    {selectedGroup === 'All' && (
                      <td className="p-2">
                        <Badge variant="secondary" className="text-[10px] px-1.5 h-4 bg-accent text-accent-foreground">
                          {row.groupName}
                        </Badge>
                      </td>
                    )}
                    <td className="p-2 tabular-nums">
                      {phone ? (
                        <span className="text-foreground">{phone}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-2 max-w-[160px] truncate">
                      {email ? (
                        <span className="text-foreground truncate block">{email}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-2">
                      {row.birthday ? fmtDate(row.birthday) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-2">
                      {row.weightLbs ? `${row.weightLbs} lbs` : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-2">
                      {row.sessionDate && row.sessionDate !== new Date().toISOString().split('T')[0] || row.vipSessionId ? (
                        <span className="text-foreground">{sessionLabel(row)}</span>
                      ) : (
                        <span className="text-warning font-medium">Unscheduled</span>
                      )}
                    </td>
                    <td className="p-2">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-1.5 h-4 ${
                          row.bookingStatus === 'Active' ? 'bg-success/20 text-success' :
                          row.bookingStatus === 'Unscheduled' ? 'bg-warning/20 text-warning' :
                          'bg-muted text-muted-foreground'
                        }`}
                      >
                        {row.bookingStatus || 'Unscheduled'}
                      </Badge>
                    </td>
                    <td className="p-2" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost" size="sm"
                          className="h-6 px-1.5 text-[10px] gap-0.5 text-primary"
                          title="Book Intro"
                          onClick={() => setConvertRow(row)}
                        >
                          <ArrowRight className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="h-6 px-1.5 text-[10px] gap-0.5"
                          title="Open Script"
                          onClick={() => { setScriptRow(row); setScriptSheetOpen(true); }}
                        >
                          <MessageSquare className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="h-6 px-1.5 text-[10px] gap-0.5"
                          title="Copy phone"
                          onClick={() => handleCopyPhone(row)}
                          disabled={!phone}
                        >
                          <Phone className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="h-6 px-1.5 text-[10px] gap-0.5"
                          title="Assign session"
                          onClick={() => { setAssignRow(row); setAssignDate(''); setAssignTime(''); }}
                        >
                          <CalendarPlus className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="h-6 px-1.5 text-[10px] gap-0.5 text-destructive hover:text-destructive"
                          title="Remove from VIP list"
                          onClick={() => setDeleteTarget(row)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {/* Expanded row */}
                  {isExpanded && (
                    <tr key={`${row.bookingId}-expanded`} className="border-t bg-muted/30">
                      <td colSpan={selectedGroup === 'All' ? 10 : 9} className="px-4 py-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <p className="text-muted-foreground mb-0.5 flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</p>
                            <p className="font-medium">{phone || '—'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-0.5 flex items-center gap-1"><Mail className="w-3 h-3" /> Email</p>
                            <p className="font-medium break-all">{email || '—'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-0.5">🎂 Birthday</p>
                            <p className="font-medium">{row.birthday ? fmtDate(row.birthday) : '—'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-0.5">⚖️ Weight</p>
                            <p className="font-medium">{row.weightLbs ? `${row.weightLbs} lbs` : '—'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-0.5">Session</p>
                            <p className="font-medium">{sessionLabel(row)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-0.5">Status</p>
                            <p className="font-medium">{row.bookingStatus || 'Unscheduled'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-0.5">Group</p>
                            <p className="font-medium">{row.groupName}</p>
                          </div>
                          <div className="flex items-end gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              className="h-6 text-[10px] gap-1"
                              onClick={() => setConvertRow(row)}
                            >
                              <ArrowRight className="w-3 h-3" /> Book Intro
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[10px] gap-1"
                              onClick={() => { setAssignRow(row); setAssignDate(''); setAssignTime(''); }}
                            >
                              <CalendarPlus className="w-3 h-3" /> Assign Session
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Convert to Intro Dialog */}
      {convertRow && (
        <ConvertVipToIntroDialog
          open={!!convertRow}
          onOpenChange={open => { if (!open) setConvertRow(null); }}
          vipBooking={{
            id: convertRow.bookingId,
            member_name: convertRow.memberName,
            phone: displayPhone(convertRow),
            email: displayEmail(convertRow),
          }}
          referredByMember={
            groupMetas.find(g => g.vip_class_name === convertRow.groupName)?.referring_member_name || null
          }
          onConverted={fetchData}
        />
      )}

      {/* Manual Add Member Dialog */}
      <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Add Member to {selectedGroup}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Name *</Label>
              <Input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Full name" className="h-8 text-sm" autoFocus />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone (optional)</Label>
              <Input value={addPhone} onChange={e => setAddPhone(e.target.value)} placeholder="(205) 555-1234" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email (optional)</Label>
              <Input value={addEmail} onChange={e => setAddEmail(e.target.value)} placeholder="email@example.com" className="h-8 text-sm" />
            </div>
            <Button
              className="w-full h-8 text-sm"
              disabled={!addName.trim() || addingMember}
              onClick={handleAddMember}
            >
              {addingMember ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <UserPlus className="w-3.5 h-3.5 mr-1" />}
              Add to {selectedGroup}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Single Assign Dialog */}
      <Dialog open={!!assignRow} onOpenChange={open => !open && setAssignRow(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Assign Session — {assignRow?.memberName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={assignDate} onChange={e => setAssignDate(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Time (optional)</Label>
              <ClassTimeSelect value={assignTime} onValueChange={setAssignTime} triggerClassName="h-8 text-sm" />
            </div>
            <Button
              className="w-full h-8 text-sm"
              disabled={!assignDate || assigning}
              onClick={handleAssignSingle}
            >
              {assigning ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Assign
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Assign {selectedRows.size} Members to Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Time (optional)</Label>
              <ClassTimeSelect value={bulkTime} onValueChange={setBulkTime} triggerClassName="h-8 text-sm" />
            </div>
            <Button
              className="w-full h-8 text-sm"
              disabled={!bulkDate || bulkAssigning}
              onClick={handleBulkAssign}
            >
              {bulkAssigning ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Apply to All Selected
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Script Picker Sheet */}
      {scriptRow && (
        <ScriptPickerSheet
          open={scriptSheetOpen}
          onOpenChange={open => { setScriptSheetOpen(open); if (!open) setScriptRow(null); }}
          suggestedCategories={['follow_up', 'confirmation']}
          mergeContext={{
            'first-name': scriptRow.memberName.split(' ')[0],
            'last-name': scriptRow.memberName.split(' ').slice(1).join(' '),
          }}
          bookingId={scriptRow.bookingId}
        />
      )}

      {/* Create Group Sheet */}
      <Sheet open={showCreateGroup} onOpenChange={setShowCreateGroup}>
        <SheetContent side="right" className="max-w-sm">
          <SheetHeader>
            <SheetTitle className="text-base">Create New VIP Group</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Group Name *</Label>
              <Input
                placeholder="e.g. PhiPsi, Miss Alabama…"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                className="h-10"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description (optional)</Label>
              <Textarea
                placeholder="e.g. Spring 2025 VIP class"
                value={newGroupDesc}
                onChange={e => setNewGroupDesc(e.target.value)}
                className="h-20 text-sm"
              />
            </div>
            {newGroupName.trim() && (
              <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
                <p className="font-semibold text-muted-foreground">Registration link preview:</p>
                <code className="text-primary break-all">
                  https://otf-tuscaloosa.lovable.app/vip-register?class={encodeURIComponent(newGroupName.trim())}
                </code>
                <p className="text-muted-foreground">Link will be copied to clipboard on save.</p>
              </div>
            )}
            <Button
              className="w-full"
              disabled={!newGroupName.trim() || creatingGroup}
              onClick={handleCreateGroup}
            >
              {creatingGroup ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Group & Copy Link
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Single Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTarget?.memberName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove them from the VIP list. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={() => deleteTarget && handleDeleteSingle(deleteTarget)}
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {selectedRows.size} member(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the selected members from the VIP list. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkDeleting}
              onClick={handleBulkDelete}
            >
              {bulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Remove All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Group Confirmation */}
      <AlertDialog open={showDeleteGroup} onOpenChange={setShowDeleteGroup}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive "{selectedGroup}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will hide the group from the dropdown. All client bookings and registration data will be preserved. You can restore it anytime using "Show archived".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingGroup}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingGroup}
              onClick={handleDeleteGroup}
            >
              {deletingGroup ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
