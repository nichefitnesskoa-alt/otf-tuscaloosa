import { useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Clock, X, CheckCircle, Send, Phone, CalendarPlus, MessageCircle, PhoneCall, Voicemail, ChevronDown, ChevronRight, Lightbulb } from 'lucide-react';
import { format, differenceInDays, parseISO, addDays, formatDistanceToNowStrict, isToday } from 'date-fns';
import { toast } from 'sonner';
import { MessageGenerator } from '@/components/scripts/MessageGenerator';
import { useScriptTemplates, ScriptTemplate } from '@/hooks/useScriptTemplates';
import { selectBestScript } from '@/hooks/useSmartScriptSelect';
import { cn } from '@/lib/utils';
import { logTouch, fetchTouchSummaries } from '@/lib/touchLog';
import { RebookDialog } from '@/components/dashboard/RebookDialog';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { enqueue } from '@/lib/offline/writeQueue';
import { TouchQueueItem, FollowupCompleteQueueItem } from '@/lib/offline/types';

interface FollowUpItem {
  id: string;
  booking_id: string | null;
  lead_id: string | null;
  person_name: string;
  person_type: 'no_show' | 'didnt_buy';
  trigger_date: string;
  touch_number: number;
  scheduled_date: string;
  status: string;
  sent_by: string | null;
  sent_at: string | null;
  snoozed_until: string | null;
  is_vip: boolean;
  primary_objection: string | null;
  fitness_goal: string | null;
}

// Cadence definitions
const NO_SHOW_CADENCE = [0, 5, 12];
const DIDNT_BUY_CADENCE = [0, 6, 13];

export function generateFollowUpEntries(
  personName: string,
  personType: 'no_show' | 'didnt_buy',
  triggerDate: string,
  bookingId: string | null,
  leadId: string | null,
  isVip: boolean,
  primaryObjection?: string | null,
  fitnessGoal?: string | null,
) {
  const cadence = personType === 'no_show' ? NO_SHOW_CADENCE : DIDNT_BUY_CADENCE;
  const trigger = parseISO(triggerDate);
  
  return cadence.map((dayOffset, i) => ({
    booking_id: bookingId,
    lead_id: leadId,
    person_name: personName,
    person_type: personType,
    trigger_date: triggerDate,
    touch_number: i + 1,
    scheduled_date: format(addDays(trigger, dayOffset), 'yyyy-MM-dd'),
    status: 'pending',
    is_vip: isVip,
    primary_objection: primaryObjection || null,
    fitness_goal: fitnessGoal || null,
  }));
}

interface FollowUpQueueProps {
  onRefresh: () => void;
}

export function FollowUpQueue({ onRefresh }: FollowUpQueueProps) {
  const { user } = useAuth();
  const { followUpQueue, followupTouches, refreshFollowUps, refreshTouches } = useData();
  const isOnline = useOnlineStatus();
  const { data: templates = [] } = useScriptTemplates();
  const [scriptItem, setScriptItem] = useState<FollowUpItem | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ScriptTemplate | null>(null);
  const [rebookItem, setRebookItem] = useState<FollowUpItem | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [optimisticallyDone, setOptimisticallyDone] = useState<Set<string>>(new Set());
  const [touchPulse, setTouchPulse] = useState<string | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');

  // Derive items from DataContext
  const items = useMemo(() => {
    return followUpQueue
      .filter(f =>
        f.status === 'pending' &&
        f.scheduled_date <= today &&
        !f.is_vip &&
        !optimisticallyDone.has(f.id)
      )
      .slice(0, 20) as unknown as FollowUpItem[];
  }, [followUpQueue, today, optimisticallyDone]);

  // Touch summaries from context data
  const touchSummaries = useMemo(() => {
    const map = new Map<string, { count: number; lastTouchAt: string | null; todayCount: number }>();
    for (const t of followupTouches) {
      const bid = t.booking_id;
      if (!bid) continue;
      const existing = map.get(bid);
      const isTodayTouch = isToday(parseISO(t.created_at));
      if (existing) {
        existing.count++;
        if (isTodayTouch) existing.todayCount++;
      } else {
        map.set(bid, { count: 1, lastTouchAt: t.created_at, todayCount: isTodayTouch ? 1 : 0 });
      }
    }
    return map;
  }, [followupTouches]);

  // Helper: execute action online or queue offline
  const executeTouch = useCallback(async (item: FollowUpItem, touchType: string, channel: string, notes: string) => {
    const userName = user?.name || 'Unknown';
    if (isOnline) {
      await logTouch({
        createdBy: userName,
        touchType: touchType as any,
        bookingId: item.booking_id,
        channel,
        notes,
      });
      refreshTouches();
    } else {
      const queueItem: TouchQueueItem = {
        id: crypto.randomUUID(),
        type: 'touch',
        createdAt: new Date().toISOString(),
        createdBy: userName,
        syncStatus: 'pending',
        retryCount: 0,
        payload: {
          touchType,
          bookingId: item.booking_id,
          channel,
          notes,
        },
      };
      enqueue(queueItem);
    }
    // Pulse animation
    setTouchPulse(item.id);
    setTimeout(() => setTouchPulse(null), 600);
    toast.success('Touch logged');
  }, [isOnline, user?.name, refreshTouches]);

  const handleMarkDone = useCallback(async (item: FollowUpItem) => {
    const userName = user?.name || 'Unknown';

    // Optimistic UI
    setOptimisticallyDone(prev => new Set(prev).add(item.id));

    if (isOnline) {
      await supabase
        .from('follow_up_queue')
        .update({
          status: 'sent',
          sent_by: userName,
          sent_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      await logTouch({
        createdBy: userName,
        touchType: 'mark_done',
        bookingId: item.booking_id,
        notes: `Follow-up touch ${item.touch_number} marked done`,
      });

      refreshFollowUps();
      refreshTouches();
    } else {
      const queueItem: FollowupCompleteQueueItem = {
        id: crypto.randomUUID(),
        type: 'followup_complete',
        createdAt: new Date().toISOString(),
        createdBy: userName,
        syncStatus: 'pending',
        retryCount: 0,
        payload: {
          followUpId: item.id,
          sentBy: userName,
        },
      };
      enqueue(queueItem);
    }

    onRefresh();

    // Undo toast (10 seconds)
    toast.success('Follow-up complete', {
      action: {
        label: 'Undo',
        onClick: async () => {
          setOptimisticallyDone(prev => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
          if (isOnline) {
            await supabase
              .from('follow_up_queue')
              .update({ status: 'pending', sent_by: null, sent_at: null })
              .eq('id', item.id);
            refreshFollowUps();
          }
          toast.success('Mark done undone');
        },
      },
      duration: 10000,
    });
  }, [isOnline, user?.name, refreshFollowUps, refreshTouches, onRefresh]);

  const handleSend = (item: FollowUpItem) => {
    const scriptResult = selectBestScript({
      personType: 'booking',
      classDate: item.trigger_date,
      introResult: item.person_type === 'no_show' ? 'No-show' : "Didn't Buy",
      primaryObjection: item.primary_objection,
    }, templates);

    let template = scriptResult.template;
    if (template && item.touch_number > 1) {
      const category = item.person_type === 'no_show' ? 'no_show' : 'post_class_no_close';
      const stepTemplate = templates.find(t =>
        t.category === category &&
        t.is_active &&
        (t.sequence_order || 1) === item.touch_number
      );
      if (stepTemplate) template = stepTemplate;
    }

    if (template) {
      setSelectedTemplate(template);
      setScriptItem(item);
    } else {
      toast.info('No matching script template found');
    }
  };

  const handleMarkSent = async (item: FollowUpItem) => {
    await supabase
      .from('follow_up_queue')
      .update({
        status: 'sent',
        sent_by: user?.name || 'Unknown',
        sent_at: new Date().toISOString(),
      })
      .eq('id', item.id);
    
    await logTouch({
      createdBy: user?.name || 'Unknown',
      touchType: 'script_copy',
      bookingId: item.booking_id,
      channel: 'sms',
      notes: `Follow-up touch ${item.touch_number} marked sent`,
    });

    toast.success('Follow-up marked as sent');
    refreshFollowUps();
    refreshTouches();
    onRefresh();
  };

  const handleSnooze = async (item: FollowUpItem) => {
    const newDate = format(addDays(new Date(), 2), 'yyyy-MM-dd');
    await supabase
      .from('follow_up_queue')
      .update({ scheduled_date: newDate, snoozed_until: newDate })
      .eq('id', item.id);
    toast.success('Snoozed for 2 days');
    refreshFollowUps();
  };

  const handleRemove = async (item: FollowUpItem) => {
    await supabase
      .from('follow_up_queue')
      .update({ status: 'dormant' })
      .eq('person_name', item.person_name)
      .eq('status', 'pending');
    toast.success('Removed from follow-up queue');
    refreshFollowUps();
    onRefresh();
  };

  const mergeContext = useMemo(() => {
    if (!scriptItem) return {};
    const firstName = scriptItem.person_name.split(' ')[0] || '';
    return {
      'first-name': firstName,
      'last-name': scriptItem.person_name.split(' ').slice(1).join(' ') || '',
      'sa-name': user?.name,
      'location-name': 'Tuscaloosa',
    };
  }, [scriptItem, user?.name]);

  const touchColor = (touch: number) => {
    if (touch === 1) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (touch === 2) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-orange-100 text-orange-800 border-orange-200';
  };

  const maxTouches = () => 3;

  // Next best action hint
  const getHint = (item: FollowUpItem): string | null => {
    const touchInfo = item.booking_id ? touchSummaries.get(item.booking_id) : null;
    const todayCount = touchInfo?.todayCount || 0;
    const totalCount = touchInfo?.count || 0;

    if (todayCount === 0) return 'Do a touch now';
    if (todayCount > 0 && item.status === 'pending') return 'Mark done if reached';
    if (item.person_type === 'no_show' && totalCount >= 2) return 'Try rebook';
    return null;
  };

  if (items.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            Follow-Ups Due
            <Badge variant="default" className="ml-1 text-[10px]">{items.length}</Badge>
            {!isOnline && <Badge variant="outline" className="text-[9px] bg-warning/15 text-warning border-warning/30">Offline</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map(item => {
            const daysSinceTrigger = differenceInDays(new Date(), parseISO(item.trigger_date));
            const typeLabel = item.person_type === 'no_show' ? 'No Show' : "Didn't Buy";
            const triggerLabel = `${typeLabel} on ${format(parseISO(item.trigger_date), 'MMM d')}`;
            const isExpanded = expandedId === item.id;
            const touchInfo = item.booking_id ? touchSummaries.get(item.booking_id) : null;
            const hint = getHint(item);
            const showRebook = (item.person_type === 'no_show' || item.person_type === 'didnt_buy') && item.status === 'pending';
            const isPulsing = touchPulse === item.id;

            return (
              <div key={item.id} className="rounded-lg border bg-card space-y-0">
                {/* Card header - tappable to expand */}
                <div
                  className="p-3 cursor-pointer"
                  onClick={() => setExpandedId(prev => prev === item.id ? null : item.id)}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[17px] md:text-sm whitespace-normal break-words leading-tight">{item.person_name}</p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border', touchColor(item.touch_number))}>
                          Touch {item.touch_number}/{maxTouches()}
                        </Badge>
                        <span className="text-[13px] md:text-xs text-muted-foreground">{triggerLabel}</span>
                        {daysSinceTrigger > 0 && (
                          <span className="text-[11px] text-muted-foreground/70">
                            <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                            {daysSinceTrigger}d
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Touch count badge */}
                    {touchInfo && (
                      <div className={cn(
                        "text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full transition-all",
                        isPulsing && "animate-pulse bg-primary/20 text-primary"
                      )}>
                        {touchInfo.count} touch{touchInfo.count !== 1 ? 'es' : ''}
                      </div>
                    )}
                  </div>

                  {/* Hint */}
                  {hint && !isExpanded && (
                    <div className="flex items-center gap-1 mt-1.5 ml-5 text-[11px] text-muted-foreground">
                      <Lightbulb className="w-3 h-3 text-warning" />
                      <span>{hint}</span>
                    </div>
                  )}
                </div>

                {/* Always-visible Action Row */}
                <div className="px-3 pb-2.5 flex items-center gap-1 flex-wrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 md:h-7 text-[12px] md:text-[11px] gap-1 px-2.5 min-h-[40px] md:min-h-0"
                    onClick={(e) => { e.stopPropagation(); executeTouch(item, 'text_manual', 'sms', 'Quick touch: texted'); }}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Texted
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 md:h-7 text-[12px] md:text-[11px] gap-1 px-2.5 min-h-[40px] md:min-h-0"
                    onClick={(e) => { e.stopPropagation(); executeTouch(item, 'call', 'call', 'Quick touch: called'); }}
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    Called
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 md:h-7 text-[12px] md:text-[11px] gap-1 px-2.5 min-h-[40px] md:min-h-0"
                    onClick={(e) => { e.stopPropagation(); executeTouch(item, 'call', 'call', 'Quick touch: left voicemail'); }}
                  >
                    <Voicemail className="w-3.5 h-3.5" />
                    VM
                  </Button>
                  <div className="w-px h-5 bg-border mx-0.5" />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 md:h-7 text-[12px] md:text-[11px] gap-1 px-2.5 min-h-[40px] md:min-h-0"
                    onClick={(e) => { e.stopPropagation(); handleMarkDone(item); }}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Done
                  </Button>
                  {showRebook && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 md:h-7 text-[12px] md:text-[11px] gap-1 px-2.5 min-h-[40px] md:min-h-0"
                      onClick={(e) => { e.stopPropagation(); setRebookItem(item); }}
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      Rebook
                    </Button>
                  )}
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t space-y-2">
                    {touchInfo && touchInfo.lastTouchAt && (
                      <div className="text-[11px] text-muted-foreground">
                        Last touch: {formatDistanceToNowStrict(new Date(touchInfo.lastTouchAt), { addSuffix: true })}
                        {touchInfo.todayCount > 0 && <span className="ml-1 text-primary font-medium">({touchInfo.todayCount} today)</span>}
                      </div>
                    )}
                    {item.primary_objection && (
                      <div className="text-[11px] text-muted-foreground">
                        Objection: <span className="font-medium">{item.primary_objection}</span>
                      </div>
                    )}
                    {item.fitness_goal && (
                      <div className="text-[11px] text-muted-foreground">
                        Goal: <span className="font-medium">{item.fitness_goal}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        className="h-8 md:h-7 text-[12px] md:text-[11px] flex-1 gap-1"
                        onClick={() => handleSend(item)}
                      >
                        <Send className="w-3.5 h-3.5" />
                        Open Script
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 md:h-7 text-[12px] md:text-[11px] gap-1 px-2.5"
                        onClick={() => handleSnooze(item)}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Snooze
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 md:h-7 text-[11px] text-muted-foreground px-1"
                        onClick={() => handleRemove(item)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {scriptItem && selectedTemplate && (
        <MessageGenerator
          open={true}
          onOpenChange={(o) => {
            if (!o) {
              setScriptItem(null);
              setSelectedTemplate(null);
            }
          }}
          template={selectedTemplate}
          mergeContext={mergeContext}
          bookingId={scriptItem.booking_id || undefined}
          onLogged={() => {
            handleMarkSent(scriptItem);
            setScriptItem(null);
            setSelectedTemplate(null);
          }}
        />
      )}

      {rebookItem && (
        <RebookDialog
          open={!!rebookItem}
          onOpenChange={(o) => { if (!o) setRebookItem(null); }}
          personName={rebookItem.person_name}
          bookingId={rebookItem.booking_id}
          personType={rebookItem.person_type}
        />
      )}
    </>
  );
}
