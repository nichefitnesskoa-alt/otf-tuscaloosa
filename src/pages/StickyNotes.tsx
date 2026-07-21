import { useMemo, useState, useEffect, useRef } from 'react';
import { StickyNote, Trash2, Check, Bell, Plus, Send, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useActiveStaff } from '@/hooks/useActiveStaff';
import {
  useStickyNotes,
  stickyState,
  type StickyNote as Note,
  type StickyPriority,
} from '@/hooks/useStickyNotes';
import { useTeamChat } from '@/hooks/useTeamChat';
import { useStickyNoteComments, type StickyNoteComment } from '@/hooks/useStickyNoteComments';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { OTF } from '@/lib/otfBrand';
import { statusClasses, type WigStatus } from '@/lib/wig/pace';
import { cn } from '@/lib/utils';

// Priority → shared WIG status token. Overdue always escalates to red.
// This is the same red/yellow/green token every other WIG surface uses,
// so a note flagged red matches "red" everywhere else in the app.
function priorityStatus(p: StickyPriority, overdue: boolean): WigStatus {
  if (overdue) return 'red';
  if (p === 'urgent') return 'red';
  if (p === 'important') return 'yellow';
  return 'green';
}

const PRIORITY_LABEL: Record<StickyPriority, string> = {
  urgent: 'Urgent',
  important: 'Important',
  normal: 'Normal',
};

const PRIORITY_ORDER: Record<StickyPriority, number> = {
  urgent: 0,
  important: 1,
  normal: 2,
};

type FilterKey = 'all' | 'mine' | 'assigned' | 'done';

function todayLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isOverdue(n: Note) {
  return !!n.due_date && !n.completed_at && n.due_date < todayLocalISO();
}

function compareNotes(a: Note, b: Note) {
  // Urgent > Important > Normal, then earliest due date, then unacknowledged first, then done last.
  const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (p !== 0) return p;
  const ad = a.due_date || '9999-12-31';
  const bd = b.due_date || '9999-12-31';
  if (ad !== bd) return ad < bd ? -1 : 1;
  const sOrder = (n: Note) =>
    n.completed_at ? 2 : n.acknowledged_at ? 1 : 0;
  const s = sOrder(a) - sOrder(b);
  if (s !== 0) return s;
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
    <div className="app-internal p-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <StickyNote className="w-6 h-6" style={{ color: OTF.orange }} />
        <h1 className="text-2xl font-bold">Sticky Notes</h1>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="mb-4">
          <TabsTrigger value="board">Notes</TabsTrigger>
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
  const { forNote, countFor, send: sendComment } = useStickyNoteComments();
  const { allActive } = useActiveStaff();
  const [filter, setFilter] = useState<FilterKey>('all');

  const openForMe = useMemo(
    () => notes.filter(n => n.assigned_to === currentName && !n.acknowledged_at && !n.completed_at).length,
    [notes, currentName],
  );

  const filtered = useMemo(() => {
    const list = notes.filter(n => {
      const st = stickyState(n);
      if (filter === 'mine') return n.created_by === currentName;
      if (filter === 'assigned') return n.assigned_to === currentName;
      if (filter === 'done') return st === 'done';
      // 'all' hides done by default so the board reflects live work.
      return st !== 'done';
    });
    return [...list].sort(compareNotes);
  }, [notes, filter, currentName]);

  const filterOpts: { key: FilterKey; label: string; count?: number }[] = [
    { key: 'all', label: 'All' },
    { key: 'mine', label: 'Mine' },
    { key: 'assigned', label: 'For me', count: openForMe },
    { key: 'done', label: 'Done' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {filterOpts.map(opt => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={cn(
                'px-3 py-2 rounded-md text-sm font-medium border transition',
                filter === opt.key
                  ? 'border-transparent'
                  : 'border-border hover:bg-muted',
              )}
              style={filter === opt.key ? { backgroundColor: OTF.orange, color: OTF.rawBone } : undefined}
            >
              {opt.label}
              {typeof opt.count === 'number' && opt.count > 0 && (
                <span className={cn('ml-2 inline-block rounded-full px-2 py-0.5 text-xs', filter === opt.key ? 'bg-white/25' : 'bg-destructive text-destructive-foreground')}>
                  {opt.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <NewNoteDialog currentName={currentName} staffNames={allActive} />
      </div>

      {loading ? (
        <div className="text-sm opacity-70">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm opacity-60 italic p-8 text-center border border-dashed rounded-md">
          Nothing here. Tap "New note" to leave one.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(n => (
            <NoteCard
              key={n.id}
              note={n}
              currentName={currentName}
              commentCount={countFor(n.id)}
              comments={forNote(n.id)}
              onSendComment={(content) => sendComment(n.id, currentName, content)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NoteCard({
  note,
  currentName,
  commentCount,
  comments,
  onSendComment,
}: {
  note: Note;
  currentName: string;
  commentCount: number;
  comments: StickyNoteComment[];
  onSendComment: (content: string) => Promise<void>;
}) {
  const state = stickyState(note);
  const overdue = isOverdue(note);
  const status = priorityStatus(note.priority, overdue);
  const cls = statusClasses(status);

  const isAssignee = note.assigned_to === currentName;
  const isCreator = note.created_by === currentName;
  const canAck = state === 'new' && isAssignee;
  const canDone = state === 'acknowledged' && (isAssignee || isCreator);
  const canDelete = isCreator;

  const rotate = useMemo(() => {
    const seed = note.id.charCodeAt(0) + note.id.charCodeAt(1);
    return (seed % 5) - 2; // -2..+2 deg
  }, [note.id]);

  const ack = async () => {
    const { error } = await supabase
      .from('sticky_notes' as any)
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: currentName })
      .eq('id', note.id);
    if (error) toast.error('Could not acknowledge'); else toast.success('Acknowledged');
  };

  const markDone = async () => {
    const { error } = await supabase
      .from('sticky_notes' as any)
      .update({ completed_at: new Date().toISOString(), completed_by: currentName })
      .eq('id', note.id);
    if (error) toast.error('Could not mark done'); else toast.success('Done');
  };

  const del = async () => {
    if (!confirm('Delete this note?')) return;
    const { error } = await supabase.from('sticky_notes' as any).delete().eq('id', note.id);
    if (error) toast.error('Could not delete');
  };

  return (
    <div
      className={cn('rounded-md p-4 shadow-md ring-2', cls.ring, state === 'done' && 'opacity-60')}
      style={{
        backgroundColor: 'hsl(var(--card))',
        transform: `rotate(${rotate}deg)`,
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
        <span className={cn('text-xs font-bold uppercase px-2 py-0.5 rounded', cls.bar, 'text-white')}>
          {PRIORITY_LABEL[note.priority]}
        </span>
        <div className="flex gap-1 flex-wrap">
          {overdue && (
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-destructive text-destructive-foreground">
              Overdue
            </span>
          )}
          {state === 'new' && !isAssignee && (
            <span className="text-xs px-2 py-0.5 rounded bg-muted text-foreground">Waiting on {note.assigned_to}</span>
          )}
          {state === 'new' && isAssignee && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-warning text-warning-foreground">Needs your ack</span>
          )}
          {state === 'acknowledged' && (
            <span className="text-xs px-2 py-0.5 rounded bg-muted text-foreground">Acknowledged</span>
          )}
          {state === 'done' && (
            <span className="text-xs px-2 py-0.5 rounded bg-success text-success-foreground">Done</span>
          )}
        </div>
      </div>
      <div className="text-base whitespace-pre-wrap break-words mb-3">{note.content}</div>
      <div className="text-sm space-y-0.5 mb-3">
        <div><span className="opacity-70">For:</span> <strong>{note.assigned_to}</strong>{note.assigned_to === note.created_by ? ' (self)' : ''}</div>
        {note.assigned_to !== note.created_by && (
          <div><span className="opacity-70">From:</span> {note.created_by}</div>
        )}
        {note.due_date && <div><span className="opacity-70">Due:</span> {formatDate(note.due_date)}</div>}
      </div>
      <div className="flex gap-2 flex-wrap">
        {canAck && (
          <Button size="sm" onClick={ack} style={{ backgroundColor: OTF.orange, color: OTF.rawBone }}>
            <Bell className="w-4 h-4 mr-1" /> Acknowledge
          </Button>
        )}
        {canDone && (
          <Button size="sm" onClick={markDone} variant="secondary">
            <Check className="w-4 h-4 mr-1" /> Mark done
          </Button>
        )}
        {canDelete && (
          <Button size="sm" variant="ghost" onClick={del} className="text-destructive hover:bg-destructive/10">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
        <CommentsDialog
          note={note}
          currentName={currentName}
          comments={comments}
          commentCount={commentCount}
          onSend={onSendComment}
        />
      </div>
    </div>
  );
}

function CommentsDialog({
  note,
  currentName,
  comments,
  commentCount,
  onSend,
}: {
  note: Note;
  currentName: string;
  comments: StickyNoteComment[];
  commentCount: number;
  onSend: (content: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [open, comments.length]);

  const submit = async () => {
    const c = draft.trim();
    if (!c || !currentName) return;
    setSending(true);
    await onSend(c);
    setSending(false);
    setDraft('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="ml-auto" aria-label="Comments">
          <MessageCircle className="w-4 h-4 mr-1" />
          {commentCount}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Comments</DialogTitle></DialogHeader>
        <div className="rounded-md p-3 bg-muted text-sm whitespace-pre-wrap break-words">
          <div className="text-xs opacity-70 mb-1">
            <strong>{note.created_by}</strong>
            {note.assigned_to !== note.created_by && <> → <strong>{note.assigned_to}</strong></>}
          </div>
          {note.content}
        </div>
        <div ref={feedRef} className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto py-2">
          {comments.length === 0 && (
            <div className="text-sm opacity-60 italic">No comments yet. Start the thread.</div>
          )}
          {comments.map(c => {
            const mine = c.author === currentName;
            return (
              <div key={c.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
                <div className="text-xs opacity-70 mb-0.5">
                  <strong>{c.author}</strong> · {formatTime(c.created_at)}
                </div>
                <div
                  className="rounded-md px-3 py-2 max-w-[85%] whitespace-pre-wrap break-words"
                  style={{
                    backgroundColor: mine ? OTF.orange : 'hsl(var(--card))',
                    color: mine ? OTF.rawBone : 'hsl(var(--foreground))',
                  }}
                >
                  {c.content}
                </div>
              </div>
            );
          })}
        </div>
        <form
          className="flex gap-2 border-t pt-2"
          style={{ borderColor: 'hsl(var(--border))' }}
          onSubmit={(e) => { e.preventDefault(); submit(); }}
        >
          <Input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Add a comment…"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
          />
          <Button
            type="submit"
            disabled={!draft.trim() || sending}
            style={{ backgroundColor: OTF.orange, color: OTF.rawBone }}
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewNoteDialog({ currentName, staffNames }: { currentName: string; staffNames: string[] }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [assignedTo, setAssignedTo] = useState(currentName);
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<StickyPriority>('normal');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (currentName && !assignedTo) setAssignedTo(currentName); }, [currentName, assignedTo]);

  const create = async () => {
    if (!content.trim()) { toast.error('Content required'); return; }
    if (!assignedTo) { toast.error('Pick who this is for'); return; }
    setSaving(true);
    // Self-notes get acknowledged_at stamped by the sticky_notes_auto_ack_self
    // trigger, so we never insert a status here — state is entirely derived
    // from acknowledged_at / completed_at.
    const { error } = await supabase.from('sticky_notes' as any).insert({
      content: content.trim(),
      created_by: currentName,
      assigned_to: assignedTo,
      due_date: dueDate || null,
      priority,
    });
    setSaving(false);
    if (error) { toast.error('Could not save: ' + error.message); return; }
    toast.success('Note posted');
    setContent(''); setDueDate(''); setPriority('normal'); setAssignedTo(currentName);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button style={{ backgroundColor: OTF.orange, color: OTF.rawBone }}>
          <Plus className="w-4 h-4 mr-1" /> New note
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New sticky note</DialogTitle></DialogHeader>
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
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="important">Important</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {assignedTo === currentName && (
            <div className="text-xs opacity-70">A note to yourself skips the acknowledge step.</div>
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
          const mine = m.sender === currentName;
          return (
            <div key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
              <div className="text-xs opacity-70 mb-0.5">
                <strong>{m.sender}</strong> · {formatTime(m.created_at)}
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
