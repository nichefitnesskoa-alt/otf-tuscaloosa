import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, Sun, Clock, Sunset, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CollapsibleSection } from '@/components/dashboard/CollapsibleSection';

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
}

export function ShiftChecklist() {
  const { user } = useAuth();
  const [selectedShift, setSelectedShift] = useState<ShiftType | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(false);
  const todayStr = format(new Date(), 'yyyy-MM-dd');

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
      });
    });

    templates.forEach((t: any) => {
      const comp = completionMap.get(`template-${t.id}`);
      rows.push({
        key: `template-${t.id}`, name: t.task_name, hasCount: t.has_count,
        countLabel: t.count_label, templateId: t.id, overrideId: null,
        isOverride: false, completed: comp?.completed ?? false,
        countLogged: comp?.count_logged ?? null, completionId: comp?.id ?? null,
      });
    });

    setTasks(rows);
    setLoading(false);
  }, [user?.name, todayStr]);

  useEffect(() => {
    if (selectedShift) loadTasks(selectedShift);
  }, [selectedShift, loadTasks]);

  // Listen for shift reset event from End Shift button
  useEffect(() => {
    const handleReset = () => {
      setSelectedShift(null);
      setTasks([]);
    };
    window.addEventListener('shift:reset', handleReset);
    return () => window.removeEventListener('shift:reset', handleReset);
  }, []);

  const handleSelectShift = (shift: ShiftType) => {
    setSelectedShift(shift);
  };

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
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Shift selector */}
      {!selectedShift ? (
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Select your shift</p>
            <div className="grid grid-cols-4 gap-2">
              {SHIFTS.map(s => (
                <Button
                  key={s.type}
                  variant="outline"
                  className="flex flex-col items-center gap-1 h-auto py-3 text-xs"
                  onClick={() => handleSelectShift(s.type)}
                >
                  <span className="text-primary">{s.icon}</span>
                  <span className="font-semibold">{s.label}</span>
                  <span className="text-[9px] text-muted-foreground">{s.time}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-3 space-y-3">
            {/* Shift header */}
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Shift duties</p>
              <div className="flex items-center gap-2">
                <Badge className="bg-primary text-primary-foreground hover:bg-primary text-[10px] px-2 py-0.5">
                  {SHIFTS.find(s => s.type === selectedShift)?.label}
                </Badge>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setSelectedShift(null)}>
                  Change
                </Button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-medium">{completedCount} of {totalCount} complete</span>
                <span className="text-muted-foreground">{pct}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
            </div>

            {/* Task list */}
            {loading ? (
              <p className="text-xs text-muted-foreground text-center py-3">Loading…</p>
            ) : (
              <div className="divide-y divide-border">
                {tasks.map(task => (
                  <div key={task.key} className="flex items-start gap-3 py-2.5">
                    <button
                      onClick={() => toggleTask(task)}
                      className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors',
                        task.completed ? 'bg-primary border-primary' : 'border-muted-foreground/40 hover:border-primary'
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
                          <Badge className="text-[9px] h-4 bg-warning/20 text-warning border-warning/30 hover:bg-warning/20">Today only</Badge>
                        )}
                      </div>
                      {task.hasCount && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground">{task.countLabel || 'Count'}:</span>
                          <Input
                            type="number"
                            min={0}
                            value={task.countLogged ?? ''}
                            onChange={e => {
                              const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                              if (!isNaN(val)) updateCount(task, val);
                            }}
                            className="h-6 w-16 text-xs px-2"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {tasks.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">No tasks for this shift.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
