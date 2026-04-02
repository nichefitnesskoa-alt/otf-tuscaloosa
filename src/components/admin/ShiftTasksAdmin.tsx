import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUp, ArrowDown, Pencil, Trash2, Plus, Calendar, ListChecks } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

type ShiftType = 'morning' | 'mid' | 'last' | 'weekend';

interface TaskTemplate {
  id: string;
  shift_type: string;
  task_order: number;
  task_name: string;
  has_count: boolean;
  count_label: string | null;
  is_active: boolean;
}

interface TaskOverride {
  id: string;
  shift_type: string;
  active_date: string;
  task_name: string;
  has_count: boolean;
  count_label: string | null;
  created_by: string;
  created_at: string;
}

function TaskTemplateManager({ shiftType }: { shiftType: ShiftType }) {
  const [tasks, setTasks] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editHasCount, setEditHasCount] = useState(false);
  const [editCountLabel, setEditCountLabel] = useState('');

  // New task form
  const [newName, setNewName] = useState('');
  const [newHasCount, setNewHasCount] = useState(false);
  const [newCountLabel, setNewCountLabel] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('shift_task_templates')
      .select('*')
      .eq('shift_type', shiftType)
      .order('task_order');
    setTasks((data as any[]) || []);
    setLoading(false);
  }, [shiftType]);

  useEffect(() => { load(); }, [load]);

  const handleReorder = async (idx: number, dir: -1 | 1) => {
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= tasks.length) return;
    const a = tasks[idx];
    const b = tasks[swapIdx];
    await Promise.all([
      supabase.from('shift_task_templates').update({ task_order: b.task_order } as any).eq('id', a.id),
      supabase.from('shift_task_templates').update({ task_order: a.task_order } as any).eq('id', b.id),
    ]);
    load();
  };

  const handleToggleActive = async (task: TaskTemplate) => {
    await supabase.from('shift_task_templates').update({ is_active: !task.is_active } as any).eq('id', task.id);
    load();
  };

  const handleStartEdit = (task: TaskTemplate) => {
    setEditId(task.id);
    setEditName(task.task_name);
    setEditHasCount(task.has_count);
    setEditCountLabel(task.count_label || '');
  };

  const handleSaveEdit = async () => {
    if (!editId || !editName.trim()) return;
    await supabase.from('shift_task_templates').update({
      task_name: editName.trim(),
      has_count: editHasCount,
      count_label: editHasCount ? editCountLabel.trim() || null : null,
    } as any).eq('id', editId);
    setEditId(null);
    load();
    toast.success('Task updated');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    await supabase.from('shift_task_templates').delete().eq('id', id);
    load();
    toast.success('Task deleted');
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.task_order)) : 0;
    await supabase.from('shift_task_templates').insert({
      shift_type: shiftType,
      task_order: maxOrder + 1,
      task_name: newName.trim(),
      has_count: newHasCount,
      count_label: newHasCount ? newCountLabel.trim() || null : null,
    } as any);
    setNewName('');
    setNewHasCount(false);
    setNewCountLabel('');
    load();
    toast.success('Task added');
  };

  if (loading) return <div className="text-sm text-muted-foreground py-4">Loading…</div>;

  return (
    <div className="space-y-3">
      {tasks.map((task, idx) => (
        <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
          <div className="flex flex-col gap-0.5">
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleReorder(idx, -1)} disabled={idx === 0}>
              <ArrowUp className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleReorder(idx, 1)} disabled={idx === tasks.length - 1}>
              <ArrowDown className="w-3 h-3" />
            </Button>
          </div>

          <div className="flex-1 min-w-0">
            {editId === task.id ? (
              <div className="space-y-2">
                <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-7 text-xs" />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">Has count:</span>
                  <Switch checked={editHasCount} onCheckedChange={setEditHasCount} />
                </div>
                {editHasCount && (
                  <Input value={editCountLabel} onChange={e => setEditCountLabel(e.target.value)} placeholder="Count label" className="h-7 text-xs" />
                )}
                <div className="flex gap-1">
                  <Button size="sm" className="h-6 text-xs" onClick={handleSaveEdit}>Save</Button>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditId(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div>
                <span className={`text-sm ${!task.is_active ? 'line-through text-muted-foreground' : ''}`}>{task.task_name}</span>
                {task.has_count && (
                  <span className="text-[10px] text-muted-foreground ml-2">({task.count_label})</span>
                )}
              </div>
            )}
          </div>

          <Switch checked={task.is_active} onCheckedChange={() => handleToggleActive(task)} />
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleStartEdit(task)}>
            <Pencil className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(task.id)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}

      {/* Add new task */}
      <Card className="border-dashed">
        <CardContent className="p-3 space-y-2">
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New task name" className="h-8 text-sm" />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Has count:</span>
              <Switch checked={newHasCount} onCheckedChange={setNewHasCount} />
            </div>
            {newHasCount && (
              <Input value={newCountLabel} onChange={e => setNewCountLabel(e.target.value)} placeholder="Count label" className="h-7 text-xs w-32" />
            )}
            <Button size="sm" className="h-7 ml-auto" onClick={handleAdd} disabled={!newName.trim()}>
              <Plus className="w-3 h-3 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TodayOnlyTasksManager() {
  const { user } = useAuth();
  const [overrides, setOverrides] = useState<TaskOverride[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formShift, setFormShift] = useState<ShiftType>('morning');
  const [formName, setFormName] = useState('');
  const [formHasCount, setFormHasCount] = useState(false);
  const [formCountLabel, setFormCountLabel] = useState('');
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('shift_task_overrides')
      .select('*')
      .gte('active_date', format(new Date(), 'yyyy-MM-dd'))
      .order('active_date')
      .order('created_at');
    setOverrides((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!formName.trim() || !user?.name) return;
    await supabase.from('shift_task_overrides').insert({
      shift_type: formShift,
      active_date: formDate,
      task_name: formName.trim(),
      has_count: formHasCount,
      count_label: formHasCount ? formCountLabel.trim() || null : null,
      created_by: user.name,
    } as any);
    setFormName('');
    setFormHasCount(false);
    setFormCountLabel('');
    load();
    toast.success('Override added');
  };

  const handleDelete = async (id: string) => {
    await supabase.from('shift_task_overrides').delete().eq('id', id);
    load();
    toast.success('Override removed');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Add Today-Only Task
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-xs text-muted-foreground">Shift</span>
              <Select value={formShift} onValueChange={v => setFormShift(v as ShiftType)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="mid">Mid</SelectItem>
                  <SelectItem value="last">Last</SelectItem>
                  <SelectItem value="weekend">Weekend</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Date</span>
              <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Task name" className="h-8 text-sm" />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Has count:</span>
              <Switch checked={formHasCount} onCheckedChange={setFormHasCount} />
            </div>
            {formHasCount && (
              <Input value={formCountLabel} onChange={e => setFormCountLabel(e.target.value)} placeholder="Count label" className="h-7 text-xs w-32" />
            )}
          </div>
          <Button size="sm" onClick={handleAdd} disabled={!formName.trim()}>
            <Plus className="w-3 h-3 mr-1" /> Add Override
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Upcoming Overrides</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : overrides.length === 0 ? (
            <p className="text-xs text-muted-foreground">No upcoming overrides.</p>
          ) : (
            <div className="space-y-1.5">
              {overrides.map(o => (
                <div key={o.id} className="flex items-center justify-between p-2 rounded border text-xs">
                  <div>
                    <span className="font-medium">{o.task_name}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[9px] h-4">{o.shift_type}</Badge>
                      <span className="text-muted-foreground">{o.active_date}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(o.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ShiftTasksAdmin() {
  const [section, setSection] = useState<'templates' | 'overrides'>('templates');
  const [shiftTab, setShiftTab] = useState<ShiftType>('morning');

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant={section === 'templates' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSection('templates')}
        >
          <ListChecks className="w-3.5 h-3.5 mr-1" /> Shift Tasks
        </Button>
        <Button
          variant={section === 'overrides' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSection('overrides')}
        >
          <Calendar className="w-3.5 h-3.5 mr-1" /> Today-Only Tasks
        </Button>
      </div>

      {section === 'templates' ? (
        <>
          <Tabs value={shiftTab} onValueChange={v => setShiftTab(v as ShiftType)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="morning">Morning</TabsTrigger>
              <TabsTrigger value="mid">Mid</TabsTrigger>
              <TabsTrigger value="last">Last</TabsTrigger>
              <TabsTrigger value="weekend">Weekend</TabsTrigger>
            </TabsList>
            <TabsContent value="morning"><TaskTemplateManager shiftType="morning" /></TabsContent>
            <TabsContent value="mid"><TaskTemplateManager shiftType="mid" /></TabsContent>
            <TabsContent value="last"><TaskTemplateManager shiftType="last" /></TabsContent>
            <TabsContent value="weekend"><TaskTemplateManager shiftType="weekend" /></TabsContent>
          </Tabs>
        </>
      ) : (
        <TodayOnlyTasksManager />
      )}
    </div>
  );
}
