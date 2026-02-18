import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

import { Copy, Check, ExternalLink, Loader2, ChevronDown, ChevronRight, FileText, Search, Plus, X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { generateSlug } from '@/lib/utils';
import QuestionnaireResponseViewer from '@/components/QuestionnaireResponseViewer';

const PUBLISHED_URL = 'https://otf-tuscaloosa.lovable.app';

interface BookingWithQ {
  id: string;
  member_name: string;
  class_date: string;
  intro_time: string | null;
  questionnaire_id: string | null;
  q_status: string | null;
  q_slug: string | null;
  is_standalone?: boolean;
}

export default function PastBookingQuestionnaires() {
  const [bookings, setBookings] = useState<BookingWithQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickDate, setQuickDate] = useState('');
  const [quickTime, setQuickTime] = useState('');
  const [quickAdding, setQuickAdding] = useState(false);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    const [{ data: bookingsData }, { data: questionnaires }, { data: introsRun }] = await Promise.all([
      supabase
        .from('intros_booked')
        .select('id, member_name, class_date, intro_time')
        .is('deleted_at', null)
        .eq('booking_status', 'Active')
        .order('class_date', { ascending: false }),
      supabase
        .from('intro_questionnaires')
        .select('id, booking_id, status, slug, client_first_name, client_last_name' as any),
      supabase
        .from('intros_run')
        .select('member_name, result'),
    ]);

    // Build set of member names that have a completed run (not No-show)
    const ranMembers = new Set<string>();
    introsRun?.forEach((r: any) => {
      if (r.result && r.result !== 'No-show') {
        ranMembers.add(r.member_name?.toLowerCase());
      }
    });

    // Build booking_id map and name-based map
    const qMap = new Map<string, { id: string; status: string; slug: string | null }>();
    const qByName = new Map<string, { id: string; status: string; slug: string | null }>();
    const usedQIds = new Set<string>();

    questionnaires?.forEach((q: any) => {
      if (q.booking_id) {
        const existing = qMap.get(q.booking_id);
        // Prefer completed records over non-completed ones
        if (!existing || (q.status === 'completed' && existing.status !== 'completed')) {
          qMap.set(q.booking_id, { id: q.id, status: q.status, slug: q.slug || null });
        }
      }
      const nameKey = `${q.client_first_name || ''} ${q.client_last_name || ''}`.trim().toLowerCase();
      if (nameKey) {
        const existing = qByName.get(nameKey);
        if (!existing || (q.status === 'completed' && existing.status !== 'completed')) {
          qByName.set(nameKey, { id: q.id, status: q.status, slug: q.slug || null });
        }
      }
    });

    const merged: BookingWithQ[] = (bookingsData || []).filter((b) => !ranMembers.has(b.member_name?.toLowerCase())).map((b) => {
      let q = qMap.get(b.id);

      // If we found a non-completed record by booking_id, check if name-based has a completed one
      if (q && q.status !== 'completed') {
        const nameKey = b.member_name?.trim().toLowerCase();
        if (nameKey) {
          const nameMatch = qByName.get(nameKey);
          if (nameMatch && nameMatch.status === 'completed') {
            q = nameMatch;
            // Link the completed record to this booking for future lookups
            supabase.from('intro_questionnaires').update({ booking_id: b.id } as any).eq('id', nameMatch.id).then();
          }
        }
      }

      // Fallback: match by member name if no booking_id link exists
      if (!q) {
        const nameKey = b.member_name?.trim().toLowerCase();
        if (nameKey) {
          const nameMatch = qByName.get(nameKey);
          if (nameMatch) {
            q = nameMatch;
            supabase.from('intro_questionnaires').update({ booking_id: b.id } as any).eq('id', nameMatch.id).then();
          }
        }
      }

      if (q) usedQIds.add(q.id);

      return {
        id: b.id,
        member_name: b.member_name,
        class_date: b.class_date,
        intro_time: b.intro_time,
        questionnaire_id: q?.id || null,
        q_status: q?.status || null,
        q_slug: q?.slug || null,
      };
    });

    // Add standalone questionnaires (no booking) that weren't matched
    const standaloneEntries: BookingWithQ[] = [];
    questionnaires?.forEach((q: any) => {
      if (!usedQIds.has(q.id) && !q.booking_id) {
        const fullName = `${q.client_first_name || ''} ${q.client_last_name || ''}`.trim();
        if (fullName.length >= 2 && !ranMembers.has(fullName.toLowerCase())) {
          standaloneEntries.push({
            id: `standalone-${q.id}`,
            member_name: fullName,
            class_date: q.scheduled_class_date || '',
            intro_time: q.scheduled_class_time || null,
            questionnaire_id: q.id,
            q_status: q.status,
            q_slug: q.slug || null,
            is_standalone: true,
          });
        }
      }
    });

    setBookings([...merged, ...standaloneEntries]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) fetchBookings();
  }, [open, fetchBookings]);

  const generateLink = async (booking: BookingWithQ) => {
    setGeneratingId(booking.id);
    const nameParts = booking.member_name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    const newId = crypto.randomUUID();

    const newSlug = generateSlug(firstName, lastName, booking.class_date || undefined);
    const { error } = await supabase.from('intro_questionnaires').insert({
      id: newId,
      booking_id: booking.is_standalone ? null : booking.id,
      client_first_name: firstName,
      client_last_name: lastName,
      scheduled_class_date: booking.class_date,
      scheduled_class_time: booking.intro_time || null,
      status: 'not_sent',
      slug: newSlug,
    } as any);

    setGeneratingId(null);
    if (error) {
      console.error('Error creating questionnaire:', error);
      toast.error('Failed to generate link');
      return;
    }

    setBookings((prev) =>
      prev.map((b) =>
        b.id === booking.id ? { ...b, questionnaire_id: newId, q_status: 'not_sent', q_slug: newSlug } : b
      )
    );
    toast.success('Questionnaire link generated!');
  };

  const handleQuickAdd = async () => {
    if (!quickName.trim() || !quickDate) {
      toast.error('Please enter a name and date');
      return;
    }
    setQuickAdding(true);
    const nameParts = quickName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    const newId = crypto.randomUUID();
    const newSlug = generateSlug(firstName, lastName, quickDate || undefined);

    const { error } = await supabase.from('intro_questionnaires').insert({
      id: newId,
      booking_id: null,
      client_first_name: firstName,
      client_last_name: lastName,
      scheduled_class_date: quickDate,
      scheduled_class_time: quickTime || null,
      status: 'not_sent',
      slug: newSlug,
    } as any);

    setQuickAdding(false);
    if (error) {
      console.error('Error creating questionnaire:', error);
      toast.error('Failed to create link');
      return;
    }

    const link = newSlug ? `${PUBLISHED_URL}/q/${newSlug}` : `${PUBLISHED_URL}/q/${newId}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link created & copied!');
    } catch {
      toast.success('Link created!');
    }

    setQuickName('');
    setQuickDate('');
    setQuickTime('');
    setShowQuickAdd(false);
    fetchBookings();
  };

  const deleteQuestionnaire = async (booking: BookingWithQ) => {
    if (!booking.questionnaire_id) return;
    const { error } = await supabase
      .from('intro_questionnaires')
      .delete()
      .eq('id', booking.questionnaire_id);
    if (error) {
      toast.error('Failed to delete questionnaire');
      return;
    }
    setBookings((prev) => prev.filter((b) => b.id !== booking.id));
    toast.success('Questionnaire deleted');
  };

  const copyLink = async (booking: BookingWithQ) => {
    if (!booking.questionnaire_id) return;
    const link = booking.q_slug ? `${PUBLISHED_URL}/q/${booking.q_slug}` : `${PUBLISHED_URL}/q/${booking.questionnaire_id}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(booking.id);
      setTimeout(() => setCopiedId(null), 2000);
      if (booking.q_status === 'not_sent') {
        await supabase
          .from('intro_questionnaires')
          .update({ status: 'sent' })
          .eq('id', booking.questionnaire_id);
        setBookings((prev) =>
          prev.map((b) =>
            b.id === booking.id ? { ...b, q_status: 'sent' } : b
          )
        );
      }
      toast.success('Link copied!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const statusBadge = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] px-1.5 py-0">Completed</Badge>;
      case 'sent':
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-[10px] px-1.5 py-0">Sent</Badge>;
      case 'not_sent':
        return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Not Sent</Badge>;
      default:
        return null;
    }
  };

  const filtered = bookings.filter((b) =>
    b.member_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pending = filtered.filter((b) => b.q_status !== 'completed');
  const completed = filtered.filter((b) => b.q_status === 'completed');
  const needsLink = pending.filter((b) => !b.questionnaire_id);
  const hasLinkPending = pending.filter((b) => b.questionnaire_id);

  return (
    <Card>
      <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setOpen(!open)}>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Pre-Intro Questionnaire Links
          {open ? <ChevronDown className="w-4 h-4 ml-auto" /> : <ChevronRight className="w-4 h-4 ml-auto" />}
          {!open && needsLink.length > 0 && (
            <Badge variant="destructive" className="text-[10px] ml-1">{needsLink.length} need links</Badge>
          )}
        </CardTitle>
      </CardHeader>
      {open && (
          <CardContent className="pt-0">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {/* Quick Add + Search row */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 h-9 text-sm"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant={showQuickAdd ? 'secondary' : 'outline'}
                    className="h-9 text-xs shrink-0"
                    onClick={() => setShowQuickAdd(!showQuickAdd)}
                  >
                    {showQuickAdd ? <X className="w-3 h-3 mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
                    {showQuickAdd ? 'Cancel' : 'Quick Add'}
                  </Button>
                </div>

                {/* Quick Add Form */}
                {showQuickAdd && (
                  <div className="p-3 rounded-md border border-primary/20 bg-muted/30 space-y-2">
                    <p className="text-xs font-medium">Create a questionnaire link (no booking needed)</p>
                    <div className="flex gap-2 flex-wrap">
                      <Input
                        placeholder="Client name (First Last)"
                        value={quickName}
                        onChange={(e) => setQuickName(e.target.value)}
                        className="h-8 text-sm flex-1 min-w-[160px]"
                      />
                      <Input
                        type="date"
                        value={quickDate}
                        onChange={(e) => setQuickDate(e.target.value)}
                        className="h-8 text-sm w-[140px]"
                      />
                      <Input
                        type="time"
                        value={quickTime}
                        onChange={(e) => setQuickTime(e.target.value)}
                        className="h-8 text-sm w-[110px]"
                        placeholder="Time (opt)"
                      />
                      <Button size="sm" className="h-8 text-xs" onClick={handleQuickAdd} disabled={quickAdding}>
                        {quickAdding ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
                        Create & Copy
                      </Button>
                    </div>
                  </div>
                )}

                {bookings.length === 0 && !showQuickAdd ? (
                  <p className="text-sm text-muted-foreground py-4">No active bookings found.</p>
                ) : (
                  <Tabs defaultValue="pending">
                    <TabsList className="w-full">
                      <TabsTrigger value="pending" className="flex-1 text-xs">
                        Pending ({pending.length})
                      </TabsTrigger>
                      <TabsTrigger value="completed" className="flex-1 text-xs">
                        Completed ({completed.length})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="pending">
                      {pending.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">No pending bookings.</p>
                      ) : (
                        <div className="space-y-4">
                          {needsLink.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2">
                                Needs Link ({needsLink.length})
                              </p>
                              <div className="space-y-2">
                                {needsLink.map((b) => (
                                  <div key={b.id} className="flex items-center justify-between gap-2 p-2 rounded-md border bg-card text-sm">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium truncate">
                                        {b.member_name}
                                        {b.is_standalone && <Badge variant="outline" className="text-[9px] ml-1 px-1 py-0">Standalone</Badge>}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {b.class_date && format(new Date(b.class_date + 'T00:00:00'), 'MMM d, yyyy')}
                                        {b.intro_time && ` · ${b.intro_time}`}
                                      </p>
                                    </div>
                                    <Button size="sm" variant="outline" className="shrink-0 h-7 text-xs" disabled={generatingId === b.id} onClick={() => generateLink(b)}>
                                      {generatingId === b.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                                      Generate Link
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {hasLinkPending.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2">
                                Link Generated ({hasLinkPending.length})
                              </p>
                              <div className="space-y-2">
                                {hasLinkPending.map((b) => (
                                  <div key={b.id} className="flex items-center justify-between gap-2 p-2 rounded-md border bg-card text-sm">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium truncate">
                                        {b.member_name}
                                        {b.is_standalone && <Badge variant="outline" className="text-[9px] ml-1 px-1 py-0">Standalone</Badge>}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {b.class_date && format(new Date(b.class_date + 'T00:00:00'), 'MMM d, yyyy')}
                                        {b.intro_time && ` · ${b.intro_time}`}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {statusBadge(b.q_status)}
                                      <a href={b.q_slug ? `${PUBLISHED_URL}/q/${b.q_slug}` : `${PUBLISHED_URL}/q/${b.questionnaire_id}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyLink(b)}>
                                        {copiedId === b.id ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => deleteQuestionnaire(b)}>
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="completed">
                      {completed.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">No completed questionnaires.</p>
                      ) : (
                        <div className="space-y-2">
                          {completed.map((b) => (
                            <div key={b.id} className="p-2 rounded-md border bg-card text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium truncate">{b.member_name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {b.class_date && format(new Date(b.class_date + 'T00:00:00'), 'MMM d, yyyy')}
                                    {b.intro_time && ` · ${b.intro_time}`}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {statusBadge(b.q_status)}
                                  <a href={b.q_slug ? `${PUBLISHED_URL}/q/${b.q_slug}` : `${PUBLISHED_URL}/q/${b.questionnaire_id}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyLink(b)}>
                                    {copiedId === b.id ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => deleteQuestionnaire(b)}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                              {b.questionnaire_id && (
                                <QuestionnaireResponseViewer
                                  questionnaireId={b.questionnaire_id}
                                  questionnaireStatus="completed"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </div>
            )}
          </CardContent>
      )}
    </Card>
  );
}