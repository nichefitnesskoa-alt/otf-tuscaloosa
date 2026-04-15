/**
 * VIP Scheduler Tab — manage available VIP session slots.
 * Staff can add slots, cancel, reset, mark reserved, copy the public link, view registrations,
 * log attendance, book intros from VIP sessions, and manage recurring slot templates.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  CalendarPlus, Copy, Eye, XCircle, RotateCcw, Loader2, Users, BookmarkCheck, Clock, Trash2, Download, Pencil, Check, CalendarCheck,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { formatDisplayTime } from '@/lib/time/timeUtils';
import { ALL_STAFF, COACHES, SALES_ASSOCIATES } from '@/types';
import { ClassTimeSelect, DatePickerField, formatPhoneAsYouType, autoCapitalizeName } from '@/components/shared/FormHelpers';
import { NameAutocomplete } from '@/components/shared/NameAutocomplete';

const sb = supabase as any;

interface VipSession {
  id: string;
  vip_class_name: string;
  session_date: string;
  session_time: string;
  status: string;
  reserved_by_group: string | null;
  description: string | null;
  is_on_availability_page: boolean;
  shareable_slug: string | null;
  created_by: string;
  reserved_contact_name: string | null;
  reserved_contact_email: string | null;
  reserved_contact_phone: string | null;
  estimated_group_size: number | null;
  created_at: string;
  actual_attendance: number | null;
  attendance_logged_by: string | null;
  attendance_logged_at: string | null;
  session_type: string | null;
  business_sub_type: string | null;
}

function getSessionTypeLabel(s: VipSession): string | null {
  if (!s.session_type) return null;
  if (s.session_type === 'exclusive') return 'Social Group / Organization';
  if (s.session_type === 'business_staff') {
    if (s.business_sub_type === 'staff_only') return 'Business — Staff Only';
    if (s.business_sub_type === 'staff_customers') return 'Business — Staff + Customers';
    if (s.business_sub_type === 'staff_members') return 'Business — Staff + OTF Members';
    return 'Business';
  }
  if (s.session_type === 'business_customers') return 'Business — Staff + Customers';
  if (s.session_type === 'open') return 'Business — Staff + OTF Members';
  return s.session_type;
}

interface VipRegistration {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  fitness_level: number | null;
  injuries: string | null;
  birthday: string | null;
  weight_lbs: number | null;
  is_group_contact: boolean;
  created_at: string;
}

interface SlotTemplate {
  id: string;
  day_of_week: number;
  slot_time: string;
  is_active: boolean;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function generateSlug(date: string, time: string): string {
  const d = new Date(date + 'T00:00:00');
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const month = monthNames[d.getMonth()];
  const day = d.getDate();
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const min = m || '00';
  const ampm = hour >= 12 ? 'pm' : 'am';
  const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `vip-${month}${day}-${h12}${min !== '00' ? min : ''}${ampm}`;
}

function StatusBadge({ status, group }: { status: string; group: string | null }) {
  if (status === 'open') return <Badge className="bg-green-600 text-white border-transparent text-xs">Open</Badge>;
  if (status === 'reserved') return <Badge className="bg-amber-500 text-white border-transparent text-xs">Reserved — {group}</Badge>;
  if (status === 'cancelled') return <Badge className="bg-red-600 text-white border-transparent text-xs">Cancelled</Badge>;
  return <Badge variant="secondary" className="text-xs">{status}</Badge>;
}

export function VipSchedulerTab() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<VipSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [regOpen, setRegOpen] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<VipRegistration[]>([]);
  const [regLoading, setRegLoading] = useState(false);
  const [regCounts, setRegCounts] = useState<Record<string, number>>({});

  // Add slot form state
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPublic, setNewPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  // Mark Reserved inline form
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markGroupName, setMarkGroupName] = useState('');
  const [markSaving, setMarkSaving] = useState(false);

  // Delete confirmation
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // QR download
  const [qrSession, setQrSession] = useState<VipSession | null>(null);

  // Attendance
  const [attendanceId, setAttendanceId] = useState<string | null>(null);
  const [attendanceValue, setAttendanceValue] = useState('');
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceSaved, setAttendanceSaved] = useState<string | null>(null);

  // Book Intro from VIP
  const [bookFromVip, setBookFromVip] = useState<VipSession | null>(null);
  const [bookForm, setBookForm] = useState({ firstName: '', lastName: '', phone: '', classDate: '', classTime: '', coach: '', sa: '' });
  const [bookSaving, setBookSaving] = useState(false);

  // Performance data for registrations dialog
  const [perfData, setPerfData] = useState<{ introsBooked: number; introsRan: number; joins: number } | null>(null);

  // Templates
  const [templates, setTemplates] = useState<SlotTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const { data } = await sb
      .from('vip_sessions')
      .select('*')
      .is('archived_at', null)
      .order('session_date', { ascending: true })
      .order('session_time', { ascending: true });
    setSessions((data as any[]) || []);

    const counts: Record<string, number> = {};
    if (data && data.length > 0) {
      const ids = data.map((s: any) => s.id);
      const { data: regs } = await sb
        .from('vip_registrations')
        .select('vip_session_id')
        .in('vip_session_id', ids)
        .eq('is_group_contact', false);
      for (const r of (regs || [])) {
        counts[(r as any).vip_session_id] = (counts[(r as any).vip_session_id] || 0) + 1;
      }
    }
    setRegCounts(counts);
    setLoading(false);
  }, []);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    const { data } = await sb
      .from('vip_slot_templates')
      .select('*')
      .order('day_of_week', { ascending: true })
      .order('slot_time', { ascending: true });
    setTemplates((data as any[]) || []);
    setTemplatesLoading(false);
  }, []);

  useEffect(() => { fetchSessions(); fetchTemplates(); }, [fetchSessions, fetchTemplates]);

  const handleAddSlot = async () => {
    if (!newDate || !newTime) { toast.error('Date and time are required'); return; }
    setSaving(true);
    try {
      const slug = generateSlug(newDate, newTime);
      const { error } = await sb.from('vip_sessions').insert({
        vip_class_name: `VIP ${format(new Date(newDate + 'T00:00:00'), 'MMM d')}`,
        session_date: newDate,
        session_time: newTime,
        status: 'open',
        description: newDesc || null,
        is_on_availability_page: newPublic,
        shareable_slug: slug,
        created_by: user?.name || 'Admin',
      } as any);
      if (error) throw error;
      toast.success('Slot added');
      setAddOpen(false);
      setNewDate(''); setNewTime(''); setNewDesc(''); setNewPublic(true);
      fetchSessions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add slot');
    } finally { setSaving(false); }
  };

  const handleCancel = async (id: string) => {
    await sb.from('vip_sessions').update({ status: 'cancelled' } as any).eq('id', id);
    toast.success('Slot cancelled');
    fetchSessions();
  };

  const handleReopen = async (id: string) => {
    await sb.from('vip_sessions').update({
      status: 'open',
      reserved_by_group: null,
      reserved_contact_name: null,
      reserved_contact_email: null,
      reserved_contact_phone: null,
      estimated_group_size: null,
    } as any).eq('id', id);
    toast.success('Slot reopened');
    fetchSessions();
  };

  const handleMarkReserved = async (id: string) => {
    if (!markGroupName.trim()) { toast.error('Group name is required'); return; }
    setMarkSaving(true);
    try {
      await sb.from('vip_sessions').update({
        status: 'reserved',
        reserved_by_group: markGroupName.trim(),
      } as any).eq('id', id);
      toast.success('Slot marked as reserved');
      setMarkingId(null);
      setMarkGroupName('');
      fetchSessions();
    } catch (err: any) {
      toast.error('Failed to mark reserved');
    } finally { setMarkSaving(false); }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText('https://otf-tuscaloosa.lovable.app/vip-availability');
    toast.success('Availability link copied');
  };

  const handleViewRegistrations = async (sessionId: string) => {
    setRegOpen(sessionId);
    setRegLoading(true);
    setPerfData(null);
    const [{ data: regData }, { data: bookings }] = await Promise.all([
      sb.from('vip_registrations')
        .select('id, first_name, last_name, email, phone, fitness_level, injuries, birthday, weight_lbs, is_group_contact, created_at')
        .eq('vip_session_id', sessionId)
        .order('is_group_contact', { ascending: false })
        .order('created_at', { ascending: true }),
      sb.from('intros_booked')
        .select('id, booking_status_canon')
        .eq('vip_session_id', sessionId),
    ]);
    setRegistrations((regData as any[]) || []);

    // Performance metrics
    const sessionBookings = (bookings as any[]) || [];
    const introsBooked = sessionBookings.length;
    const introsRan = sessionBookings.filter((b: any) => b.booking_status_canon === 'SHOWED').length;
    let joins = 0;
    if (sessionBookings.length > 0) {
      const bIds = sessionBookings.map((b: any) => b.id);
      const { data: runs } = await sb.from('intros_run').select('linked_intro_booked_id, result_canon').in('linked_intro_booked_id', bIds);
      const saleBookings = new Set<string>();
      for (const r of (runs || [])) {
        if (r.result_canon === 'SALE' && r.linked_intro_booked_id) saleBookings.add(r.linked_intro_booked_id);
      }
      joins = saleBookings.size;
    }
    setPerfData({ introsBooked, introsRan, joins });
    setRegLoading(false);
  };

  const handleSaveAttendance = async (sessionId: string) => {
    const val = parseInt(attendanceValue);
    if (isNaN(val) || val < 0) { toast.error('Enter a valid number'); return; }
    setAttendanceSaving(true);
    try {
      await sb.from('vip_sessions').update({
        actual_attendance: val,
        attendance_logged_by: user?.name || 'Staff',
        attendance_logged_at: new Date().toISOString(),
      } as any).eq('id', sessionId);
      setAttendanceSaved(sessionId);
      setTimeout(() => setAttendanceSaved(null), 2000);
      setAttendanceId(null);
      setAttendanceValue('');
      fetchSessions();
    } catch {
      toast.error('Failed to save attendance');
    } finally { setAttendanceSaving(false); }
  };

  const handleToggleTemplate = async (id: string, currentActive: boolean) => {
    await sb.from('vip_slot_templates').update({ is_active: !currentActive } as any).eq('id', id);
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, is_active: !currentActive } : t));
    toast.success(!currentActive ? 'Template activated' : 'Template paused');
  };

  const handleDeleteSession = async () => {
    if (!deleteSessionId) return;
    setDeleting(true);
    try {
      await sb.from('vip_registrations').delete().eq('vip_session_id', deleteSessionId);
      const { error } = await sb.from('vip_sessions').delete().eq('id', deleteSessionId);
      if (error) throw error;
      toast.success('Session permanently deleted');
      setDeleteSessionId(null);
      fetchSessions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete session');
    } finally { setDeleting(false); }
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateId) return;
    setDeleting(true);
    try {
      const { error } = await sb.from('vip_slot_templates').delete().eq('id', deleteTemplateId);
      if (error) throw error;
      toast.success('Template permanently deleted');
      setDeleteTemplateId(null);
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete template');
    } finally { setDeleting(false); }
  };

  const handleBookFromVip = async () => {
    if (!bookFromVip) return;
    if (!bookForm.firstName.trim()) { toast.error('First name is required'); return; }
    if (!bookForm.lastName.trim()) { toast.error('Last name is required'); return; }
    if (!bookForm.classDate) { toast.error('Class date is required'); return; }
    if (!bookForm.coach) { toast.error('Coach is required'); return; }
    setBookSaving(true);
    try {
      const memberName = `${bookForm.firstName.trim()} ${bookForm.lastName.trim()}`;
      const h = new Date().getHours();
      const shiftLabel = h < 11 ? 'AM Shift' : h < 16 ? 'Mid Shift' : 'PM Shift';
      const classStartAt = bookForm.classTime ? `${bookForm.classDate}T${bookForm.classTime}:00` : null;

      const { error } = await supabase.from('intros_booked').insert({
        member_name: memberName,
        class_date: bookForm.classDate,
        intro_time: bookForm.classTime || null,
        class_start_at: classStartAt,
        coach_name: bookForm.coach,
        lead_source: 'VIP Class',
        sa_working_shift: bookForm.sa || shiftLabel,
        booked_by: bookForm.sa || user?.name || '',
        intro_owner: bookForm.sa || user?.name || null,
        intro_owner_locked: false,
        phone: bookForm.phone.trim() || null,
        booking_type_canon: 'STANDARD',
        booking_status_canon: 'ACTIVE',
        questionnaire_status_canon: 'not_sent',
        is_vip: false,
        vip_session_id: bookFromVip.id,
      });
      if (error) throw error;
      toast.success(`${memberName} booked from VIP class`);
      setBookFromVip(null);
      setBookForm({ firstName: '', lastName: '', phone: '', classDate: '', classTime: '', coach: '', sa: '' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to book intro');
    } finally { setBookSaving(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">VIP Session Scheduler</h2>
          <p className="text-xs text-muted-foreground">Manage available slots for private group classes · <span className="font-medium">Max class size: 36</span></p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 text-xs gap-1" onClick={handleCopyLink}>
            <Copy className="w-3.5 h-3.5" /> Copy Availability Link
          </Button>
          <Button size="sm" className="h-9 text-xs gap-1 bg-orange-600 hover:bg-orange-700 text-white" onClick={() => setAddOpen(true)}>
            <CalendarPlus className="w-3.5 h-3.5" /> Add One-Off Slot
          </Button>
        </div>
      </div>

      {/* Sessions list */}
      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No VIP sessions yet. Add a slot to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sessions.map(s => {
            const isPast = s.session_date < today;
            return (
              <Card key={s.id} className="overflow-hidden">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="min-w-0">
                        <div className="font-medium text-sm">
                          {format(new Date(s.session_date + 'T00:00:00'), 'EEE, MMM d')} · {formatDisplayTime(s.session_time)}
                        </div>
                        {s.description && <p className="text-xs text-muted-foreground truncate">{s.description}</p>}
                        <span className="text-[10px] text-muted-foreground">
                          {s.created_by === 'system' ? 'System' : s.created_by}
                        </span>
                      </div>
                      <StatusBadge status={s.status} group={s.reserved_by_group} />
                      {getSessionTypeLabel(s) && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground border-muted-foreground/30">
                          {getSessionTypeLabel(s)}
                        </Badge>
                      )}
                      {s.status === 'reserved' && regCounts[s.id] !== undefined && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="w-3 h-3" /> {regCounts[s.id]} registered
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {s.status === 'reserved' && s.shareable_slug && (
                        <>
                          <Button variant="ghost" size="sm" className="h-9 text-xs gap-1" onClick={() => {
                            navigator.clipboard.writeText(`https://otf-tuscaloosa.lovable.app/vip/${s.shareable_slug}/register`);
                            toast.success('Member registration link copied');
                          }}>
                            <Copy className="w-3.5 h-3.5" /> Copy Member Link
                          </Button>
                          <Button variant="ghost" size="sm" className="h-9 text-xs gap-1" onClick={() => setQrSession(s)}>
                            <Download className="w-3.5 h-3.5" /> Download QR
                          </Button>
                          <Button variant="ghost" size="sm" className="h-9 text-xs gap-1" onClick={() => {
                            navigator.clipboard.writeText(`https://otf-tuscaloosa.lovable.app/vip/${s.shareable_slug}/roster`);
                            toast.success('Roster link copied');
                          }}>
                            <Copy className="w-3.5 h-3.5" /> Copy Roster Link
                          </Button>
                        </>
                      )}
                      {s.status === 'reserved' && (
                        <Button variant="ghost" size="sm" className="h-9 text-xs gap-1" onClick={() => {
                          setBookFromVip(s);
                          setBookForm({ firstName: '', lastName: '', phone: '', classDate: s.session_date, classTime: s.session_time, coach: '', sa: '' });
                        }}>
                          <CalendarCheck className="w-3.5 h-3.5" /> Book Intro
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-9 text-xs gap-1" onClick={handleCopyLink}>
                        <Copy className="w-3.5 h-3.5" /> Copy Availability Link
                      </Button>
                      {s.status === 'open' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 text-xs gap-1"
                          onClick={() => { setMarkingId(s.id); setMarkGroupName(''); }}
                        >
                          <BookmarkCheck className="w-3.5 h-3.5" /> Mark Reserved
                        </Button>
                      )}
                      {s.status === 'reserved' && (
                        <Button variant="ghost" size="sm" className="h-9 text-xs gap-1" onClick={() => handleViewRegistrations(s.id)}>
                          <Eye className="w-3.5 h-3.5" /> View Registrations
                        </Button>
                      )}
                      {(s.status === 'reserved' || s.status === 'cancelled') && (
                        <Button variant="ghost" size="sm" className="h-9 text-xs gap-1 text-muted-foreground" onClick={() => handleReopen(s.id)}>
                          <RotateCcw className="w-3.5 h-3.5" /> Reopen
                        </Button>
                      )}
                      {s.status !== 'cancelled' && (
                        <Button variant="ghost" size="sm" className="h-9 text-xs gap-1 text-destructive" onClick={() => handleCancel(s.id)}>
                          <XCircle className="w-3.5 h-3.5" /> Cancel
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-9 text-xs gap-1 text-destructive" onClick={() => setDeleteSessionId(s.id)}>
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </Button>
                    </div>
                  </div>

                  {/* Attendance row for past sessions */}
                  {isPast && s.status === 'reserved' && (
                    <div className="flex items-center gap-2 pt-1 border-t">
                      {attendanceSaved === s.id ? (
                        <span className="text-xs text-green-600 flex items-center gap-1"><Check className="w-3 h-3" /> Saved</span>
                      ) : s.actual_attendance != null ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">Attendance: {s.actual_attendance}</span>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setAttendanceId(s.id); setAttendanceValue(String(s.actual_attendance)); }}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1 border-amber-500 text-amber-700"
                          onClick={() => { setAttendanceId(s.id); setAttendanceValue(''); }}
                        >
                          <Users className="w-3 h-3" /> Add Attendance
                        </Button>
                      )}
                      {attendanceId === s.id && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            value={attendanceValue}
                            onChange={e => setAttendanceValue(e.target.value)}
                            placeholder="How many showed up?"
                            className="h-8 w-40 text-sm"
                            autoFocus
                          />
                          <Button size="sm" className="h-8 text-xs bg-orange-600 hover:bg-orange-700 text-white" disabled={attendanceSaving} onClick={() => handleSaveAttendance(s.id)}>
                            {attendanceSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setAttendanceId(null); setAttendanceValue(''); }}>Cancel</Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Inline Mark Reserved form */}
                  {markingId === s.id && (
                    <div className="flex items-end gap-2 pt-1 border-t">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Group Name</Label>
                        <Input
                          value={markGroupName}
                          onChange={e => setMarkGroupName(e.target.value)}
                          placeholder="e.g. Alpha Phi Sorority"
                          className="border h-9 text-sm"
                        />
                      </div>
                      <Button
                        size="sm"
                        className="h-9 bg-orange-600 hover:bg-orange-700 text-white text-xs"
                        disabled={markSaving || !markGroupName.trim()}
                        onClick={() => handleMarkReserved(s.id)}
                      >
                        {markSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                      </Button>
                      <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => setMarkingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Recurring Templates Section */}
      <Separator />
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> Recurring Templates
          </h3>
          <p className="text-xs text-muted-foreground">Slots auto-generated every Monday for 8 weeks ahead. Toggle to pause or resume.</p>
        </div>
        {templatesLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No templates configured.</p>
        ) : (
          <div className="grid gap-2">
            {templates.map(t => (
              <Card key={t.id} className={!t.is_active ? 'opacity-60' : ''}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${t.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span className="text-sm font-medium">
                      {DAY_NAMES[t.day_of_week]} · {formatDisplayTime(t.slot_time)}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {t.is_active ? 'Active' : 'Paused'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">
                      {t.is_active ? 'Active' : 'Paused'}
                    </Label>
                    <Switch
                      checked={t.is_active}
                      onCheckedChange={() => handleToggleTemplate(t.id, t.is_active)}
                    />
                    <Button variant="ghost" size="sm" className="h-9 text-xs gap-1 text-destructive" onClick={() => setDeleteTemplateId(t.id)}>
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Slot Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add One-Off Slot</DialogTitle>
            <DialogDescription>Create a single VIP session outside the recurring schedule</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="border" />
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <Input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} className="border" />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="e.g. Special event session"
                className="border"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Show on public availability page</Label>
              <Switch checked={newPublic} onCheckedChange={setNewPublic} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700 text-white"
              onClick={handleAddSlot}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Add Slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Registrations Dialog */}
      <Dialog open={!!regOpen} onOpenChange={() => setRegOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrations</DialogTitle>
            <DialogDescription>
              {(() => {
                const session = sessions.find(s => s.id === regOpen);
                const memberCount = registrations.filter(r => !r.is_group_contact).length;
                return session ? `${session.reserved_by_group || 'VIP'} — ${format(new Date(session.session_date + 'T00:00:00'), 'MMM d')}` : `${memberCount} members registered`;
              })()}
            </DialogDescription>
          </DialogHeader>

          {/* Performance Summary */}
          {perfData && (() => {
            const session = sessions.find(s => s.id === regOpen);
            const memberCount = registrations.filter(r => !r.is_group_contact).length;
            const attended = session?.actual_attendance;
            const showRate = attended != null && memberCount > 0 ? ((attended / memberCount) * 100).toFixed(0) : null;
            return (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-3 space-y-3">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Performance Summary</div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <div className="text-xl font-bold">{memberCount}</div>
                      <div className="text-[10px] text-muted-foreground">Registered</div>
                    </div>
                    <div className="text-center">
                      {attended != null ? (
                        <div className="text-xl font-bold">{attended}</div>
                      ) : (
                        <Button variant="link" size="sm" className="text-amber-600 text-xs p-0 h-auto" onClick={() => {
                          if (session) { setAttendanceId(session.id); setAttendanceValue(''); }
                        }}>Add attendance</Button>
                      )}
                      <div className="text-[10px] text-muted-foreground">Attended</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold">{showRate != null ? `${showRate}%` : '—'}</div>
                      <div className="text-[10px] text-muted-foreground">Show Rate</div>
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <div className="text-xl font-bold">{perfData.introsBooked}</div>
                      <div className="text-[10px] text-muted-foreground">Intros Booked</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold">{perfData.introsRan}</div>
                      <div className="text-[10px] text-muted-foreground">Intros Ran</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold">{perfData.joins}</div>
                      <div className="text-[10px] text-muted-foreground">Joins</div>
                    </div>
                  </div>
                  {perfData.joins > 0 ? (
                    <p className="text-xs text-green-600 font-medium">{perfData.joins} member{perfData.joins > 1 ? 's' : ''} joined from this class</p>
                  ) : perfData.introsRan > 0 ? (
                    <p className="text-xs text-muted-foreground">No joins yet from this class</p>
                  ) : perfData.introsBooked > 0 ? (
                    <p className="text-xs text-muted-foreground">Intros booked but not yet ran</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No intros booked from this class yet</p>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {/* Group Contact card */}
          {(() => {
            const session = sessions.find(s => s.id === regOpen);
            return session?.reserved_contact_name ? (
              <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                <CardContent className="p-3 space-y-1">
                  <div className="text-xs font-semibold text-orange-700 dark:text-orange-400">Group Contact</div>
                  <div className="text-sm font-medium">{session.reserved_contact_name}</div>
                  {session.reserved_contact_phone && (
                    <a href={`tel:${session.reserved_contact_phone}`} className="text-xs text-primary underline">
                      {session.reserved_contact_phone}
                    </a>
                  )}
                  {session.estimated_group_size && (
                    <div className="text-xs text-muted-foreground">Estimated group size: {session.estimated_group_size}</div>
                  )}
                </CardContent>
              </Card>
            ) : null;
          })()}

          {regLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : registrations.filter(r => !r.is_group_contact).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No individual members registered yet</p>
          ) : (
            <div className="space-y-3">
              {/* Export CSV */}
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => {
                    const members = registrations.filter(r => !r.is_group_contact);
                    const headers = ['First Name','Last Name','Email','Phone','Fitness Level','Injuries','Birthday','Weight (lbs)'];
                    const rows = members.map(r => [
                      r.first_name || '', r.last_name || '', r.email || '', r.phone || '',
                      r.fitness_level?.toString() || '', r.injuries || '',
                      r.birthday || '', r.weight_lbs?.toString() || '',
                    ]);
                    const csv = [headers, ...rows].map(row => row.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    const session = sessions.find(s => s.id === regOpen);
                    a.download = `vip-registrations-${session?.session_date || 'export'}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export to CSV
                </Button>
              </div>

              {/* Registration table */}
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left p-2 font-medium">Name</th>
                      <th className="text-left p-2 font-medium">Email</th>
                      <th className="text-left p-2 font-medium">Phone</th>
                      <th className="text-center p-2 font-medium">Fitness</th>
                      <th className="text-left p-2 font-medium">Injuries</th>
                      <th className="text-left p-2 font-medium">Birthday</th>
                      <th className="text-center p-2 font-medium">Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.filter(r => !r.is_group_contact).map(r => (
                      <tr key={r.id} className="border-t">
                        <td className="p-2 font-medium whitespace-nowrap">{[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}</td>
                        <td className="p-2 text-muted-foreground">{r.email || '—'}</td>
                        <td className="p-2 text-muted-foreground whitespace-nowrap">{r.phone || '—'}</td>
                        <td className="p-2 text-center">{r.fitness_level || '—'}</td>
                        <td className="p-2 text-muted-foreground max-w-[120px] truncate">{r.injuries || '—'}</td>
                        <td className="p-2 text-muted-foreground whitespace-nowrap">{r.birthday || '—'}</td>
                        <td className="p-2 text-center">{r.weight_lbs ? `${r.weight_lbs} lbs` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Book Intro from VIP Dialog */}
      <Dialog open={!!bookFromVip} onOpenChange={() => setBookFromVip(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Book Intro from VIP Class</DialogTitle>
            <DialogDescription>
              {bookFromVip && `${bookFromVip.reserved_by_group} — ${format(new Date(bookFromVip.session_date + 'T00:00:00'), 'MMM d')} at ${formatDisplayTime(bookFromVip.session_time)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Read-only VIP info */}
            <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 p-2">
              <div className="text-xs font-medium text-orange-700">VIP Class: {bookFromVip?.reserved_by_group} — {bookFromVip && format(new Date(bookFromVip.session_date + 'T00:00:00'), 'MMM d')}</div>
              <div className="text-[10px] text-muted-foreground">Lead Source: VIP Class (auto-set)</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">First Name <span className="text-destructive">*</span></Label><Input value={bookForm.firstName} onChange={e => setBookForm({ ...bookForm, firstName: autoCapitalizeName(e.target.value) })} /></div>
              <div className="space-y-1"><Label className="text-xs">Last Name <span className="text-destructive">*</span></Label><Input value={bookForm.lastName} onChange={e => setBookForm({ ...bookForm, lastName: autoCapitalizeName(e.target.value) })} /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Phone</Label><Input type="tel" value={bookForm.phone} onChange={e => setBookForm({ ...bookForm, phone: formatPhoneAsYouType(e.target.value) })} placeholder="(555) 555-5555" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Class Date <span className="text-destructive">*</span></Label><DatePickerField value={bookForm.classDate} onChange={v => setBookForm({ ...bookForm, classDate: v })} /></div>
              <div className="space-y-1"><Label className="text-xs">Class Time</Label><ClassTimeSelect value={bookForm.classTime} onValueChange={v => setBookForm({ ...bookForm, classTime: v })} /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Coach <span className="text-destructive">*</span></Label>
              <Select value={bookForm.coach} onValueChange={v => setBookForm({ ...bookForm, coach: v })}>
                <SelectTrigger><SelectValue placeholder="Select coach..." /></SelectTrigger>
                <SelectContent>{COACHES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Booked By</Label>
              <Select value={bookForm.sa} onValueChange={v => setBookForm({ ...bookForm, sa: v })}>
                <SelectTrigger><SelectValue placeholder="Select SA..." /></SelectTrigger>
                <SelectContent>{SALES_ASSOCIATES.map(sa => <SelectItem key={sa} value={sa}>{sa}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBookFromVip(null)}>Cancel</Button>
            <Button className="bg-orange-600 hover:bg-orange-700 text-white" disabled={bookSaving} onClick={handleBookFromVip}>
              {bookSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CalendarCheck className="w-4 h-4 mr-1" />}
              Book Intro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Session Confirmation */}
      <Dialog open={!!deleteSessionId} onOpenChange={() => setDeleteSessionId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Session</DialogTitle>
            <DialogDescription>
              This will permanently delete this VIP session and all its registrations. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSessionId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteSession} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Template Confirmation */}
      <Dialog open={!!deleteTemplateId} onOpenChange={() => setDeleteTemplateId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              This will permanently remove this recurring template. Already-generated sessions are not affected — only future auto-generation stops.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTemplateId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteTemplate} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Download Dialog */}
      <Dialog open={!!qrSession} onOpenChange={() => setQrSession(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Download QR Code</DialogTitle>
            <DialogDescription>
              {qrSession && `OTF Tuscaloosa x ${qrSession.reserved_by_group || 'VIP'} VIP Class — ${format(new Date(qrSession.session_date + 'T00:00:00'), 'MMM d')} at ${formatDisplayTime(qrSession.session_time)}`}
            </DialogDescription>
          </DialogHeader>
          {qrSession?.shareable_slug && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="border-4 border-[#E8540A] rounded-lg p-2 bg-white inline-block">
                <QRCodeCanvas
                  id="scheduler-qr-canvas"
                  value={`https://otf-tuscaloosa.lovable.app/vip/${qrSession.shareable_slug}/register`}
                  size={200}
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                  level="M"
                />
              </div>
              {/* Roster link for organizer */}
              <div className="w-full rounded-lg border p-3 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Roster link (share with organizer)</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded truncate">
                    https://otf-tuscaloosa.lovable.app/vip/{qrSession.shareable_slug}/roster
                  </code>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1 shrink-0" onClick={() => {
                    navigator.clipboard.writeText(`https://otf-tuscaloosa.lovable.app/vip/${qrSession!.shareable_slug}/roster`);
                    toast.success('Roster link copied');
                  }}>
                    <Copy className="w-3 h-3" /> Copy
                  </Button>
                </div>
              </div>
              <Button
                className="w-full bg-orange-600 hover:bg-orange-700 text-white gap-2"
                onClick={() => {
                  if (!qrSession) return;
                  const d = new Date(qrSession.session_date + 'T00:00:00');
                  const prettyDate = format(d, 'EEEE, MMMM d, yyyy');
                  const prettyTime = formatDisplayTime(qrSession.session_time);
                  const safeGroup = (qrSession.reserved_by_group || 'VIP').replace(/[^a-zA-Z0-9]/g, '-');
                  const fileName = `OTF-VIP-${safeGroup}-${qrSession.session_date}.png`;

                  const qrCanvas = document.getElementById('scheduler-qr-canvas') as HTMLCanvasElement | null;
                  const canvas = document.createElement('canvas');
                  const size = 600;
                  const padding = 60;
                  const textAreaHeight = 120;
                  const totalHeight = size + padding * 2 + textAreaHeight;
                  const totalWidth = size + padding * 2;
                  canvas.width = totalWidth;
                  canvas.height = totalHeight;
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, totalWidth, totalHeight);
                    if (qrCanvas) ctx.drawImage(qrCanvas, padding, padding, size, size);
                    ctx.strokeStyle = '#E8540A';
                    ctx.lineWidth = 4;
                    ctx.strokeRect(padding - 6, padding - 6, size + 12, size + 12);
                    const textY = padding + size + 30;
                    ctx.fillStyle = '#1a1a1a';
                    ctx.textAlign = 'center';
                    ctx.font = 'bold 22px sans-serif';
                    ctx.fillText(`OTF Tuscaloosa x ${qrSession.reserved_by_group || 'VIP'} VIP Class`, totalWidth / 2, textY);
                    ctx.font = '18px sans-serif';
                    ctx.fillText(`${prettyDate} at ${prettyTime}`, totalWidth / 2, textY + 32);
                    ctx.font = '16px sans-serif';
                    ctx.fillStyle = '#666666';
                    ctx.fillText('Scan to register before class', totalWidth / 2, textY + 62);
                    const link = document.createElement('a');
                    link.download = fileName;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                  }
                  toast.success('QR code downloaded');
                }}
              >
                <Download className="w-4 h-4" />
                Download QR Code
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
