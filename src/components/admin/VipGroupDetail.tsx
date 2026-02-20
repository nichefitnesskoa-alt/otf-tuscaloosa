import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Star, Plus, Users, CalendarPlus, ChevronDown, ChevronRight,
  Shuffle, CheckSquare, Loader2, ArrowLeft, Clock, ClipboardList,
  Trash2, Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { IntroActionBar } from '@/components/ActionBar';

interface VipSession {
  id: string;
  vip_class_name: string;
  session_label: string | null;
  session_date: string | null;
  session_time: string | null;
  capacity: number;
  created_at: string;
}

interface VipMember {
  id: string; // intros_booked.id
  member_name: string;
  class_date: string;
  intro_time: string | null;
  coach_name: string;
  booking_status: string | null;
  vip_session_id: string | null;
  phone: string | null;
  email: string | null;
  lead_source: string;
}

interface VipGroupDetailProps {
  groupName: string;
  onBack: () => void;
}

export default function VipGroupDetail({ groupName, onBack }: VipGroupDetailProps) {
  const [sessions, setSessions] = useState<VipSession[]>([]);
  const [members, setMembers] = useState<VipMember[]>([]);
  const [questionnaireStats, setQuestionnaireStats] = useState({ completed: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set(['unscheduled']));
  const [showAddSession, setShowAddSession] = useState(false);
  const [newSessionLabel, setNewSessionLabel] = useState('');
  const [newSessionDate, setNewSessionDate] = useState('');
  const [newSessionTime, setNewSessionTime] = useState('');
  const [assigning, setAssigning] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sessionsRes, membersRes] = await Promise.all([
        supabase
          .from('vip_sessions')
          .select('*')
          .eq('vip_class_name', groupName)
          .order('session_date', { ascending: true }),
        supabase
          .from('intros_booked')
          .select('id, member_name, class_date, intro_time, coach_name, booking_status, vip_session_id, phone, email, lead_source')
          .eq('vip_class_name', groupName)
          .is('deleted_at', null)
          .order('member_name', { ascending: true }),
      ]);

      if (sessionsRes.data) setSessions(sessionsRes.data as VipSession[]);
      if (membersRes.data) setMembers(membersRes.data as VipMember[]);

      // Fetch questionnaire stats
      if (membersRes.data && membersRes.data.length > 0) {
        const ids = membersRes.data.map((m: any) => m.id);
        const { data: qData } = await supabase
          .from('intro_questionnaires')
          .select('booking_id, status')
          .in('booking_id', ids);
        
        const completed = (qData || []).filter((q: any) => q.status === 'completed' || q.status === 'submitted').length;
        const scheduled = membersRes.data.filter((m: any) => m.vip_session_id).length;
        setQuestionnaireStats({ completed, total: scheduled });
      }
    } catch (err) {
      console.error('Error fetching VIP group data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [groupName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const scheduledCount = members.filter(m => m.vip_session_id).length;
  const unscheduledCount = members.filter(m => !m.vip_session_id).length;

  const membersBySession = useMemo(() => {
    const map = new Map<string, VipMember[]>();
    map.set('unscheduled', []);
    sessions.forEach(s => map.set(s.id, []));
    members.forEach(m => {
      const key = m.vip_session_id || 'unscheduled';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    });
    return map;
  }, [members, sessions]);

  const sessionCapacity = (sessionId: string) => {
    return membersBySession.get(sessionId)?.length || 0;
  };

  const handleAddSession = async () => {
    if (!newSessionDate && !newSessionLabel) {
      toast.error('Please set a date or label for the session');
      return;
    }

    const label = newSessionLabel || `Session ${String.fromCharCode(65 + sessions.length)}`;
    
    const { error } = await supabase.from('vip_sessions').insert({
      vip_class_name: groupName,
      session_label: label,
      session_date: newSessionDate || null,
      session_time: newSessionTime || null,
    } as any);

    if (error) {
      toast.error('Failed to create session');
      console.error(error);
      return;
    }

    toast.success(`Session "${label}" created`);
    setShowAddSession(false);
    setNewSessionLabel('');
    setNewSessionDate('');
    setNewSessionTime('');
    fetchData();
  };

  const handleDeleteSession = async (sessionId: string) => {
    // Unassign all members from this session first
    const sessionMembers = membersBySession.get(sessionId) || [];
    if (sessionMembers.length > 0) {
      await supabase
        .from('intros_booked')
        .update({ vip_session_id: null, booking_status: 'Unscheduled' } as any)
        .in('id', sessionMembers.map(m => m.id));
    }
    
    await supabase.from('vip_sessions').delete().eq('id', sessionId);
    toast.success('Session deleted');
    fetchData();
  };

  const handleAssignToSession = async (sessionId: string) => {
    if (selectedMembers.size === 0) {
      toast.error('Select members first');
      return;
    }

    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const currentCount = sessionCapacity(sessionId);
    const newTotal = currentCount + selectedMembers.size;
    if (newTotal > session.capacity) {
      toast.error(`Exceeds capacity! ${session.capacity - currentCount} spots remaining`);
      return;
    }

    setAssigning(true);
    try {
      const ids = Array.from(selectedMembers);
      const updateData: any = {
        vip_session_id: sessionId,
        booking_status: 'Active',
      };

      if (session.session_date) {
        updateData.class_date = session.session_date;
      }
      if (session.session_time) {
        updateData.intro_time = session.session_time;
      }

      await supabase
        .from('intros_booked')
        .update(updateData)
        .in('id', ids);

      // Create questionnaire records for newly scheduled members
      for (const memberId of ids) {
        const member = members.find(m => m.id === memberId);
        if (!member || !session.session_date) continue;

        const nameParts = member.member_name.trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        const slug = `${firstName}-${lastName}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

        // Check if questionnaire already exists
        const { data: existing } = await supabase
          .from('intro_questionnaires')
          .select('id')
          .eq('booking_id', memberId)
          .limit(1)
          .maybeSingle();

        if (!existing) {
          await supabase.from('intro_questionnaires').insert({
            booking_id: memberId,
            client_first_name: firstName,
            client_last_name: lastName,
            scheduled_class_date: session.session_date,
            scheduled_class_time: session.session_time || null,
            slug,
            status: 'not_sent',
          });
        }
      }

      toast.success(`Assigned ${ids.length} member(s) to ${session.session_label || 'session'}`);
      setSelectedMembers(new Set());
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to assign members');
    } finally {
      setAssigning(false);
    }
  };

  const handleAutoDistribute = async () => {
    const unscheduled = membersBySession.get('unscheduled') || [];
    if (unscheduled.length === 0) {
      toast.info('No unscheduled members to distribute');
      return;
    }
    if (sessions.length === 0) {
      toast.error('Create sessions first');
      return;
    }

    setAssigning(true);
    try {
      // Calculate remaining capacity per session
      const capacities = sessions.map(s => ({
        session: s,
        remaining: s.capacity - sessionCapacity(s.id),
      })).filter(c => c.remaining > 0);

      if (capacities.length === 0) {
        toast.error('All sessions are full');
        setAssigning(false);
        return;
      }

      let memberIndex = 0;
      const assignments: { memberId: string; session: VipSession }[] = [];

      // Round-robin distribution
      while (memberIndex < unscheduled.length) {
        let assigned = false;
        for (const cap of capacities) {
          if (memberIndex >= unscheduled.length) break;
          if (cap.remaining > 0) {
            assignments.push({ memberId: unscheduled[memberIndex].id, session: cap.session });
            cap.remaining--;
            memberIndex++;
            assigned = true;
          }
        }
        if (!assigned) break; // All sessions full
      }

      // Execute assignments grouped by session
      const bySession = new Map<string, { ids: string[]; session: VipSession }>();
      assignments.forEach(a => {
        if (!bySession.has(a.session.id)) {
          bySession.set(a.session.id, { ids: [], session: a.session });
        }
        bySession.get(a.session.id)!.ids.push(a.memberId);
      });

      for (const [sessionId, { ids, session }] of bySession) {
        const updateData: any = {
          vip_session_id: sessionId,
          booking_status: 'Active',
        };
        if (session.session_date) updateData.class_date = session.session_date;
        if (session.session_time) updateData.intro_time = session.session_time;

        await supabase.from('intros_booked').update(updateData).in('id', ids);

        // Create questionnaire records
        if (session.session_date) {
          for (const memberId of ids) {
            const member = members.find(m => m.id === memberId);
            if (!member) continue;
            const nameParts = member.member_name.trim().split(/\s+/);
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';
            const slug = `${firstName}-${lastName}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

            const { data: existing } = await supabase
              .from('intro_questionnaires')
              .select('id')
              .eq('booking_id', memberId)
              .limit(1)
              .maybeSingle();

            if (!existing) {
              await supabase.from('intro_questionnaires').insert({
                booking_id: memberId,
                client_first_name: firstName,
                client_last_name: lastName,
                scheduled_class_date: session.session_date,
                scheduled_class_time: session.session_time || null,
                slug,
                status: 'not_sent',
              });
            }
          }
        }
      }

      const leftover = unscheduled.length - assignments.length;
      toast.success(`Distributed ${assignments.length} members across ${bySession.size} session(s)${leftover > 0 ? `. ${leftover} couldn't fit (sessions full).` : ''}`);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to distribute');
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (memberId: string) => {
    await supabase
      .from('intros_booked')
      .update({ vip_session_id: null, booking_status: 'Unscheduled' } as any)
      .eq('id', memberId);
    toast.success('Member unassigned');
    fetchData();
  };

  const toggleSession = (id: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleMemberSelect = (id: string) => {
    setSelectedMembers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllUnscheduled = () => {
    const unscheduled = membersBySession.get('unscheduled') || [];
    setSelectedMembers(new Set(unscheduled.map(m => m.id)));
  };

  const getCapacityColor = (count: number, max: number) => {
    if (count >= max) return 'text-destructive';
    if (count >= 30) return 'text-warning';
    return 'text-muted-foreground';
  };

  const getCapacityBg = (count: number, max: number) => {
    if (count >= max) return 'bg-destructive';
    if (count >= 30) return 'bg-warning';
    return 'bg-primary';
  };

  const formatSessionHeader = (session: VipSession) => {
    const count = sessionCapacity(session.id);
    const label = session.session_label || 'Session';
    const dateStr = session.session_date ? format(parseISO(session.session_date), 'EEE MMM d') : 'No date';
    const timeStr = session.session_time ? format(parseISO(`2000-01-01T${session.session_time}`), 'h:mm a') : '';
    return `${label}: ${timeStr ? `${timeStr} ` : ''}${dateStr} (${count}/${session.capacity})`;
  };

  const renderMemberRow = (member: VipMember, showUnassign = false) => {
    const isSelected = selectedMembers.has(member.id);

    return (
      <div key={member.id} className="rounded-md border bg-card p-2.5 space-y-1.5">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleMemberSelect(member.id)}
            className="flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-sm">{member.member_name}</span>
              {!member.phone && (
                <Badge variant="destructive" className="text-[9px] px-1 py-0">No Phone</Badge>
              )}
              {member.phone && !member.email && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground">No Email</Badge>
              )}
            </div>
          </div>
          {showUnassign && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
              onClick={() => handleUnassign(member.id)}
            >
              Unassign
            </Button>
          )}
        </div>
        <IntroActionBar
          memberName={member.member_name}
          memberKey={member.member_name.toLowerCase().replace(/\s+/g, '')}
          bookingId={member.id}
          classDate={member.class_date}
          classTime={member.intro_time}
          coachName={member.coach_name}
          leadSource={member.lead_source}
          isSecondIntro={false}
          phone={member.phone}
        />
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Star className="w-5 h-5 text-purple-600" />
            {groupName}
          </h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1 text-xs"
          onClick={() => {
            const slug = groupName.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const link = `${window.location.origin}/vip-register?class=${encodeURIComponent(groupName)}`;
            navigator.clipboard.writeText(link);
            toast.success('Registration link copied!');
          }}
        >
          <Copy className="w-3.5 h-3.5" />
          Copy Reg Link
        </Button>
      </div>

      {/* Summary Dashboard */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold">{members.length}</p>
              <p className="text-xs text-muted-foreground">Total Signups</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{scheduledCount}</p>
              <p className="text-xs text-muted-foreground">Scheduled ({sessions.length} session{sessions.length !== 1 ? 's' : ''})</p>
            </div>
            <div>
              <p className={`text-2xl font-bold ${unscheduledCount > 0 ? 'text-warning' : 'text-muted-foreground'}`}>{unscheduledCount}</p>
              <p className="text-xs text-muted-foreground">Unscheduled</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{questionnaireStats.completed}/{questionnaireStats.total}</p>
              <p className="text-xs text-muted-foreground">Q's Completed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Session */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarPlus className="w-4 h-4" />
              Sessions ({sessions.length})
            </CardTitle>
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setShowAddSession(!showAddSession)}>
              <Plus className="w-3 h-3" />
              Add Session
            </Button>
          </div>
        </CardHeader>
        {showAddSession && (
          <CardContent className="pt-0">
            <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Label</Label>
                  <Input
                    placeholder={`Session ${String.fromCharCode(65 + sessions.length)}`}
                    value={newSessionLabel}
                    onChange={e => setNewSessionLabel(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Date</Label>
                  <Input
                    type="date"
                    value={newSessionDate}
                    onChange={e => setNewSessionDate(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Time</Label>
                  <Input
                    type="time"
                    value={newSessionTime}
                    onChange={e => setNewSessionTime(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <Button size="sm" onClick={handleAddSession} className="w-full">
                Create Session
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Bulk Actions */}
      {selectedMembers.size > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm font-medium">
                <CheckSquare className="w-4 h-4 inline mr-1" />
                {selectedMembers.size} selected
              </p>
              <div className="flex gap-2 flex-wrap">
                {sessions.map(s => {
                  const count = sessionCapacity(s.id);
                  const remaining = s.capacity - count;
                  return (
                    <Button
                      key={s.id}
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1"
                      onClick={() => handleAssignToSession(s.id)}
                      disabled={assigning || remaining <= 0}
                    >
                      {assigning ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      → {s.session_label || 'Session'} ({remaining} left)
                    </Button>
                  );
                })}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  onClick={() => setSelectedMembers(new Set())}
                >
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sessions */}
      {sessions.map(session => {
        const count = sessionCapacity(session.id);
        const pct = Math.round((count / session.capacity) * 100);
        const sessionMembers = membersBySession.get(session.id) || [];

        return (
          <Collapsible
            key={session.id}
            open={expandedSessions.has(session.id)}
            onOpenChange={() => toggleSession(session.id)}
          >
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {expandedSessions.has(session.id) ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      <div className="text-left">
                        <p className="text-sm font-semibold">{session.session_label || 'Session'}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {session.session_date
                            ? format(parseISO(session.session_date), 'EEE MMM d')
                            : 'Date TBD'}
                          {session.session_time && (
                            <> · {format(parseISO(`2000-01-01T${session.session_time}`), 'h:mm a')}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${getCapacityColor(count, session.capacity)}`}>
                        {count}/{session.capacity}
                      </span>
                    </div>
                  </div>
                  <Progress value={pct} className={`h-1.5 mt-1 [&>div]:${getCapacityBg(count, session.capacity)}`} />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-2 pt-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{count} member(s)</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] text-destructive"
                      onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete Session
                    </Button>
                  </div>
                  {sessionMembers.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No members assigned yet</p>
                  ) : (
                    sessionMembers.map(m => renderMemberRow(m, true))
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}

      {/* Unscheduled Section */}
      <Collapsible
        open={expandedSessions.has('unscheduled')}
        onOpenChange={() => toggleSession('unscheduled')}
      >
        <Card className={unscheduledCount > 0 ? 'border-warning/50' : ''}>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {expandedSessions.has('unscheduled') ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                  <p className="text-sm font-semibold">Unscheduled</p>
                </div>
                <Badge variant={unscheduledCount > 0 ? 'secondary' : 'outline'}>
                  {unscheduledCount}
                </Badge>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-2 pt-0">
              {unscheduledCount > 0 && (
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1"
                    onClick={selectAllUnscheduled}
                  >
                    <CheckSquare className="w-3 h-3" />
                    Select All ({unscheduledCount})
                  </Button>
                  {sessions.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1"
                      onClick={handleAutoDistribute}
                      disabled={assigning}
                    >
                      {assigning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shuffle className="w-3 h-3" />}
                      Auto-Distribute
                    </Button>
                  )}
                </div>
              )}
              {unscheduledCount === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">All members are assigned to sessions</p>
              ) : (
                (membersBySession.get('unscheduled') || []).map(m => renderMemberRow(m))
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
