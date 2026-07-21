import { useMemo, useState, useEffect, useRef } from 'react';
import { StickyNote, Trash2, Check, Bell, Plus, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useActiveStaff } from '@/hooks/useActiveStaff';
import { useStickyNotes, type StickyNote as Note, type StickyPriority, type StickyStatus } from '@/hooks/useStickyNotes';
import { useTeamChat } from '@/hooks/useTeamChat';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { OTF } from '@/lib/otfBrand';
import { cn } from '@/lib/utils';

// Priority visual language — hotter = more urgent. Sticky-note personality
// deliberately breaks brand palette on cards only; page chrome stays brand.
const PRIORITY_STYLES: Record<StickyPriority, { bg: string; ring: string; label: string; text: string }> = {
  urgent: { bg: '#FFD1C2', ring: '#FF6F0D', label: 'Urgent', text: '#0A0A0A' },
  high:   { bg: '#FFE4B0', ring: '#F59E0B', label: 'High',   text: '#0A0A0A' },
  medium: { bg: '#FFF7B0', ring: '#EAB308', label: 'Medium', text: '#0A0A0A' },
  low:    { bg: '#C9F0D6', ring: '#22C55E', label: 'Low',    text: '#0A0A0A' },
};

const STATUS_COLS: { key: StickyStatus; label: string }[] = [
  { key: 'open', label: 'New' },
  { key: 'acknowledged', label: 'Acknowledged' },
  { key: 'done', label: 'Done' },
];

function todayLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isOverdue(n: Note) {
  return !!n.due_date && n.status !== 'done' && n.due_date < todayLocalISO();
}

function comparePriority(a: Note, b: Note) {
  const order: Record<StickyPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  const p = order[a.priority] - order[b.priority];
  if (p !== 0) return p;
  const ad = a.due_date || '9999-12-31';
  const bd = b.due_date || '9999-12-31';
  if (ad !== bd) return ad < bd ? -1 : 1;
  return a.created_at < b.created_at ? -1 : 1;
}

function formatDate(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function StickyNotesPage() {
  const { user } = useAuth();
  const currentName = user?.name || '';
  const [tab, setTab] = useState<'board' | 'chat'>('board');

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <StickyNote className="w-6 h-6" style={{ color: OTF.orange }} />
        <h1 className="text-2xl font-bold">Sticky Notes</h1>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="mb-4">
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="chat">Team Chat</TabsTrigger>
        </TabsList>
        <TabsContent value="board">
          <BoardTab currentName={currentName} />
        </TabsContent>
        <TabsContent value="chat">
          <ChatTab currentName={currentName} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BoardTab({ currentName }: { currentName: string }) {
  const { notes, loading } = useStickyNotes();
  const { allActive } = useActiveStaff();

  const grouped = useMemo(() => {
    const g: Record<StickyStatus, Note[]> = { open: [], acknowledged: [], done: [] };
    for (const n of notes) g[n.status].push(n);
    for (const k of Object.keys(g) as StickyStatus[]) g[k].sort(comparePriority);
    return g;
  }, [notes]);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <NewNoteDialog currentName={currentName} staffNames={allActive} />
      </div>
      {loading ? (
        <div className="text-sm opacity-70">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STATUS_COLS.map(col => (
            <div key={col.key} className="min-h-[200px]">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">{col.label}</h2>
                <span className="text-sm opacity-70">{grouped[col.key].length}</span>
              </div>
              <div className="space-y-3">
                {grouped[col.key].length === 0 && (
                  <div className="text-sm opacity-50 italic">No notes</div>
                )}
                {grouped[col.key].map(n => (
                  <NoteCard key={n.id} note={n} currentName={currentName} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NoteCard({ note, currentName }: { note: Note; currentName: string }) {
  const p = PRIORITY_STYLES[note.priority];
  const overdue = isOverdue(note);
  const canAck = note.status === 'open' && note.assigned_to === currentName;
  const canDone = note.status === 'acknowledged' && (note.assigned_to === currentName || note.created_by === currentName);
  const canDelete = note.created_by === currentName;

  const rotate = useMemo(() => {
    // Deterministic slight rotation per note id
    const seed = note.id.charCodeAt(0) + note.id.charCodeAt(1);
    return (seed % 5) - 2; // -2..+2 deg
  }, [note.id]);

  const ack = async () => {
    const { error } = await supabase
      .from('sticky_notes' as any)
      .update({ status: 'acknowledged', acknowledged_at: new Date().toISOString(), acknowledged_by: currentName })
      .eq('id', note.id);
    if (error) toast.error('Could not acknowledge'); else toast.success('Acknowledged');
  };

  const markDone = async () => {
    const { error } = await supabase
      .from('sticky_notes' as any)
      .update({ status: 'done', completed_at: new Date().toISOString(), completed_by: currentName })
      .eq('id', note.id);
    if (error) toast.error('Could not mark done'); else toast.success('Marked done');
  };

  const del = async () => {
    if (!confirm('Delete this note?')) return;
    const { error } = await supabase.from('sticky_notes' as any).delete().eq('id', note.id);
    if (error) toast.error('Could not delete');
  };

  return (
    <div
      className="rounded-md p-3 shadow-md"
      style={{
        backgroundColor: p.bg,
        color: p.text,
        transform: `rotate(${rotate}deg)`,
        boxShadow: overdue ? `0 0 0 3px #DC2626, 0 4px 10px rgba(0,0,0,0.25)` : '0 4px 10px rgba(0,0,0,0.25)',
        border: `1px solid ${p.ring}`,
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span
          className="text-xs font-bold uppercase px-2 py-0.5 rounded"
          style={{ backgroundColor: p.ring, color: '#0A0A0A' }}
        >
          {p.label}
        </span>
        {overdue && (
          <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: '#DC2626', color: 'white' }}>
            Overdue
          </span>
        )}
      </div>
      <div className="text-base whitespace-pre-wrap break-words mb-3">{note.content}</div>
      <div className="text-sm space-y-0.5 mb-3">
        <div><span className="opacity-70">For:</span> <strong>{note.assigned_to}</strong></div>
        <div><span className="opacity-70">From:</span> {note.created_by}</div>
        {note.due_date && <div><span className="opacity-70">Due:</span> {formatDate(note.due_date)}</div>}
      </div>
      <div className="flex gap-2 flex-wrap">
        {canAck && (
          <Button size="sm" onClick={ack} style={{ backgroundColor: OTF.orange, color: OTF.rawBone }}>
            <Bell className="w-4 h-4 mr-1" /> Acknowledge
          </Button>
        )}
        {canDone && (
          <Button size="sm" onClick={markDone} style={{ backgroundColor: '#0A0A0A', color: '#FDF7EA' }}>
            <Check className="w-4 h-4 mr-1" /> Mark Done
          </Button>
        )}
        {canDelete && (
          <Button size="sm" variant="ghost" onClick={del} className="text-red-700 hover:text-red-800 hover:bg-red-100">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function NewNoteDialog({ currentName, staffNames }: { currentName: string; staffNames: string[] }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [assignedTo, setAssignedTo] = useState(currentName);
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<StickyPriority>('medium');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (currentName && !assignedTo) setAssignedTo(currentName); }, [currentName, assignedTo]);

  const create = async () => {
    if (!content.trim()) { toast.error('Content required'); return; }
    if (!assignedTo) { toast.error('Pick who this is for'); return; }
    setSaving(true);
    const { error } = await supabase.from('sticky_notes' as any).insert({
      content: content.trim(),
      created_by: currentName,
      assigned_to: assignedTo,
      due_date: dueDate || null,
      priority,
      status: 'open',
    });
    setSaving(false);
    if (error) { toast.error('Could not save: ' + error.message); return; }
    toast.success('Note posted');
    setContent(''); setDueDate(''); setPriority('medium'); setAssignedTo(currentName);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button style={{ backgroundColor: OTF.orange, color: OTF.rawBone }}>
          <Plus className="w-4 h-4 mr-1" /> New Note
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Sticky Note</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">What's the note?</label>
            <Textarea value={content} onChange={e => setContent(e.target.value)} rows={4} autoFocus />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Assign to</label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue placeholder="Pick a staffer" /></SelectTrigger>
              <SelectContent>
                {staffNames.map(n => <SelectItem key={n} value={n}>{n}{n === currentName ? ' (me)' : ''}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Due date (optional)</label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Priority</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as StickyPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {assignedTo === currentName && (
            <div className="text-xs opacity-70">Self-notes are auto-acknowledged.</div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving} style={{ backgroundColor: OTF.orange, color: OTF.rawBone }}>
              {saving ? 'Posting…' : 'Post note'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChatTab({ currentName }: { currentName: string }) {
  const { messages, loading, send } = useTeamChat();
  const [draft, setDraft] = useState('');
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [messages.length]);

  const submit = async () => {
    if (!draft.trim()) return;
    const content = draft;
    setDraft('');
    await send(currentName, content);
  };

  return (
    <div className="flex flex-col h-[70vh] border rounded-md" style={{ borderColor: 'hsl(var(--border))' }}>
      <div ref={feedRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && <div className="text-sm opacity-70">Loading…</div>}
        {!loading && messages.length === 0 && <div className="text-sm opacity-50 italic">No messages yet. Say hi.</div>}
        {messages.map(m => {
          const mine = m.author === currentName;
          return (
            <div key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
              <div className="text-xs opacity-70 mb-0.5">
                <strong>{m.author}</strong> · {formatTime(m.created_at)}
              </div>
              <div
                className="rounded-md px-3 py-2 max-w-[80%] whitespace-pre-wrap break-words"
                style={{
                  backgroundColor: mine ? OTF.orange : 'hsl(var(--card))',
                  color: mine ? OTF.rawBone : 'hsl(var(--foreground))',
                }}
              >
                {m.content}
              </div>
            </div>
          );
        })}
      </div>
      <form
        className="border-t p-2 flex gap-2"
        style={{ borderColor: 'hsl(var(--border))' }}
        onSubmit={(e) => { e.preventDefault(); submit(); }}
      >
        <Input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Message the team…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
          }}
        />
        <Button type="submit" disabled={!draft.trim()} style={{ backgroundColor: OTF.orange, color: OTF.rawBone }}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
