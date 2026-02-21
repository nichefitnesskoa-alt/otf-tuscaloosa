/**
 * VipPipelineTable — spreadsheet-style VIP member table for the Pipeline VIP tab.
 * Fetches vip_registrations directly so phone/email are always from the registration source.
 * Includes group creation, link generator, and copy-link per group pill.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Star, Search, Download, Copy, ChevronUp, ChevronDown, Loader2,
  Phone, Mail, CalendarPlus, Share2, MessageSquare, Plus, Link2, Trash2,
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

// ── Types ────────────────────────────────────────────────────────────────────

interface VipRow {
  bookingId: string;
  memberName: string;
  groupName: string;
  // registration data (preferred)
  regPhone: string | null;
  regEmail: string | null;
  birthday: string | null;
  weightLbs: number | null;
  // booking data (fallback)
  bookingPhone: string | null;
  bookingEmail: string | null;
  sessionDate: string | null;
  sessionTime: string | null;
  bookingStatus: string | null;
  vipSessionId: string | null;
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
  const [rows, setRows] = useState<VipRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [groups, setGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
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

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch all VIP bookings
      const { data: bookings, error: bErr } = await supabase
        .from('intros_booked')
        .select('id, member_name, vip_class_name, class_date, intro_time, booking_status, vip_session_id, phone, email')
        .eq('lead_source', 'VIP Class')
        .is('deleted_at', null)
        .not('vip_class_name', 'is', null);

      if (bErr) throw bErr;

      // Fetch all VIP registrations
      const { data: regs, error: rErr } = await supabase
        .from('vip_registrations')
        .select('booking_id, phone, email, birthday, weight_lbs, vip_class_name');

      if (rErr) throw rErr;

      // Build reg map by booking_id
      const regMap = new Map<string, { phone: string | null; email: string | null; birthday: string | null; weight_lbs: number | null }>();
      (regs || []).forEach((r: any) => {
        if (r.booking_id) regMap.set(r.booking_id, r);
      });

      // Also try matching by vip_class_name + name if no booking_id match
      const regByName = new Map<string, { phone: string | null; email: string | null; birthday: string | null; weight_lbs: number | null }>();
      (regs || []).forEach((r: any) => {
        if (!r.booking_id && r.vip_class_name) {
          const key = `${r.vip_class_name}::${(r.first_name || '') + (r.last_name || '')}`.toLowerCase();
          regByName.set(key, r);
        }
      });

      const builtRows: VipRow[] = (bookings || []).map((b: any) => {
        const reg = regMap.get(b.id);
        return {
          bookingId: b.id,
          memberName: b.member_name,
          groupName: b.vip_class_name || 'Unknown',
          regPhone: reg?.phone || null,
          regEmail: reg?.email || null,
          birthday: reg?.birthday || null,
          weightLbs: reg?.weight_lbs || null,
          bookingPhone: b.phone,
          bookingEmail: b.email,
          sessionDate: b.class_date,
          sessionTime: b.intro_time,
          bookingStatus: b.booking_status,
          vipSessionId: b.vip_session_id,
        } as VipRow;
      });

      setRows(builtRows);

      // Extract unique group names
      const uniqueGroups = Array.from(new Set(builtRows.map(r => r.groupName))).sort();
      setGroups(uniqueGroups);
    } catch (err) {
      console.error('VIP fetch error:', err);
      toast.error('Failed to load VIP data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = rows;

    // Group filter
    if (selectedGroup !== 'All') {
      result = result.filter(r => r.groupName === selectedGroup);
    }

    // Search filter
    if (search.trim().length >= 1) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.memberName.toLowerCase().includes(q) ||
        (displayPhone(r) || '').includes(q) ||
        (displayEmail(r) || '').toLowerCase().includes(q)
      );
    }

    // Sort
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

  const regLink = selectedGroup !== 'All'
    ? `https://otf-tuscaloosa.lovable.app/vip-register?class=${encodeURIComponent(selectedGroup)}`
    : null;

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
      setSelectedRows(new Set(filtered.map(r => r.bookingId)));
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
      const ids = Array.from(selectedRows);
      await supabase
        .from('intros_booked')
        .update({ class_date: bulkDate, intro_time: bulkTime || null, booking_status: 'Active' } as any)
        .in('id', ids);
      toast.success(`Assigned ${ids.length} member(s) to ${fmtDate(bulkDate)}`);
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
      // Create a placeholder booking to anchor the group, so it shows up in the selector
      // Groups are derived from vip_class_name on bookings — we just need to ensure the group
      // shows in the pill list. We add it to the local group list directly.
      const slug = newGroupName.trim();
      setGroups(prev => Array.from(new Set([...prev, slug])).sort());
      setSelectedGroup(slug);
      setShowCreateGroup(false);
      setNewGroupName('');
      setNewGroupDesc('');
      const link = `https://otf-tuscaloosa.lovable.app/vip-register?class=${encodeURIComponent(slug)}`;
      navigator.clipboard.writeText(link);
      toast.success(`Group "${slug}" created! Registration link copied to clipboard.`);
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
      await supabase
        .from('intros_booked')
        .update({ deleted_at: new Date().toISOString(), deleted_by: 'staff' } as any)
        .eq('id', row.bookingId);
      await supabase
        .from('vip_registrations')
        .delete()
        .eq('booking_id', row.bookingId);
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
      const ids = Array.from(selectedRows);
      await supabase
        .from('intros_booked')
        .update({ deleted_at: new Date().toISOString(), deleted_by: 'staff' } as any)
        .in('id', ids);
      await supabase
        .from('vip_registrations')
        .delete()
        .in('booking_id', ids);
      const count = ids.length;
      toast.success(`${count} member(s) removed from VIP list`);
      setSelectedRows(new Set());
      setShowBulkDelete(false);
      fetchData();
    } catch (err) {
      toast.error('Failed to delete members');
    } finally {
      setBulkDeleting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const allSelected = filtered.length > 0 && selectedRows.size === filtered.length;

  return (
    <div className="space-y-3">
      {/* Group Selector + Create Group */}
      <div className="flex gap-2 flex-wrap items-center">
        {/* All pill */}
        <button
          onClick={() => setSelectedGroup('All')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            selectedGroup === 'All'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          All ({rows.length})
        </button>

        {/* Group pills with inline Copy Link */}
        {groups.map(g => (
          <div key={g} className={`flex items-center gap-0 rounded-full overflow-hidden border transition-colors ${
            selectedGroup === g ? 'border-primary' : 'border-muted'
          }`}>
            <button
              onClick={() => setSelectedGroup(g)}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                selectedGroup === g
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {g} ({groupCounts.get(g) || 0})
            </button>
            <button
              onClick={(e) => copyGroupLink(g, e)}
              className={`px-2 py-1 text-[10px] transition-colors flex items-center gap-0.5 ${
                selectedGroup === g
                  ? 'bg-primary/80 text-primary-foreground hover:bg-primary/70'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
              title={`Copy link for ${g}`}
            >
              <Link2 className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}

        {/* Create New Group button */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 rounded-full"
          onClick={() => setShowCreateGroup(true)}
        >
          <Plus className="w-3 h-3" /> New Group
        </Button>
      </div>

      {/* Registration Link Banner */}
      {regLink && (
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
              <th className="p-2 text-left min-w-[120px]">Actions</th>
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
                              variant="outline"
                              className="h-6 text-[10px] gap-1"
                              onClick={() => { setAssignRow(row); setAssignDate(''); setAssignTime(''); }}
                            >
                              <CalendarPlus className="w-3 h-3" /> Assign Session
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-6 text-[10px] gap-1"
                              onClick={() => setDeleteTarget(row)}
                            >
                              <Trash2 className="w-3 h-3" /> Remove from VIP List
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
              <Input type="time" value={assignTime} onChange={e => setAssignTime(e.target.value)} className="h-8 text-sm" />
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
              <Input type="time" value={bulkTime} onChange={e => setBulkTime(e.target.value)} className="h-8 text-sm" />
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
    </div>
  );
}
