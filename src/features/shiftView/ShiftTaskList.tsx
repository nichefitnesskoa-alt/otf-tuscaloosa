import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ShiftType } from './ShiftSelector';

interface TaskRow {
  key: string;
  name: string;
  hasCount: boolean;
  countLabel: string | null;
  countTarget: number | null;
  templateId: string | null;
  overrideId: string | null;
  isOverride: boolean;
  completed: boolean;
  countLogged: number | null;
  completionId: string | null;
}

interface ShiftTaskListProps {
  shiftType: ShiftType;
}

export function ShiftTaskList({ shiftType }: ShiftTaskListProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const loadTasks = useCallback(async () => {
    if (!user?.name) return;
    setLoading(true);

    const [templatesRes, overridesRes, completionsRes] = await Promise.all([
      supabase
        .from('shift_task_templates')
        .select('id, task_name, has_count, count_label, count_target, task_order')
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
        countLabel: o.count_label, countTarget: null, templateId: null, overrideId: o.id,
        isOverride: true, completed: comp?.completed ?? false,
        countLogged: comp?.count_logged ?? null, completionId: comp?.id ?? null,
      });
    });

    templates.forEach((t: any) => {
      const comp = completionMap.get(`template-${t.id}`);
      rows.push({
        key: `template-${t.id}`, name: t.task_name, hasCount: t.has_count,
        countLabel: t.count_label, countTarget: t.count_target ?? null,
        templateId: t.id, overrideId: null,
        isOverride: false, completed: comp?.completed ?? false,
        countLogged: comp?.count_logged ?? null, completionId: comp?.id ?? null,
      });
    });

    setTasks(rows);
    setLoading(false);
  }, [shiftType, user?.name, todayStr]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

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

    setTasks(prev => prev.map(t =>
      t.key === task.key ? { ...t, countLogged: value } : t
    ));

    if (task.completionId) {
      await supabase
        .from('shift_task_completions')
        .update({ count_logged: value } as any)
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

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (loading) {
    return <div className="text-sm text-muted-foreground text-center py-8">Loading tasks…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">{completedCount} of {totalCount} complete</span>
          <span className="text-muted-foreground">{pct}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Section label */}
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Shift duties</p>

      {/* Task card */}
      <Card className="divide-y divide-border">
        {tasks.map((task) => {
          const targetHit = task.countTarget != null && task.countLogged != null && task.countLogged >= task.countTarget;

          return (
            <div
              key={task.key}
              className={cn(
                'flex items-start gap-3 p-3',
                targetHit && 'border-l-2 border-l-green-500'
              )}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggleTask(task)}
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors cursor-pointer',
                  task.completed
                    ? 'bg-primary border-primary'
                    : 'border-muted-foreground/40 hover:border-primary'
                )}
              >
                {task.completed && <Check className="w-3 h-3 text-primary-foreground" />}
              </button>

              {/* Task content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-sm',
                    task.completed && 'line-through text-muted-foreground'
                  )}>
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
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                        if (!isNaN(val)) updateCount(task, val);
                      }}
                      className="h-6 w-16 text-xs px-2"
                    />
                    {task.countTarget != null && (
                      <span className={cn(
                        'text-[10px] font-medium',
                        targetHit ? 'text-green-500' : 'text-muted-foreground'
                      )}>
                        / {task.countTarget}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">{task.countLabel || 'Count'}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {tasks.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground text-center">No tasks for this shift.</div>
        )}
      </Card>
    </div>
  );
}
