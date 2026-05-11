import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUp, ArrowDown, Pencil, Trash2, Plus, Calendar, ListChecks, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useShiftStandards } from '@/features/shiftView/standards';

const STANDARD_SHIFT = 'standard';

interface TaskTemplate {
  id: string;
  shift_type: string;
  task_order: number;
  task_name: string;
  has_count: boolean;
  count_label: string | null;
  count_target: number | null;
  is_active: boolean;
  standard_key: string | null;
}

interface TaskOverride {
  id: string;
  shift_type: string;
  active_date: string;
  task_name: string;
  has_count: boolean;
  count_label: string | null;
  standard_key: string | null;
  created_by: string;
  created_at: string;
}

function StandardSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { standards } = useShiftStandards();
  return (
    <Select value={value || 'other'} onValueChange={onChange}>
      <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="Standard" /></SelectTrigger>
      <SelectContent>
        {standards.map(s => (
          <SelectItem key={s.key} value={s.key} className="text-xs">
            {s.key.toUpperCase()} — {s.title.slice(0, 60)}{s.title.length > 60 ? '…' : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StandardsManager() {
  const { user } = useAuth();
  const { standards, refresh } = useShiftStandards();
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newTitle, setNewTitle] = useState('');

  const ordered = [...standards].sort((a, b) => a.display_order - b.display_order);

  const reorder = async (idx: number, dir: -1 | 1) => {
    const swap = idx + dir;
    if (swap < 0 || swap >= ordered.length) return;
    const a = ordered[idx];
    const b = ordered[swap];
    await Promise.all([
      supabase.from('shift_standards' as any).update({ display_order: b.display_order } as any).eq('key', a.key),
      supabase.from('shift_standards' as any).update({ display_order: a.display_order } as any).eq('key', b.key),
    ]);
    refresh();
  };

  const toggleActive = async (key: string, val: boolean) => {
    await supabase.from('shift_standards' as any).update({ is_active: val } as any).eq('key', key);
    refresh();
  };

  const startEdit = (key: string, title: string) => { setEditId(key); setEditTitle(title); };
  const saveEdit = async () => {
    if (!editId || !editTitle.trim()) return;
    await supabase.from('shift_standards' as any).update({ title: editTitle.trim() } as any).eq('key', editId);
    setEditId(null);
    refresh();
    toast.success('Standard updated');
  };

  const handleDelete = async (key: string) => {
    if (!confirm('Delete this standard? Tasks assigned to it will fall into "Other".')) return;
    await supabase.from('shift_standards' as any).delete().eq('key', key);
    refresh();
    toast.success('Standard deleted');
  };

  const handleAdd = async () => {
    const key = newKey.trim().toLowerCase();
    if (!key || !newTitle.trim()) return;
    const maxOrder = ordered.length ? Math.max(...ordered.map(s => s.display_order)) : 0;
    await supabase.from('shift_standards' as any).insert({
      key,
      title: newTitle.trim(),
      display_order: maxOrder + 1,
      is_active: true,
      created_by: user?.name ?? 'admin',
    } as any);
    setNewKey('');
    setNewTitle('');
    refresh();
    toast.success('Standard added');
  };

  return (
    <div className="space-y-3">
      {ordered.map((s, idx) => (
        <div key={s.key} className="flex items-start gap-2 p-2 rounded-lg border bg-card">
          <div className="flex flex-col gap-0.5">
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => reorder(idx, -1)} disabled={idx === 0}>
              <ArrowUp className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => reorder(idx, 1)} disabled={idx === ordered.length - 1}>
              <ArrowDown className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] h-4">{s.key}</Badge>
              {!s.is_active && <Badge className="text-[9px] h-4">inactive</Badge>}
            </div>
            {editId === s.key ? (
              <div className="flex gap-1 mt-1">
                <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="h-7 text-xs" />
                <Button size="sm" className="h-7 text-xs" onClick={saveEdit}>Save</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditId(null)}>Cancel</Button>
              </div>
            ) : (
              <p className={`text-sm mt-0.5 ${!s.is_active ? 'text-muted-foreground line-through' : ''}`}>{s.title}</p>
            )}
          </div>
          <Switch checked={s.is_active} onCheckedChange={v => toggleActive(s.key, v)} />
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(s.key, s.title)}>
            <Pencil className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(s.key)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}

      <Card className="border-dashed">
        <CardContent className="p-3 space-y-2">
          <div className="flex gap-2">
            <Input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="key (e.g. s6)" className="h-8 text-xs w-24" />
            <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Standard title" className="h-8 text-sm flex-1" />
            <Button size="sm" className="h-8" onClick={handleAdd} disabled={!newKey.trim() || !newTitle.trim()}>
              <Plus className="w-3 h-3 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TaskTemplateManager() {
  const [tasks, setTasks] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editHasCount, setEditHasCount] = useState(false);
  const [editCountLabel, setEditCountLabel] = useState('');
  const [editCountTarget, setEditCountTarget] = useState('');
  const [editStandard, setEditStandard] = useState('other');

  const [newName, setNewName] = useState('');
  const [newHasCount, setNewHasCount] = useState(false);
  const [newCountLabel, setNewCountLabel] = useState('');
  const [newCountTarget, setNewCountTarget] = useState('');
  const [newStandard, setNewStandard] = useState('other');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('shift_task_templates')
      .select('*')
      .eq('shift_type', STANDARD_SHIFT)
      .order('task_order');
    setTasks((data as any[]) || []);
    setLoading(false);
  }, []);

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

  const handleStandardChange = async (task: TaskTemplate, key: string) => {
    await supabase.from('shift_task_templates').update({ standard_key: key } as any).eq('id', task.id);
    load();
  };

  const handleStartEdit = (task: TaskTemplate) => {
    setEditId(task.id);
    setEditName(task.task_name);
    setEditHasCount(task.has_count);
    setEditCountLabel(task.count_label || '');
    setEditCountTarget(task.count_target != null ? String(task.count_target) : '');
    setEditStandard(task.standard_key || 'other');
  };

  const handleSaveEdit = async () => {
    if (!editId || !editName.trim()) return;
    const target = editCountTarget.trim() ? parseInt(editCountTarget) : null;
    await supabase.from('shift_task_templates').update({
      task_name: editName.trim(),
      has_count: editHasCount,
      count_label: editHasCount ? editCountLabel.trim() || null : null,
      count_target: editHasCount ? (isNaN(target as any) ? null : target) : null,
      standard_key: editStandard,
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
    const target = newCountTarget.trim() ? parseInt(newCountTarget) : null;
    await supabase.from('shift_task_templates').insert({
      shift_type: STANDARD_SHIFT,
      task_order: maxOrder + 1,
      task_name: newName.trim(),
      has_count: newHasCount,
      count_label: newHasCount ? newCountLabel.trim() || null : null,
      count_target: newHasCount ? (isNaN(target as any) ? null : target) : null,
      standard_key: newStandard,
    } as any);
    setNewName('');
    setNewHasCount(false);
    setNewCountLabel('');
    setNewCountTarget('');
    setNewStandard('other');
    load();
    toast.success('Task added');
  };

  if (loading) return <div className="text-sm text-muted-foreground py-4">Loading…</div>;

  return (
    <div className="space-y-3">
      {tasks.map((task, idx) => (
        <div key={task.id} className="flex items-start gap-2 p-2 rounded-lg border bg-card">
          <div className="flex flex-col gap-0.5">
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleReorder(idx, -1)} disabled={idx === 0}>
              <ArrowUp className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleReorder(idx, 1)} disabled={idx === tasks.length - 1}>
              <ArrowDown className="w-3 h-3" />
            </Button>
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            {editId === task.id ? (
              <div className="space-y-2">
                <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-7 text-xs" />
                <StandardSelect value={editStandard} onChange={setEditStandard} />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">Has count:</span>
                  <Switch checked={editHasCount} onCheckedChange={setEditHasCount} />
                </div>
                {editHasCount && (
                  <div className="flex gap-2">
                    <Input value={editCountLabel} onChange={e => setEditCountLabel(e.target.value)} placeholder="Count label" className="h-7 text-xs" />
                    <Input value={editCountTarget} onChange={e => setEditCountTarget(e.target.value)} placeholder="Target" type="number" className="h-7 text-xs w-20" />
                  </div>
                )}
                <div className="flex gap-1">
                  <Button size="sm" className="h-6 text-xs" onClick={handleSaveEdit}>Save</Button>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditId(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <span className={`text-sm ${!task.is_active ? 'line-through text-muted-foreground' : ''}`}>{task.task_name}</span>
                  {task.has_count && (
                    <span className="text-[10px] text-muted-foreground ml-2">
                      ({task.count_label}{task.count_target != null ? ` · target: ${task.count_target}` : ''})
                    </span>
                  )}
                </div>
                <div className="max-w-md">
                  <StandardSelect value={task.standard_key || 'other'} onChange={(v) => handleStandardChange(task, v)} />
                </div>
              </>
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

      <Card className="border-dashed">
        <CardContent className="p-3 space-y-2">
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New task name" className="h-8 text-sm" />
          <StandardSelect value={newStandard} onChange={setNewStandard} />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Has count:</span>
              <Switch checked={newHasCount} onCheckedChange={setNewHasCount} />
            </div>
            {newHasCount && (
              <div className="flex gap-2">
                <Input value={newCountLabel} onChange={e => setNewCountLabel(e.target.value)} placeholder="Count label" className="h-7 text-xs w-32" />
                <Input value={newCountTarget} onChange={e => setNewCountTarget(e.target.value)} placeholder="Target" type="number" className="h-7 text-xs w-20" />
              </div>
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

  const [formName, setFormName] = useState('');
  const [formHasCount, setFormHasCount] = useState(false);
  const [formCountLabel, setFormCountLabel] = useState('');
  const [formStandard, setFormStandard] = useState('other');
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
      shift_type: STANDARD_SHIFT,
      active_date: formDate,
      task_name: formName.trim(),
      has_count: formHasCount,
      count_label: formHasCount ? formCountLabel.trim() || null : null,
      standard_key: formStandard,
      created_by: user.name,
    } as any);
    setFormName('');
    setFormHasCount(false);
    setFormCountLabel('');
    setFormStandard('other');
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
          <div>
            <span className="text-xs text-muted-foreground">Date</span>
            <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="h-8 text-xs" />
          </div>
          <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Task name" className="h-8 text-sm" />
          <div>
            <span className="text-xs text-muted-foreground">Standard</span>
            <StandardSelect value={formStandard} onChange={setFormStandard} />
          </div>
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
                      <Badge variant="outline" className="text-[9px] h-4">{o.standard_key || 'other'}</Badge>
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
  const [section, setSection] = useState<'standards' | 'templates' | 'overrides'>('templates');

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={section === 'standards' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSection('standards')}
        >
          <Layers className="w-3.5 h-3.5 mr-1" /> Standards
        </Button>
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

      {section === 'standards' && <StandardsManager />}
      {section === 'templates' && <TaskTemplateManager />}
      {section === 'overrides' && <TodayOnlyTasksManager />}
    </div>
  );
}
