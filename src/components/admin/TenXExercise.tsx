import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { ALL_STAFF } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Plus, Download, Copy, Clock, Sparkles, ArrowLeft, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface TenXSession {
  id: string;
  goal: string;
  session_date: string;
  created_by: string;
  created_at: string;
}

interface TenXIdea {
  id: string;
  session_id: string;
  participant_name: string;
  participant_role: string;
  idea_text: string;
  sort_order: number;
}

export default function TenXExercise() {
  const { user } = useAuth();
  const [session, setSession] = useState<TenXSession | null>(null);
  const [ideas, setIdeas] = useState<TenXIdea[]>([]);
  const [pastSessions, setPastSessions] = useState<TenXSession[]>([]);
  const [viewingPast, setViewingPast] = useState<TenXSession | null>(null);
  const [pastIdeas, setPastIdeas] = useState<TenXIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPast, setShowPast] = useState(false);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Load today's session or latest active session
  useEffect(() => {
    loadCurrentSession();
  }, []);

  const loadCurrentSession = async () => {
    setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    // Get today's session or the most recent one
    const { data } = await supabase
      .from('ten_x_sessions')
      .select('*')
      .eq('session_date', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (data) {
      setSession(data as TenXSession);
      await loadIdeas(data.id);
    }
    setLoading(false);
  };

  const loadIdeas = async (sessionId: string) => {
    const { data } = await supabase
      .from('ten_x_ideas')
      .select('*')
      .eq('session_id', sessionId)
      .order('participant_name')
      .order('sort_order');
    setIdeas((data || []) as TenXIdea[]);
  };

  const createNewSession = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('ten_x_sessions')
      .insert({ goal: '', session_date: today, created_by: user?.name || 'Admin' })
      .select()
      .single();
    if (error) { toast.error('Failed to create session'); return; }
    const newSession = data as TenXSession;
    setSession(newSession);
    setViewingPast(null);

    // Create initial idea rows for all staff
    const staffIdeas = ALL_STAFF.map((name, i) => ({
      session_id: newSession.id,
      participant_name: name,
      participant_role: name === 'Koa' ? 'Admin' : 'SA',
      idea_text: '',
      sort_order: 0,
    }));
    await supabase.from('ten_x_ideas').insert(staffIdeas);
    await loadIdeas(newSession.id);
    toast.success('New session created');
  };

  const updateGoal = useCallback((goal: string) => {
    if (!session) return;
    setSession(s => s ? { ...s, goal } : s);
    if (saveTimers.current['goal']) clearTimeout(saveTimers.current['goal']);
    saveTimers.current['goal'] = setTimeout(async () => {
      await supabase.from('ten_x_sessions').update({ goal }).eq('id', session.id);
    }, 500);
  }, [session?.id]);

  const updateIdea = useCallback((ideaId: string, text: string) => {
    setIdeas(prev => prev.map(i => i.id === ideaId ? { ...i, idea_text: text } : i));
    if (saveTimers.current[ideaId]) clearTimeout(saveTimers.current[ideaId]);
    saveTimers.current[ideaId] = setTimeout(async () => {
      await supabase.from('ten_x_ideas').update({ idea_text: text }).eq('id', ideaId);
    }, 500);
  }, []);

  const addIdea = async (participantName: string) => {
    if (!session) return;
    const existing = ideas.filter(i => i.participant_name === participantName);
    const { data, error } = await supabase
      .from('ten_x_ideas')
      .insert({
        session_id: session.id,
        participant_name: participantName,
        participant_role: participantName === 'Koa' ? 'Admin' : 'SA',
        idea_text: '',
        sort_order: existing.length,
      })
      .select()
      .single();
    if (!error && data) {
      setIdeas(prev => [...prev, data as TenXIdea]);
    }
  };

  const removeIdea = async (ideaId: string) => {
    await supabase.from('ten_x_ideas').delete().eq('id', ideaId);
    setIdeas(prev => prev.filter(i => i.id !== ideaId));
  };

  const loadPastSessions = async () => {
    const { data } = await supabase
      .from('ten_x_sessions')
      .select('*')
      .order('session_date', { ascending: false })
      .limit(50);
    setPastSessions((data || []) as TenXSession[]);
    setShowPast(true);
  };

  const viewPastSession = async (s: TenXSession) => {
    setViewingPast(s);
    const { data } = await supabase
      .from('ten_x_ideas')
      .select('*')
      .eq('session_id', s.id)
      .order('participant_name')
      .order('sort_order');
    setPastIdeas((data || []) as TenXIdea[]);
    setShowPast(false);
  };

  const getExportText = (s: TenXSession, ideasList: TenXIdea[]) => {
    const grouped = new Map<string, string[]>();
    ideasList.forEach(i => {
      if (!i.idea_text.trim()) return;
      if (!grouped.has(i.participant_name)) grouped.set(i.participant_name, []);
      grouped.get(i.participant_name)!.push(i.idea_text);
    });
    let text = `10X EXERCISE — ${s.session_date}\nGoal: What would it take to 10x our ${s.goal || '______'}?\n\n`;
    grouped.forEach((ideas, name) => {
      text += `${name}\n`;
      ideas.forEach(idea => { text += `— ${idea}\n`; });
      text += '\n';
    });
    return text.trim();
  };

  const handleCopy = () => {
    const s = viewingPast || session;
    const list = viewingPast ? pastIdeas : ideas;
    if (!s) return;
    navigator.clipboard.writeText(getExportText(s, list));
    toast.success('Copied to clipboard');
  };

  const handleDownload = () => {
    const s = viewingPast || session;
    const list = viewingPast ? pastIdeas : ideas;
    if (!s) return;
    const text = getExportText(s, list);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `10x-exercise-${s.session_date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Group ideas by participant
  const groupIdeas = (ideasList: TenXIdea[]) => {
    const grouped = new Map<string, TenXIdea[]>();
    ideasList.forEach(i => {
      if (!grouped.has(i.participant_name)) grouped.set(i.participant_name, []);
      grouped.get(i.participant_name)!.push(i);
    });
    return grouped;
  };

  const activeSession = viewingPast || session;
  const activeIdeas = viewingPast ? pastIdeas : ideas;
  const isReadOnly = !!viewingPast;
  const grouped = groupIdeas(activeIdeas);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        {viewingPast && (
          <Button variant="ghost" size="sm" className="mb-2" onClick={() => setViewingPast(null)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Current Session
          </Button>
        )}
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="w-7 h-7 text-primary" />
          <h1 className="text-3xl font-black tracking-tight">10X EXERCISE</h1>
          <Sparkles className="w-7 h-7 text-primary" />
        </div>
        <p className="text-lg text-muted-foreground">"What would it take to 10x our"</p>
        
        {activeSession ? (
          <Input
            value={activeSession.goal}
            onChange={e => !isReadOnly && updateGoal(e.target.value)}
            placeholder='e.g. "AMC", "show rate", "close rate", "referrals"'
            className="text-center text-2xl md:text-3xl font-bold h-16 max-w-xl mx-auto border-2 border-primary/30 focus:border-primary"
            readOnly={isReadOnly}
          />
        ) : (
          <p className="text-xl text-muted-foreground italic">No active session</p>
        )}

        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          {activeSession && (
            <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />{activeSession.session_date}</Badge>
          )}
          {isReadOnly && <Badge variant="secondary">Read Only</Badge>}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {!isReadOnly && (
            <Button onClick={createNewSession} variant="default" size="sm">
              <Plus className="w-4 h-4 mr-1" /> New Session
            </Button>
          )}
          {activeSession && (
            <>
              <Button onClick={handleCopy} variant="outline" size="sm">
                <Copy className="w-4 h-4 mr-1" /> Copy
              </Button>
              <Button onClick={handleDownload} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-1" /> Export .txt
              </Button>
            </>
          )}
          <Sheet open={showPast} onOpenChange={setShowPast}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" onClick={loadPastSessions}>
                <Clock className="w-4 h-4 mr-1" /> Past Sessions
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Past 10x Sessions</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-2">
                {pastSessions.length === 0 && <p className="text-sm text-muted-foreground">No past sessions.</p>}
                {pastSessions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => viewPastSession(s)}
                    className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition"
                  >
                    <p className="font-medium">{s.session_date}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {s.goal ? `10x our ${s.goal}` : 'No goal set'}
                    </p>
                  </button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <Separator />

      {/* Participant Grid */}
      {activeSession ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from(grouped.entries()).map(([name, personIdeas]) => (
            <Card key={name} className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold">{name}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 space-y-2">
                {personIdeas.map((idea, idx) => (
                  <div key={idea.id} className="flex items-start gap-1.5">
                    <span className="text-xs text-muted-foreground mt-2.5 shrink-0 w-4">{idx + 1}.</span>
                    {isReadOnly ? (
                      <p className="text-sm py-1.5">{idea.idea_text || <span className="text-muted-foreground italic">—</span>}</p>
                    ) : (
                      <>
                        <Input
                          value={idea.idea_text}
                          onChange={e => updateIdea(idea.id, e.target.value)}
                          placeholder="Type idea..."
                          className="text-sm h-8"
                        />
                        {personIdeas.length > 1 && (
                          <button onClick={() => removeIdea(idea.id)} className="text-muted-foreground hover:text-destructive mt-1.5 shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ))}
                {!isReadOnly && (
                  <Button variant="ghost" size="sm" className="text-xs w-full" onClick={() => addIdea(name)}>
                    <Plus className="w-3 h-3 mr-1" /> Add Idea
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Staff with no ideas yet */}
          {!isReadOnly && ALL_STAFF.filter(n => !grouped.has(n)).map(name => (
            <Card key={name} className="flex flex-col opacity-60">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold">{name}</CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" size="sm" className="text-xs w-full" onClick={() => addIdea(name)}>
                  <Plus className="w-3 h-3 mr-1" /> Add Idea
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-lg text-muted-foreground mb-4">No session for today yet.</p>
          <Button onClick={createNewSession} size="lg">
            <Plus className="w-5 h-5 mr-2" /> Start New 10x Session
          </Button>
        </div>
      )}
    </div>
  );
}
