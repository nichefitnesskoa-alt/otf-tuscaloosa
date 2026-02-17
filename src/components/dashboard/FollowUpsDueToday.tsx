import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Clock, Copy, Layers, ArrowUpDown, Phone, History, Check } from 'lucide-react';
import { InlinePhoneInput, NoPhoneBadge } from '@/components/dashboard/InlinePhoneInput';
import { format, differenceInDays, parseISO, addDays } from 'date-fns';
import { toast } from 'sonner';
import { MessageGenerator } from '@/components/scripts/MessageGenerator';
import { useScriptTemplates, ScriptTemplate } from '@/hooks/useScriptTemplates';
import { selectBestScript } from '@/hooks/useSmartScriptSelect';
import { cn } from '@/lib/utils';
import { SectionHelp } from '@/components/dashboard/SectionHelp';
import { getFollowUpGuidance } from '@/components/dashboard/CardGuidance';
import { LogPastContactDialog } from '@/components/dashboard/LogPastContactDialog';

interface FollowUpItem {
  id: string;
  booking_id: string | null;
  lead_id: string | null;
  person_name: string;
  person_type: string;
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
  is_legacy: boolean;
  lead_source?: string | null;
  phone?: string | null;
}

interface FollowUpsDueTodayProps {
  onRefresh: () => void;
  onCountChange?: (count: number) => void;
}

export function FollowUpsDueToday({ onRefresh, onCountChange }: FollowUpsDueTodayProps) {
  const { user } = useAuth();
  const { data: templates = [] } = useScriptTemplates();
  const [items, setItems] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scriptItem, setScriptItem] = useState<FollowUpItem | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ScriptTemplate | null>(null);
  const [pastContactItem, setPastContactItem] = useState<FollowUpItem | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [batchIndex, setBatchIndex] = useState(0);
  const [sortBy, setSortBy] = useState<'date' | 'type'>('date');
  const [filterType, setFilterType] = useState<'all' | 'no_show' | 'didnt_buy'>('all');

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => { fetchQueue(); }, []);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('follow_up_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_date', today)
        .eq('is_vip', false)
        .order('scheduled_date', { ascending: true })
        .limit(50);

      if (error) throw error;

      if (data && data.length > 0) {
        const personNames = [...new Set(data.map(d => d.person_name))];
        const bookingIds = [...new Set(data.map(d => d.booking_id).filter(Boolean))] as string[];
        const sixDaysAgo = format(addDays(new Date(), -6), 'yyyy-MM-dd');
        const thirtyDaysAgo = format(addDays(new Date(), -30), 'yyyy-MM-dd');
        
        // Parallel: fetch all exit-condition data
        const [
          leadSourceRes,
          recentSentRes,
          recentActionsRes,
          purchasedRunsRes,
          futureBookingsRes,
          leadStagesRes,
          salesRes,
          vipOnlyRes,
          phoneRes,
        ] = await Promise.all([
          // 1. Lead source + phone from intros_booked
          bookingIds.length > 0
            ? supabase.from('intros_booked').select('id, lead_source, phone, member_name').in('id', bookingIds)
            : Promise.resolve({ data: [] }),
          // 2. 6-day cooling guardrail
          supabase.from('follow_up_queue').select('person_name')
            .eq('status', 'sent').gte('sent_at', sixDaysAgo + 'T00:00:00').in('person_name', personNames),
          // 3. Script_actions for manual contacts
          supabase.from('script_actions').select('booking_id').gte('completed_at', sixDaysAgo + 'T00:00:00'),
          // 4. EXIT: Check if person purchased via ANY intro run (name match)
          supabase.from('intros_run').select('member_name, result').in('member_name', personNames),
          // 5. EXIT: Check for future bookings (2nd intro booked)
          supabase.from('intros_booked').select('member_name, class_date, is_vip, deleted_at, booking_status')
            .in('member_name', personNames)
            .gte('class_date', today)
            .is('deleted_at', null),
          // 6. EXIT: Check lead stages for DNC/won
          supabase.from('leads').select('first_name, last_name, stage'),
          // 7. EXIT: Check sales_outside_intro for purchased members
          supabase.from('sales_outside_intro').select('member_name').in('member_name', personNames),
          // 8. EXIT: Check if VIP-only (all bookings are VIP)
          supabase.from('intros_booked').select('member_name, is_vip, deleted_at')
            .in('member_name', personNames)
            .is('deleted_at', null),
          // 9. Phone from ALL bookings for these people (not just linked booking)
          supabase.from('intros_booked').select('member_name, phone')
            .in('member_name', personNames)
            .is('deleted_at', null),
        ]);

        // Build lookup maps
        const bookingDataMap = new Map<string, { lead_source: string | null; phone: string | null }>(
          ((leadSourceRes as any).data || []).map((b: any) => [b.id, { lead_source: b.lead_source, phone: b.phone }])
        );

        const recentlySentNames = new Set(
          ((recentSentRes as any).data || []).map((r: any) => r.person_name)
        );
        
        const recentActionBookingIds = new Set(
          ((recentActionsRes as any).data || []).map((a: any) => a.booking_id).filter(Boolean)
        );

        // EXIT CONDITION 1: Purchased via intro run
        const purchasedNames = new Set<string>();
        for (const run of ((purchasedRunsRes as any).data || []) as { member_name: string; result: string }[]) {
          const r = run.result?.toLowerCase() || '';
          if (r.includes('premier') || r.includes('elite') || r.includes('basic')) {
            purchasedNames.add(run.member_name);
          }
        }

        // EXIT CONDITION 2: Purchased via sales_outside_intro
        for (const sale of ((salesRes as any).data || []) as { member_name: string }[]) {
          purchasedNames.add(sale.member_name);
        }

        // EXIT CONDITION 3: Future bookings (2nd intro booked)
        const futureBookedNames = new Set<string>();
        for (const b of ((futureBookingsRes as any).data || []) as { member_name: string; booking_status: string | null; is_vip: boolean }[]) {
          if (b.booking_status === 'Cancelled') continue;
          if (b.is_vip) continue; // VIP future bookings don't count
          futureBookedNames.add(b.member_name);
        }

        // EXIT CONDITION 4: DNC / won leads
        const dncNames = new Set<string>();
        for (const l of ((leadStagesRes as any).data || []) as { first_name: string; last_name: string; stage: string }[]) {
          const stage = l.stage?.toLowerCase() || '';
          if (stage === 'lost' || stage === 'won' || stage === 'dnc') {
            dncNames.add(`${l.first_name} ${l.last_name}`);
          }
        }

        // EXIT CONDITION 5: VIP-only people (ALL their bookings are VIP)
        const vipOnlyNames = new Set<string>();
        const allBookingsForPerson = new Map<string, { vip: number; nonVip: number }>();
        for (const b of ((vipOnlyRes as any).data || []) as { member_name: string; is_vip: boolean }[]) {
          const existing = allBookingsForPerson.get(b.member_name) || { vip: 0, nonVip: 0 };
          if (b.is_vip) existing.vip++;
          else existing.nonVip++;
          allBookingsForPerson.set(b.member_name, existing);
        }
        for (const [name, counts] of allBookingsForPerson) {
          if (counts.vip > 0 && counts.nonVip === 0) {
            vipOnlyNames.add(name);
          }
        }

        // Phone lookup: find best phone for each person
        const phoneMap = new Map<string, string | null>();
        for (const b of ((phoneRes as any).data || []) as { member_name: string; phone: string | null }[]) {
          if (b.phone && b.phone.trim()) {
            phoneMap.set(b.member_name, b.phone);
          } else if (!phoneMap.has(b.member_name)) {
            phoneMap.set(b.member_name, null);
          }
        }

        // Collect all names to auto-convert/dormant in DB
        const autoConvertNames = new Set<string>();
        const autoDormantNames = new Set<string>();

        for (const name of personNames) {
          if (purchasedNames.has(name) || futureBookedNames.has(name) || dncNames.has(name) || vipOnlyNames.has(name)) {
            autoConvertNames.add(name);
          }
        }

        // EXIT CONDITION 6: Legacy items older than 30 days with no contact
        for (const d of data) {
          if (d.is_legacy && d.trigger_date < thirtyDaysAgo) {
            autoDormantNames.add(d.person_name);
          }
        }

        // Fire-and-forget DB cleanup
        if (autoConvertNames.size > 0) {
          supabase.from('follow_up_queue')
            .update({ status: 'converted' })
            .eq('status', 'pending')
            .in('person_name', Array.from(autoConvertNames))
            .then(() => {});
        }
        if (autoDormantNames.size > 0) {
          supabase.from('follow_up_queue')
            .update({ status: 'dormant' })
            .eq('status', 'pending')
            .in('person_name', Array.from(autoDormantNames))
            .then(() => {});
        }
        
        const filtered = data.filter(d => {
          // All exit conditions
          if (purchasedNames.has(d.person_name)) return false;
          if (futureBookedNames.has(d.person_name)) return false;
          if (dncNames.has(d.person_name)) return false;
          if (vipOnlyNames.has(d.person_name)) return false;
          if (autoConvertNames.has(d.person_name)) return false;
          if (autoDormantNames.has(d.person_name)) return false;
          // Cooling guardrail
          if (recentlySentNames.has(d.person_name)) return false;
          if (d.booking_id && recentActionBookingIds.has(d.booking_id)) return false;
          return true;
        }).map(d => {
          const bookingData = d.booking_id ? bookingDataMap.get(d.booking_id) : null;
          const personPhone = phoneMap.get(d.person_name) || bookingData?.phone || null;
          return {
            ...d,
            lead_source: bookingData?.lead_source || null,
            phone: personPhone,
          };
        });

        setItems(filtered as FollowUpItem[]);
        onCountChange?.(filtered.length);
      } else {
        setItems([]);
        onCountChange?.(0);
      }
    } catch (err) {
      console.error('FollowUpsDueToday fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    let filtered = items;
    if (filterType !== 'all') {
      filtered = filtered.filter(i => i.person_type === filterType);
    }
    if (sortBy === 'type') {
      filtered = [...filtered].sort((a, b) => {
        if (a.person_type !== b.person_type) return a.person_type === 'no_show' ? -1 : 1;
        return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
      });
    }
    return filtered;
  }, [items, filterType, sortBy]);
  
  const sendableItems = useMemo(() => filteredItems.filter(i => hasPhone(i)), [filteredItems]);
  
  const noShowCount = useMemo(() => items.filter(i => i.person_type === 'no_show').length, [items]);
  const didntBuyCount = useMemo(() => items.filter(i => i.person_type === 'didnt_buy').length, [items]);

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
    const updates: Record<string, any> = {
      status: 'sent',
      sent_by: user?.name || 'Unknown',
      sent_at: new Date().toISOString(),
    };
    if (item.is_legacy) {
      updates.is_legacy = false;
    }
    await supabase
      .from('follow_up_queue')
      .update(updates)
      .eq('id', item.id);
    
    toast.success('Follow-up marked as sent');
    fetchQueue();
    onRefresh();
  };

  const handleSnooze = async (item: FollowUpItem) => {
    const newDate = format(addDays(new Date(), 2), 'yyyy-MM-dd');
    await supabase
      .from('follow_up_queue')
      .update({ scheduled_date: newDate, snoozed_until: newDate })
      .eq('id', item.id);
    toast.success('Snoozed for 2 days');
    fetchQueue();
  };

  const handleSkip = async (item: FollowUpItem) => {
    await supabase
      .from('follow_up_queue')
      .update({ status: 'skipped' })
      .eq('id', item.id);
    toast.success('Touch skipped');
    fetchQueue();
  };

  const handleRemove = async (item: FollowUpItem) => {
    await supabase
      .from('follow_up_queue')
      .update({ status: 'dormant' })
      .eq('person_name', item.person_name)
      .eq('status', 'pending');
    toast.success('Removed from follow-up queue');
    fetchQueue();
    onRefresh();
  };

  const handleMarkDone = async (item: FollowUpItem) => {
    await supabase
      .from('follow_up_queue')
      .update({ status: 'converted' })
      .eq('person_name', item.person_name)
      .eq('status', 'pending');
    toast.success('Marked as done');
    fetchQueue();
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

  const getLeadSourceBadgeColor = (source?: string | null) => {
    if (!source) return 'bg-muted text-muted-foreground border-border';
    const s = source.toLowerCase();
    if (s.includes('instagram') || s.includes('ig')) return 'bg-pink-100 text-pink-800 border-pink-200';
    if (s.includes('facebook') || s.includes('fb')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (s.includes('referral') || s.includes('friend')) return 'bg-purple-100 text-purple-800 border-purple-200';
    if (s.includes('web') || s.includes('website')) return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    if (s.includes('walk')) return 'bg-green-100 text-green-800 border-green-200';
    return 'bg-muted text-muted-foreground border-border';
  };

  const hasPhone = (item: FollowUpItem) => !!(item.phone && item.phone.trim());

  const isIgLead = (source?: string | null) => {
    if (!source) return false;
    const s = source.toLowerCase();
    return s.includes('instagram') || s.includes('ig');
  };

  const getPhoneGuidance = (item: FollowUpItem) => {
    if (isIgLead(item.lead_source)) {
      return "IG lead with no phone. Consider reaching out via DM instead. Or tap Prep to add their phone number.";
    }
    return "Can't send follow-up without a phone number. Get their number first → tap Prep to add it.";
  };

  // Batch mode
  const handleBatchStart = () => {
    if (sendableItems.length === 0) {
      toast.info('No items with phone numbers to batch send');
      return;
    }
    setBatchMode(true);
    setBatchIndex(0);
    handleSend(sendableItems[0]);
  };

  const handleBatchNext = () => {
    const nextIdx = batchIndex + 1;
    if (nextIdx < sendableItems.length) {
      setBatchIndex(nextIdx);
      handleSend(sendableItems[nextIdx]);
    } else {
      setBatchMode(false);
      toast.success('Batch complete!');
    }
  };

  if (loading) return null;
  if (items.length === 0) return null;

  const renderFollowUpCard = (item: FollowUpItem) => {
    const daysSinceTrigger = differenceInDays(new Date(), parseISO(item.trigger_date));
    const typeLabel = item.person_type === 'no_show' ? 'No Show' : "Didn't Buy";
    const typeBadgeColor = item.person_type === 'no_show'
      ? 'bg-destructive/10 text-destructive border-destructive/20'
      : 'bg-amber-100 text-amber-800 border-amber-200';

    const noPhone = !hasPhone(item);

    const guidance = noPhone
      ? getPhoneGuidance(item)
      : getFollowUpGuidance({
          touchNumber: item.touch_number,
          personType: item.person_type,
          isLegacy: item.is_legacy,
          leadSource: item.lead_source,
        });

    return (
      <div key={item.id} className={cn(
        'rounded-lg border bg-card transition-all',
        noPhone && 'border-destructive/30'
      )}>
        <div className="p-3 md:p-2.5">
          {/* Row 1: Name + phone */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-[17px] md:text-sm whitespace-normal break-words leading-tight">{item.person_name}</p>
            {item.phone && item.phone.trim() ? (
              <a href={`tel:${item.phone}`} onClick={e => e.stopPropagation()}>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 text-muted-foreground font-normal cursor-pointer hover:text-primary">
                  <Phone className="w-2.5 h-2.5" />
                  {item.phone}
                </Badge>
              </a>
            ) : (
              <NoPhoneBadge compact />
            )}
            {noPhone && (
              <InlinePhoneInput personName={item.person_name} bookingId={item.booking_id} onSaved={fetchQueue} compact />
            )}
          </div>

          {/* Row 2: Badges */}
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border whitespace-nowrap', typeBadgeColor)}>
              {typeLabel}
            </Badge>
            <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border whitespace-nowrap', touchColor(item.touch_number))}>
              Touch {item.touch_number} of 3
            </Badge>
            {item.lead_source && (
              <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border whitespace-nowrap', getLeadSourceBadgeColor(item.lead_source))}>
                {item.lead_source}
              </Badge>
            )}
            {item.is_legacy && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">Legacy</Badge>
            )}
            {daysSinceTrigger > 0 && (
              <span className="text-[11px] md:text-[10px] text-muted-foreground/70">
                <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                {daysSinceTrigger}d since intro
              </span>
            )}
          </div>

          {/* Row 3: Journey guidance with Done button */}
          <div className="text-[13px] font-medium text-foreground/80 leading-snug bg-amber-50 dark:bg-amber-950/30 rounded-md px-2.5 py-1.5 border border-amber-200 dark:border-amber-800/50 flex items-center gap-2 mt-1.5">
            <span className="flex-1">👉 {guidance}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMarkSent(item);
              }}
              className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-800 hover:bg-amber-300 dark:hover:bg-amber-700 text-amber-900 dark:text-amber-100 transition-colors"
            >
              <Check className="w-3 h-3" />
              Done
            </button>
          </div>
        </div>

        {/* Row 4: Uniform action buttons */}
        <div className="px-3 md:px-2.5 pb-2.5">
          <div className="flex items-center gap-1.5 md:gap-1 py-1">
            <Button variant="outline" size="sm" className="h-9 md:h-7 px-3 md:px-2 text-[13px] md:text-[11px] gap-1.5 md:gap-1 flex-1 md:flex-initial min-w-[44px] min-h-[44px] md:min-h-0" onClick={(e) => { e.stopPropagation(); handleSend(item); }}>
              <MessageSquare className="w-4 h-4 md:w-3.5 md:h-3.5" />
              <span>Script</span>
            </Button>
            <Button variant="outline" size="sm" className="h-9 md:h-7 px-3 md:px-2 text-[13px] md:text-[11px] gap-1.5 md:gap-1 flex-1 md:flex-initial min-w-[44px] min-h-[44px] md:min-h-0" onClick={(e) => {
              e.stopPropagation();
              if (item.phone) {
                navigator.clipboard.writeText(item.phone);
                toast.success('Phone number copied!');
              } else {
                toast.info('No phone number on file');
              }
            }}>
              <Copy className="w-4 h-4 md:w-3.5 md:h-3.5" />
              <span>Copy #</span>
            </Button>
            <Button variant="outline" size="sm" className="h-9 md:h-7 px-3 md:px-2 text-[13px] md:text-[11px] gap-1.5 md:gap-1 flex-1 md:flex-initial min-w-[44px] min-h-[44px] md:min-h-0" onClick={(e) => { e.stopPropagation(); handleSnooze(item); }}>
              <Clock className="w-4 h-4 md:w-3.5 md:h-3.5" />
              <span>Snooze</span>
            </Button>
            <Button variant="outline" size="sm" className="h-9 md:h-7 px-3 md:px-2 text-[13px] md:text-[11px] gap-1.5 md:gap-1 flex-1 md:flex-initial min-w-[44px] min-h-[44px] md:min-h-0" onClick={(e) => { e.stopPropagation(); setPastContactItem(item); }}>
              <History className="w-4 h-4 md:w-3.5 md:h-3.5" />
              <span>Log</span>
            </Button>
          </div>
          {/* Secondary actions */}
          <div className="flex items-center gap-3 mt-0.5">
            <button onClick={() => handleSkip(item)} className="text-[10px] text-muted-foreground hover:text-foreground underline">
              Skip this touch
            </button>
            <button onClick={() => handleRemove(item)} className="text-[10px] text-muted-foreground hover:text-foreground underline">
              Remove
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            Follow-Ups Due
            <SectionHelp text="These people need a follow-up text today. The script is already written for you. Tap Script to review and copy it. If the timing feels off, tap Snooze to push it a couple days." />
            <Badge variant="default" className="ml-1 text-[10px]">{items.length}</Badge>
            {sendableItems.length >= 5 && !batchMode && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto h-6 text-[10px] gap-1"
                onClick={handleBatchStart}
              >
                <Layers className="w-3 h-3" />
                Batch Send
              </Button>
            )}
          </CardTitle>
          {/* Sort & Filter controls */}
          {items.length > 1 && (
            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              <Button
                variant={filterType === 'all' ? 'default' : 'outline'}
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setFilterType('all')}
              >
                All ({items.length})
              </Button>
              <Button
                variant={filterType === 'no_show' ? 'default' : 'outline'}
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setFilterType('no_show')}
              >
                No Show ({noShowCount})
              </Button>
              <Button
                variant={filterType === 'didnt_buy' ? 'default' : 'outline'}
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setFilterType('didnt_buy')}
              >
                Didn't Buy ({didntBuyCount})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2 ml-auto gap-1"
                onClick={() => setSortBy(sortBy === 'date' ? 'type' : 'date')}
              >
                <ArrowUpDown className="w-3 h-3" />
                {sortBy === 'date' ? 'By Date' : 'By Type'}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredItems.map(item => renderFollowUpCard(item))}
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
            if (batchMode) handleBatchNext();
          }}
        />
      )}
      {pastContactItem && (
        <LogPastContactDialog
          open={true}
          onOpenChange={(o) => { if (!o) setPastContactItem(null); }}
          personName={pastContactItem.person_name}
          bookingId={pastContactItem.booking_id}
          leadId={pastContactItem.lead_id}
          onDone={() => {
            setPastContactItem(null);
            fetchQueue();
            onRefresh();
          }}
        />
      )}
    </>
  );
}
