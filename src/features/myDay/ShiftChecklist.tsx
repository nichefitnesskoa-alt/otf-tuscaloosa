import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, Sun, Clock, Sunset, Calendar, ArrowRight, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScriptSendDrawer } from '@/components/scripts/ScriptSendDrawer';
import {
  STANDARDS,
  standardForTask,
  REFERRAL_ASK_TASK_NAME,
  type StandardKey,
} from '@/features/shiftView/standards';
import { ReferralAskRow } from '@/features/shiftView/ReferralAskRow';
import { EndOfShiftSubmission } from '@/features/shiftView/EndOfShiftSubmission';
import { useShiftSubmission } from '@/features/shiftView/useShiftSubmission';
import { useAllReferralAsks } from '@/features/shiftView/useReferralAsks';
import type { ShiftType as ShiftViewType } from '@/features/shiftView/ShiftSelector';

/** Map task names to script category slugs for the Send Script button */
function getScriptCategoryForTask(taskName: string): string[] | null {
  const lower = taskName.toLowerCase();
  if (lower.includes('send ig dm') || lower.includes('send dms')) return ['ig_dm'];
  if (lower.includes('text newest lead') || lower.includes('text leads')) return ['web_lead', 'cold_lead'];
  if (lower.includes('cold lead text') || lower.includes('send cold lead')) return ['cold_lead'];
  return null;
}

type ShiftType = 'morning' | 'mid' | 'last' | 'weekend';

const SHIFTS: { type: ShiftType; label: string; time: string; icon: React.ReactNode }[] = [
  { type: 'morning', label: 'Morning', time: '4:30a–9:30a', icon: <Sun className="w-4 h-4" /> },
  { type: 'mid', label: 'Mid', time: '8:30a–2:30p', icon: <Clock className="w-4 h-4" /> },
  { type: 'last', label: 'Last', time: '1:30p–6:30p', icon: <Sunset className="w-4 h-4" /> },
  { type: 'weekend', label: 'Weekend', time: 'All day', icon: <Calendar className="w-4 h-4" /> },
];

interface TaskRow {
  key: string;
  name: string;
  hasCount: boolean;
  countLabel: string | null;
  templateId: string | null;
  overrideId: string | null;
  isOverride: boolean;
  completed: boolean;
  countLogged: number | null;
  completionId: string | null;
  isFollowUpTask: boolean;
  standard: StandardKey;
}

const HEADER_QUESTIONS: {
  key: 'lead_forward_answer' | 'member_experience_answer' | 'ownership_lane_answer';
  q: string;
}[] = [
  { key: 'lead_forward_answer', q: 'How did you move a new lead forward today?' },
  { key: 'member_experience_answer', q: "How did you impact a member's experience?" },
  { key: 'ownership_lane_answer', q: 'What did you do in your ownership lane?' },
];

function ShiftReflectionHeader({ shiftType }: { shiftType: ShiftType }) {
  const { user } = useAuth();
  const { data } = useShiftSubmission(user?.name, shiftType as ShiftViewType);

  const scrollToCloseOut = () => {
    document.getElementById('end-of-shift')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Card className="border-primary/30 p-3 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Three questions you'll answer at end of shift
      </p>
      <div className="space-y-1.5">
        {HEADER_QUESTIONS.map(({ key, q }) => {
          const ans = (data[key] || '').trim();
          return (
            <button
              key={key}
              type="button"
              onClick={scrollToCloseOut}
              className="w-full text-left flex items-start gap-2 py-1 px-1 rounded hover:bg-muted/30 transition-colors cursor-pointer"
            >
              <span className="text-[11px] font-medium text-foreground/80 shrink-0 mt-0.5">·</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[11px] text-muted-foreground">{q}</span>
                <span
                  className={cn(
                    'block text-xs mt-0.5 truncate',
                    ans ? 'text-foreground' : 'text-muted-foreground/60 italic',
                  )}
                >
                  {ans || '—'}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground italic pt-1 border-t border-border/50">
        Log the real number. We can work with honest. We can't work with hidden.
      </p>
    </Card>
  );
}

export function ShiftChecklist() {
  const { user } = useAuth();
  const [selectedShift, setSelectedShift] = useState<ShiftType | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [todayFollowUpCount, setTodayFollowUpCount] = useState(0);
  const [scriptDrawerOpen, setScriptDrawerOpen] = useState(false);
  const [scriptDrawerCategories, setScriptDrawerCategories] = useState<string[] | null>(null);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { asks: allAsks } = useAllReferralAsks();

  // Fetch today's follow-up touches count
  const fetchFollowUpCount = useCallback(async () => {
    if (!user?.name) return;
    const todayStart = `${todayStr}T00:00:00`;
    const { count } = await supabase
      .from('followup_touches')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', user.name)
      .gte('created_at', todayStart);
    setTodayFollowUpCount(count || 0);
  }, [user?.name, todayStr]);

  useEffect(() => { fetchFollowUpCount(); }, [fetchFollowUpCount]);

  useEffect(() => {
    const handler = () => fetchFollowUpCount();
    window.addEventListener('followup:touch-logged', handler);
    return () => window.removeEventListener('followup:touch-logged', handler);
  }, [fetchFollowUpCount]);

  const loadTasks = useCallback(async (shift: ShiftType) => {
    if (!user?.name) return;
    setLoading(true);

    const [templatesRes, overridesRes, completionsRes] = await Promise.all([
      supabase
        .from('shift_task_templates')
        .select('id, task_name, has_count, count_label, task_order')
        .eq('shift_type', shift)
        .eq('is_active', true)
        .order('task_order'),
      supabase
        .from('shift_task_overrides')
        .select('id, task_name, has_count, count_label')
        .eq('shift_type', shift)
        .eq('active_date', todayStr),
      supabase
        .from('shift_task_completions')
        .select('id, task_template_id, override_id, completed, count_logged')
        .eq('sa_name', user.name)
        .eq('shift_date', todayStr)
        .eq('shift_type', shift),
    ]);

    const templates = (templatesRes.data || []) as any[];
    const overrides = (overridesRes.data || []) as any[];
    const completions = (completionsRes.data || []) as any[];

    const completionMap = new Map<string, any>();
    completions.forEach((c: any) => {
      if (c.override_id) completionMap.set(`override-${c.override_id}`, c);
      else if (c.task_template_id) completionMap.set(`template-${c.task_template_id}`, c);
    });

    const rows: TaskRow[] = [];

    overrides.forEach((o: any) => {
      const comp = completionMap.get(`override-${o.id}`);
      rows.push({
        key: `override-${o.id}`, name: o.task_name, hasCount: o.has_count,
        countLabel: o.count_label, templateId: null, overrideId: o.id,
        isOverride: true, completed: comp?.completed ?? false,
        countLogged: comp?.count_logged ?? null, completionId: comp?.id ?? null,
        isFollowUpTask: false,
        standard: standardForTask(o.task_name),
      });
    });

    templates.forEach((t: any) => {
      const comp = completionMap.get(`template-${t.id}`);
      const isFollowUp = (t.count_label || '').toLowerCase().trim() === 'follow-ups done';
      rows.push({
        key: `template-${t.id}`, name: t.task_name, hasCount: t.has_count,
        countLabel: t.count_label,
        templateId: t.id, overrideId: null,
        isOverride: false, completed: comp?.completed ?? false,
        countLogged: comp?.count_logged ?? null, completionId: comp?.id ?? null,
        isFollowUpTask: isFollowUp,
        standard: standardForTask(t.task_name),
      });
    });

    setTasks(rows);
    setLoading(false);
  }, [user?.name, todayStr]);

  useEffect(() => {
    if (selectedShift) loadTasks(selectedShift);
  }, [selectedShift, loadTasks]);

  useEffect(() => {
    const handleReset = () => {
      setSelectedShift(null);
      setTasks([]);
    };
    window.addEventListener('shift:reset', handleReset);
    return () => window.removeEventListener('shift:reset', handleReset);
  }, []);

  const toggleTask = async (task: TaskRow) => {
    if (!user?.name || !selectedShift) return;
    const newCompleted = !task.completed;

    setTasks(prev => prev.map(t => t.key === task.key ? { ...t, completed: newCompleted } : t));

    if (task.completionId) {
      await supabase
        .from('shift_task_completions')
        .update({ completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null } as any)
        .eq('id', task.completionId);
    } else {
      const { data } = await supabase
        .from('shift_task_completions')
        .insert({
          sa_name: user.name, shift_date: todayStr, shift_type: selectedShift,
          task_template_id: task.templateId, override_id: task.overrideId,
          completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null,
        } as any)
        .select('id')
        .single();
      if (data) {
        setTasks(prev => prev.map(t => t.key === task.key ? { ...t, completionId: (data as any).id } : t));
      }
    }
  };

  const findReferralTask = useCallback(
    () => tasks.find(t => t.name === REFERRAL_ASK_TASK_NAME),
    [tasks],
  );

  // When a referral ask is logged, mark the linked template task as complete.
  const onReferralLogged = useCallback(async () => {
    const t = findReferralTask();
    if (!t || t.completed) return;
    await toggleTask(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findReferralTask]);

  const syncOutreachCounter = async (countLabel: string | null, value: number) => {
    if (!user?.name || !countLabel) return;
    const label = countLabel.toLowerCase().trim();
    const isDms = label === 'dms sent';
    const isTexts = label === 'texts sent';
    if (!isDms && !isTexts) return;

    const field = isDms ? 'cold_dms_sent' : 'cold_texts_sent';

    const { data: existing } = await supabase
      .from('daily_outreach_log')
      .select('id')
      .eq('sa_name', user.name)
      .eq('log_date', todayStr)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('daily_outreach_log')
        .update({ [field]: value } as any)
        .eq('id', existing.id);
    } else {
      await supabase
        .from('daily_outreach_log')
        .insert({ sa_name: user.name, log_date: todayStr, [field]: value } as any);
    }
  };

  const updateCount = async (task: TaskRow, value: number) => {
    if (!user?.name || !selectedShift) return;

    setTasks(prev => prev.map(t => t.key === task.key ? { ...t, countLogged: value } : t));

    if (task.completionId) {
      await supabase
        .from('shift_task_completions')
        .update({ count_logged: value } as any)
        .eq('id', task.completionId);
    } else {
      const { data } = await supabase
        .from('shift_task_completions')
        .insert({
          sa_name: user.name, shift_date: todayStr, shift_type: selectedShift,
          task_template_id: task.templateId, override_id: task.overrideId,
          completed: false, count_logged: value,
        } as any)
        .select('id')
        .single();
      if (data) {
        setTasks(prev => prev.map(t => t.key === task.key ? { ...t, completionId: (data as any).id } : t));
      }
    }

    syncOutreachCounter(task.countLabel, value);
  };

  const navigateToFollowUp = () => {
    window.dispatchEvent(new CustomEvent('myday:switch-tab', { detail: { tab: 'followups' } }));
  };

  const openScriptDrawer = (categories: string[]) => {
    setScriptDrawerCategories(categories);
    setScriptDrawerOpen(true);
  };

  // Did this SA log any referral ask today?
  const askedTodayCount = useMemo(() => {
    if (!user?.name) return 0;
    return allAsks.filter(
      a => a.sa_name === user.name && a.shift_date === todayStr,
    ).length;
  }, [allAsks, user?.name, todayStr]);

  // Standards completion: every task in standard checked. For s4, also requires
  // at least one referral ask logged today (the referral row drives that side).
  const grouped = useMemo(() => {
    return STANDARDS.map(s => ({
      standard: s,
      rows: tasks.filter(t => t.standard === s.key),
    }));
  }, [tasks]);

  const standardsComplete = useMemo(() => {
    let done = 0;
    for (const s of STANDARDS) {
      if (s.key === 'other') continue;
      const rows = grouped.find(g => g.standard.key === s.key)?.rows ?? [];
      // Skip empty standards (treat as not-complete to avoid silent 5/5)
      if (rows.length === 0 && s.key !== 's4') continue;
      const allChecked = rows.every(r => r.completed);
      const s4OK = s.key === 's4' ? askedTodayCount > 0 : true;
      if (allChecked && s4OK) done += 1;
    }
    return done;
  }, [grouped, askedTodayCount]);

  const renderTaskRow = (task: TaskRow) => {
    if (task.name === REFERRAL_ASK_TASK_NAME) {
      return (
        <div key={task.key} className="py-2">
          <ReferralAskRow shiftType={selectedShift as ShiftViewType} onLogged={onReferralLogged} />
          {task.completed && (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1">
              <Check className="w-3 h-3" /> Marked complete for today
            </p>
          )}
        </div>
      );
    }
    const displayCount = task.isFollowUpTask ? todayFollowUpCount : task.countLogged;
    const cats = getScriptCategoryForTask(task.name);
    return (
      <div key={task.key} className="flex items-start gap-3 py-2.5">
        <button
          onClick={() => toggleTask(task)}
          className={cn(
            'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors cursor-pointer',
            task.completed ? 'bg-primary border-primary' : 'border-muted-foreground/40 hover:border-primary',
          )}
        >
          {task.completed && <Check className="w-3 h-3 text-primary-foreground" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-sm', task.completed && 'line-through text-muted-foreground')}>
              {task.name}
            </span>
            {task.isOverride && (
              <Badge className="text-[9px] h-4 bg-warning/20 text-warning border-warning/30 hover:bg-warning/20">
                Today only
              </Badge>
            )}
          </div>
          {task.hasCount && (
            <div className="flex items-center gap-2 mt-1.5">
              {task.isFollowUpTask ? (
                <>
                  <span className="text-sm font-medium text-foreground">{displayCount ?? 0}</span>
                  <span className="text-[10px] text-muted-foreground">{task.countLabel}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] px-2 ml-1 cursor-pointer"
                    onClick={navigateToFollowUp}
                  >
                    Open Follow-Up Queue <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    type="number"
                    min={0}
                    value={task.countLogged ?? ''}
                    onChange={e => {
                      const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                      if (!isNaN(val)) updateCount(task, val);
                    }}
                    className="h-7 w-16 text-xs px-2"
                  />
                  <span className="text-[10px] text-muted-foreground">{task.countLabel}</span>
                </>
              )}
            </div>
          )}
        </div>
        {cats && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-[11px] px-2 shrink-0 mt-0.5 cursor-pointer gap-1 min-h-[44px]"
            onClick={() => openScriptDrawer(cats)}
          >
            <Send className="w-3.5 h-3.5" />
            Send Script
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {!selectedShift ? (
        <div className="bg-[#E8540A] rounded-xl p-4">
          <p className="text-[13px] font-bold text-white uppercase tracking-wider mb-3">
            SELECT YOUR SHIFT — LOADS YOUR RESPONSIBILITIES
          </p>
          <div className="grid grid-cols-4 gap-2">
            {SHIFTS.map(s => (
              <Button
                key={s.type}
                variant="outline"
                className="flex flex-col items-center gap-1 h-auto py-3 text-xs bg-card border-white/20 hover:bg-card/80 hover:border-white/40"
                onClick={() => setSelectedShift(s.type)}
              >
                <span className="text-primary">{s.icon}</span>
                <span className="font-semibold">{s.label}</span>
                <span className="text-[9px] text-muted-foreground">{s.time}</span>
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-[#E8540A] rounded-xl p-4 space-y-3">
          {/* Shift header on orange */}
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-bold text-white uppercase tracking-wider">
              {SHIFTS.find(s => s.type === selectedShift)?.label} Shift — Your responsibilities are loaded
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-[11px] px-3 border-white text-white bg-transparent hover:bg-white/10"
              onClick={() => setSelectedShift(null)}
            >
              Change
            </Button>
          </div>

          {/* Inner dark zone */}
          <div className="bg-card rounded-lg p-3 space-y-3">
            {/* Zone 1 — sticky reflection header */}
            <div className="sticky top-2 z-10">
              <ShiftReflectionHeader shiftType={selectedShift} />
            </div>

            {/* Standards-complete indicator */}
            <p className="text-[11px] text-muted-foreground">
              {standardsComplete} of 5 standards complete
            </p>

            {loading ? (
              <p className="text-xs text-muted-foreground text-center py-3">Loading…</p>
            ) : (
              <>
                {/* Zone 2 — five standard cards */}
                <div className="space-y-3">
                  {grouped.map(({ standard, rows }) => {
                    if (standard.key === 'other' && rows.length === 0) return null;
                    return (
                      <Card key={standard.key} className="p-3">
                        <p className="text-sm font-bold mb-2">{standard.title}</p>
                        <div className="divide-y divide-border">
                          {rows.map(renderTaskRow)}
                          {rows.length === 0 && standard.key === 's4' && (
                            <div className="py-2">
                              <ReferralAskRow
                                shiftType={selectedShift as ShiftViewType}
                                onLogged={onReferralLogged}
                              />
                            </div>
                          )}
                          {rows.length === 0 && standard.key !== 's4' && (
                            <p className="text-[11px] text-muted-foreground italic py-2">
                              No tasks loaded for this standard.
                            </p>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>

                {/* Zone 3 — close out card */}
                <EndOfShiftSubmission shiftType={selectedShift as ShiftViewType} />
              </>
            )}
          </div>
        </div>
      )}

      {/* Script Send Drawer for shift tasks */}
      <ScriptSendDrawer
        open={scriptDrawerOpen}
        onOpenChange={setScriptDrawerOpen}
        categoryFilter={scriptDrawerCategories}
        saName={user?.name || 'Unknown'}
      />
    </div>
  );
}
