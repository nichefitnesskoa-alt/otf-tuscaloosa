import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, Send, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScriptSendDrawer } from '@/components/scripts/ScriptSendDrawer';
import {
  REFERRAL_ASK_TASK_NAME,
  useShiftStandards,
  standardKeyOrOther,
  type StandardKey,
} from '@/features/shiftView/standards';
import { ReferralAskRow } from '@/features/shiftView/ReferralAskRow';
import { EndOfShiftSubmission } from '@/features/shiftView/EndOfShiftSubmission';
import { useAllReferralAsks } from '@/features/shiftView/useReferralAsks';
import type { ShiftType as ShiftViewType } from '@/features/shiftView/ShiftSelector';
import { ShiftOutcomeHeader } from './ShiftOutcomeHeader';
import { ShiftTaskGuidanceIcon } from './ShiftTaskGuidanceIcon';
import { useShiftTaskGuidance } from '@/hooks/useShiftTaskGuidance';

function getScriptCategoryForTask(taskName: string): string[] | null {
  const lower = taskName.toLowerCase();
  if (lower.includes('send ig dm') || lower.includes('send dms')) return ['ig_dm'];
  if (lower.includes('text newest lead') || lower.includes('text leads')) return ['web_lead', 'cold_lead'];
  if (lower.includes('cold lead text') || lower.includes('send cold lead')) return ['cold_lead'];
  return null;
}

const STANDARD_SHIFT: ShiftViewType = 'morning' as ShiftViewType;
const STANDARD_SHIFT_TYPE = 'standard' as const;
type ShiftType = typeof STANDARD_SHIFT_TYPE;

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

const CARD_OPEN_KEY = 'myday_shift_card_open';

export function ShiftChecklist() {
  const { user } = useAuth();
  const { activeStandards } = useShiftStandards();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [todayFollowUpCount, setTodayFollowUpCount] = useState(0);
  const [scriptDrawerOpen, setScriptDrawerOpen] = useState(false);
  const [scriptDrawerCategories, setScriptDrawerCategories] = useState<string[] | null>(null);
  const [cardOpen, setCardOpen] = useState<boolean>(() => {
    try { return sessionStorage.getItem(CARD_OPEN_KEY) === '1'; } catch { return false; }
  });
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { asks: allAsks } = useAllReferralAsks();

  const toggleCard = () => {
    setCardOpen(prev => {
      const next = !prev;
      try { sessionStorage.setItem(CARD_OPEN_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  };

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

  const loadTasks = useCallback(async () => {
    if (!user?.name) return;
    setLoading(true);

    const [templatesRes, overridesRes, completionsRes] = await Promise.all([
      supabase
        .from('shift_task_templates')
        .select('id, task_name, has_count, count_label, task_order, standard_key')
        .eq('shift_type', STANDARD_SHIFT_TYPE)
        .eq('is_active', true)
        .order('task_order'),
      supabase
        .from('shift_task_overrides')
        .select('id, task_name, has_count, count_label, standard_key')
        .eq('shift_type', STANDARD_SHIFT_TYPE)
        .eq('active_date', todayStr),
      supabase
        .from('shift_task_completions')
        .select('id, task_template_id, override_id, completed, count_logged')
        .eq('sa_name', user.name)
        .eq('shift_date', todayStr)
        .eq('shift_type', STANDARD_SHIFT_TYPE),
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
        standard: standardKeyOrOther(o.standard_key),
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
        standard: standardKeyOrOther(t.standard_key),
      });
    });

    setTasks(rows);
    setLoading(false);
  }, [user?.name, todayStr]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const toggleTask = async (task: TaskRow) => {
    if (!user?.name) return;
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
          sa_name: user.name, shift_date: todayStr, shift_type: STANDARD_SHIFT_TYPE,
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
    if (!user?.name) return;

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
          sa_name: user.name, shift_date: todayStr, shift_type: STANDARD_SHIFT_TYPE,
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

  const askedTodayCount = useMemo(() => {
    if (!user?.name) return 0;
    return allAsks.filter(
      a => a.sa_name === user.name && a.shift_date === todayStr,
    ).length;
  }, [allAsks, user?.name, todayStr]);

  const grouped = useMemo(() => {
    return activeStandards.map(s => ({
      standard: s,
      rows: tasks.filter(t => t.standard === s.key),
    }));
  }, [tasks, activeStandards]);

  const totalStandards = useMemo(
    () => activeStandards.filter(s => s.key !== 'other').length,
    [activeStandards],
  );

  const standardsComplete = useMemo(() => {
    let done = 0;
    for (const s of activeStandards) {
      if (s.key === 'other') continue;
      const rows = grouped.find(g => g.standard.key === s.key)?.rows ?? [];
      if (rows.length === 0 && s.key !== 's4') continue;
      const allChecked = rows.every(r => r.completed);
      const s4OK = s.key === 's4' ? askedTodayCount > 0 : true;
      if (allChecked && s4OK) done += 1;
    }
    return done;
  }, [grouped, askedTodayCount, activeStandards]);

  const renderTaskRow = (task: TaskRow) => {
    if (task.name === REFERRAL_ASK_TASK_NAME) {
      return (
        <div key={task.key} className="py-2">
          <ReferralAskRow shiftType={STANDARD_SHIFT} onLogged={onReferralLogged} />
          {task.completed && (
            <p className="text-[10px] text-success mt-2 flex items-center gap-1">
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
            task.completed ? 'bg-success border-success' : 'border-surface-border hover:border-brand',
          )}
        >
          {task.completed && <Check className="w-3 h-3 text-success-foreground" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-sm text-text-primary', task.completed && 'line-through text-text-secondary')}>
              {task.name}
            </span>
            {task.isOverride && (
              <Badge className="text-[9px] h-4 bg-warning-dim text-warning border-warning hover:bg-warning-dim">
                Today only
              </Badge>
            )}
          </div>
          {task.hasCount && (
            <div className="flex items-center gap-2 mt-1.5">
              {task.isFollowUpTask ? (
                <>
                  <span className="text-sm font-medium text-text-primary">{displayCount ?? 0}</span>
                  <span className="text-[10px] text-text-secondary">{task.countLabel}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] px-2 ml-1 cursor-pointer bg-surface-card border-surface-border text-text-primary"
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
                  <span className="text-[10px] text-text-secondary">{task.countLabel}</span>
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
      <div className="bg-brand rounded-xl p-4 space-y-3">
        <button
          type="button"
          onClick={toggleCard}
          className="w-full gap-3 cursor-pointer min-h-[44px] items-center justify-between flex flex-col text-center"
          aria-expanded={cardOpen}
        >
          <p className="text-[13px] font-bold text-brand-foreground uppercase tracking-wider">
            Today's Shift — {format(new Date(), 'EEE MMM d')}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-semibold text-brand-foreground/90">
              {standardsComplete} of {totalStandards} standards
            </span>
            <ChevronDown className={cn('w-5 h-5 text-brand-foreground transition-transform', !cardOpen && '-rotate-90')} />
          </div>
        </button>

        {cardOpen && (
          <div className="bg-surface-card rounded-lg p-3 space-y-3">
            <p className="text-[11px] text-text-secondary">
              {standardsComplete} of {totalStandards} standards complete
            </p>

            {loading ? (
              <p className="text-xs text-muted-foreground text-center py-3">Loading…</p>
            ) : (
              <>
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
                                shiftType={STANDARD_SHIFT}
                                onLogged={onReferralLogged}
                              />
                            </div>
                          )}
                          {rows.length === 0 && standard.key !== 's4' && (
                            <p className="text-[11px] text-muted-foreground italic py-2">
                              No tasks yet for this standard.
                            </p>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>

                <EndOfShiftSubmission shiftType={STANDARD_SHIFT} />
              </>
            )}
          </div>
        )}
      </div>

      <ScriptSendDrawer
        open={scriptDrawerOpen}
        onOpenChange={setScriptDrawerOpen}
        saName={user?.name ?? ''}
        categoryFilter={scriptDrawerCategories}
      />
    </div>
  );
}
