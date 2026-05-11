import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ShiftType } from './ShiftSelector';
import { useShiftStandards, standardKeyOrOther, REFERRAL_ASK_TASK_NAME, type StandardKey } from './standards';
import { ReferralAskRow } from './ReferralAskRow';

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
  standard: StandardKey;
}

interface ShiftTaskListProps {
  shiftType: ShiftType;
}

export function ShiftTaskList({ shiftType }: ShiftTaskListProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<StandardKey, boolean>>({
    s1: false, s2: false, s3: false, s4: false, s5: false, other: false,
  });
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const loadTasks = useCallback(async () => {
    if (!user?.name) return;
    setLoading(true);

    const [templatesRes, overridesRes, completionsRes] = await Promise.all([
      supabase
        .from('shift_task_templates')
        .select('id, task_name, has_count, count_label, task_order')
        .eq('shift_type', shiftType)
        .eq('is_active', true)
        .order('task_order'),
      supabase
        .from('shift_task_overrides')
        .select('id, task_name, has_count, count_label')
        .eq('shift_type', shiftType)
        .eq('active_date', todayStr),
      supabase
        .from('shift_task_completions')
        .select('id, task_template_id, override_id, completed, count_logged')
        .eq('sa_name', user.name)
        .eq('shift_date', todayStr)
        .eq('shift_type', shiftType),
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
        standard: standardForTask(o.task_name),
      });
    });

    templates.forEach((t: any) => {
      const comp = completionMap.get(`template-${t.id}`);
      rows.push({
        key: `template-${t.id}`, name: t.task_name, hasCount: t.has_count,
        countLabel: t.count_label, templateId: t.id, overrideId: null,
        isOverride: false, completed: comp?.completed ?? false,
        countLogged: comp?.count_logged ?? null, completionId: comp?.id ?? null,
        standard: standardForTask(t.task_name),
      });
    });

    setTasks(rows);
    setLoading(false);
  }, [shiftType, user?.name, todayStr]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const findReferralTask = useCallback(
    () => tasks.find(t => t.name === REFERRAL_ASK_TASK_NAME),
    [tasks],
  );

  const toggleTask = async (task: TaskRow) => {
    if (!user?.name) return;
    const newCompleted = !task.completed;

    setTasks(prev => prev.map(t =>
      t.key === task.key ? { ...t, completed: newCompleted } : t
    ));

    if (task.completionId) {
      await supabase
        .from('shift_task_completions')
        .update({
          completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null,
        } as any)
        .eq('id', task.completionId);
    } else {
      const { data } = await supabase
        .from('shift_task_completions')
        .insert({
          sa_name: user.name,
          shift_date: todayStr,
          shift_type: shiftType,
          task_template_id: task.templateId,
          override_id: task.overrideId,
          completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null,
        } as any)
        .select('id')
        .single();
      if (data) {
        setTasks(prev => prev.map(t =>
          t.key === task.key ? { ...t, completionId: (data as any).id } : t
        ));
      }
    }
  };

  // When a referral ask is logged, mark the linked template task as complete.
  const onReferralLogged = useCallback(async () => {
    const t = findReferralTask();
    if (!t || t.completed) return;
    await toggleTask(t);
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
      await supabase.from('daily_outreach_log').update({ [field]: value } as any).eq('id', existing.id);
    } else {
      await supabase.from('daily_outreach_log').insert({ sa_name: user.name, log_date: todayStr, [field]: value } as any);
    }
  };

  const updateCount = async (task: TaskRow, value: number) => {
    if (!user?.name) return;

    setTasks(prev => prev.map(t =>
      t.key === task.key ? { ...t, countLogged: value } : t
    ));

    if (task.completionId) {
      await supabase.from('shift_task_completions').update({ count_logged: value } as any).eq('id', task.completionId);
    } else {
      const { data } = await supabase
        .from('shift_task_completions')
        .insert({
          sa_name: user.name,
          shift_date: todayStr,
          shift_type: shiftType,
          task_template_id: task.templateId,
          override_id: task.overrideId,
          completed: false,
          count_logged: value,
        } as any)
        .select('id')
        .single();
      if (data) {
        setTasks(prev => prev.map(t =>
          t.key === task.key ? { ...t, completionId: (data as any).id } : t
        ));
      }
    }

    syncOutreachCounter(task.countLabel, value);
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground text-center py-8">Loading tasks…</div>;
  }

  // Group by standard
  const grouped = STANDARDS.map(s => ({
    standard: s,
    rows: tasks.filter(t => t.standard === s.key),
  })).filter(g => g.rows.length > 0 || g.standard.key === 's4');
  // s4 always renders so the referral row appears even if no template tasks match.

  const totalDone = tasks.filter(t => t.completed).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          The five standards
        </p>
        <span className="text-xs text-muted-foreground">{totalDone} of {tasks.length} done</span>
      </div>

      {grouped.map(({ standard, rows }) => {
        const isCollapsed = collapsed[standard.key];
        const doneInGroup = rows.filter(r => r.completed).length;
        return (
          <Card key={standard.key} className="overflow-hidden">
            <button
              type="button"
              onClick={() => setCollapsed(p => ({ ...p, [standard.key]: !p[standard.key] }))}
              className="w-full flex items-start justify-between gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
            >
              <p className="text-sm font-medium flex-1">{standard.title}</p>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-muted-foreground">
                  {doneInGroup}/{rows.length}
                </span>
                <ChevronDown className={cn('w-4 h-4 transition-transform', isCollapsed && '-rotate-90')} />
              </div>
            </button>

            {!isCollapsed && (
              <div className="divide-y divide-border border-t border-border">
                {rows.map(task => {
                  // Render the referral ask task as the custom row.
                  if (task.name === REFERRAL_ASK_TASK_NAME) {
                    return (
                      <div key={task.key} className="p-3 bg-muted/20">
                        <ReferralAskRow shiftType={shiftType} onLogged={onReferralLogged} />
                        {task.completed && (
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Marked complete for today
                          </p>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div key={task.key} className="flex items-start gap-3 p-3">
                      <button
                        onClick={() => toggleTask(task)}
                        className={cn(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors cursor-pointer',
                          task.completed
                            ? 'bg-primary border-primary'
                            : 'border-muted-foreground/40 hover:border-primary',
                        )}
                      >
                        {task.completed && <Check className="w-3 h-3 text-primary-foreground" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
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
                            <span className="text-[10px] text-muted-foreground">{task.countLabel || 'Count'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {rows.length === 0 && standard.key === 's4' && (
                  <div className="p-3 bg-muted/20">
                    <ReferralAskRow shiftType={shiftType} onLogged={onReferralLogged} />
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
