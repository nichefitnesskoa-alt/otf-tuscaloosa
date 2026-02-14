import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import {
  Target, Plus, Trash2, TrendingDown, TrendingUp, ChevronDown, ChevronRight,
  Pencil, History, Wrench,
} from 'lucide-react';
import { format, addDays, parseISO, isAfter, isBefore, formatDistanceToNow } from 'date-fns';
import { decrementAmcOnChurn } from '@/lib/amc-auto';
import { processEffectiveChurn } from '@/lib/amc-auto';

const AMC_TARGET = 400;

interface AmcEntry {
  id: string;
  logged_date: string;
  amc_value: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

interface ChurnEntry {
  id: string;
  churn_count: number;
  effective_date: string;
  note: string | null;
  created_at: string;
  created_by: string | null;
}

export default function AmcLogForm() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AmcEntry[]>([]);
  const [churnEntries, setChurnEntries] = useState<ChurnEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Churn form state
  const [churnCount, setChurnCount] = useState('');
  const [churnDate, setChurnDate] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
  const [churnNote, setChurnNote] = useState('');
  const [isChurnSubmitting, setIsChurnSubmitting] = useState(false);

  // Manual adjustment state
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const [manualDate, setManualDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [manualNote, setManualNote] = useState('');
  const [isManualSubmitting, setIsManualSubmitting] = useState(false);

  // History state
  const [historyOpen, setHistoryOpen] = useState(false);

  // Editing churn
  const [editingChurnId, setEditingChurnId] = useState<string | null>(null);
  const [editChurnCount, setEditChurnCount] = useState('');
  const [editChurnDate, setEditChurnDate] = useState('');
  const [editChurnNote, setEditChurnNote] = useState('');

  useEffect(() => {
    processEffectiveChurn().then(() => {
      fetchEntries();
      fetchChurnEntries();
    });
  }, []);

  const fetchEntries = async () => {
    const { data } = await supabase
      .from('amc_log')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setEntries(data as AmcEntry[]);
    setIsLoading(false);
  };

  const fetchChurnEntries = async () => {
    const { data } = await supabase
      .from('churn_log')
      .select('*')
      .order('effective_date', { ascending: true });
    if (data) setChurnEntries(data as ChurnEntry[]);
  };

  // --- Churn submit ---
  const handleChurnSubmit = async () => {
    if (!churnCount || isNaN(Number(churnCount)) || Number(churnCount) <= 0) {
      toast.error('Enter a valid churn count');
      return;
    }
    setIsChurnSubmitting(true);
    const count = Number(churnCount);
    const { data: newChurn, error } = await supabase.from('churn_log').insert({
      churn_count: count,
      effective_date: churnDate,
      note: churnNote || null,
      created_by: user?.name || 'Admin',
    } as any).select('id').maybeSingle();

    if (error) {
      toast.error('Failed to log churn');
    } else {
      const today = format(new Date(), 'yyyy-MM-dd');
      if (churnDate <= today && newChurn) {
        const churnId = (newChurn as any).id?.substring(0, 8) || '';
        await decrementAmcOnChurn(
          count,
          `Auto: Churn logged (${count} members) [${churnId}]`,
          user?.name || 'Admin',
          churnDate,
        );
      }
      toast.success('Churn logged!');
      setChurnCount('');
      setChurnNote('');
      setChurnDate(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
      fetchChurnEntries();
      fetchEntries();
    }
    setIsChurnSubmitting(false);
  };

  const handleDeleteChurn = async (id: string) => {
    const { error } = await supabase.from('churn_log').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete');
    } else {
      toast.success('Churn entry deleted');
      fetchChurnEntries();
    }
  };

  const startEditChurn = (e: ChurnEntry) => {
    setEditingChurnId(e.id);
    setEditChurnCount(String(e.churn_count));
    setEditChurnDate(e.effective_date);
    setEditChurnNote(e.note || '');
  };

  const handleSaveChurnEdit = async () => {
    if (!editingChurnId || !editChurnCount) return;
    const { error } = await supabase.from('churn_log').update({
      churn_count: Number(editChurnCount),
      effective_date: editChurnDate,
      note: editChurnNote || null,
    }).eq('id', editingChurnId);
    if (error) {
      toast.error('Failed to update');
    } else {
      toast.success('Churn entry updated');
      setEditingChurnId(null);
      fetchChurnEntries();
    }
  };

  // --- Manual adjustment submit ---
  const handleManualSubmit = async () => {
    if (!manualValue || isNaN(Number(manualValue))) {
      toast.error('Enter a valid number');
      return;
    }
    setIsManualSubmitting(true);

    // Get the latest AMC value
    const latestAmc = entries.length > 0 ? entries[0].amc_value : 0;
    const adjustment = Number(manualValue);
    const newValue = latestAmc + adjustment;

    const { error } = await supabase.from('amc_log').insert({
      logged_date: manualDate,
      amc_value: newValue,
      note: manualNote || `Manual adjustment (${adjustment > 0 ? '+' : ''}${adjustment})`,
      created_by: user?.name || 'Admin',
    });
    if (error) {
      toast.error('Failed to log adjustment');
    } else {
      toast.success(`AMC adjusted to ${newValue}`);
      setManualValue('');
      setManualNote('');
      setManualOpen(false);
      fetchEntries();
    }
    setIsManualSubmitting(false);
  };

  const handleDeleteEntry = async (id: string) => {
    const { error } = await supabase.from('amc_log').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete');
    } else {
      toast.success('Entry deleted');
      fetchEntries();
    }
  };

  if (isLoading) return null;

  // --- Computed values ---
  const latestEntry = entries.length > 0 ? entries[0] : null;
  const latestAmc = latestEntry?.amc_value || 0;
  const progressPct = Math.min((latestAmc / AMC_TARGET) * 100, 100);

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  // Future churn only (effective_date > today)
  const futureChurn = churnEntries.filter(e => e.effective_date > todayStr);
  const totalFutureChurn = futureChurn.reduce((sum, e) => sum + e.churn_count, 0);
  const projectedAmc = latestAmc - totalFutureChurn;
  const netNeeded = Math.max(0, AMC_TARGET - projectedAmc);

  // All upcoming churn (including today, for the editable list)
  const upcomingChurn = churnEntries.filter(e => e.effective_date >= todayStr);

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          AMC Tracker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* (1) Current AMC, target, progress bar */}
        <div className="space-y-2">
          <div className="flex items-end gap-3">
            <span className="text-4xl font-bold">{latestAmc}</span>
            <span className="text-sm text-muted-foreground pb-1">/ {AMC_TARGET} target</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progressPct.toFixed(0)}% to goal</span>
              <span>{Math.max(0, AMC_TARGET - latestAmc)} to go</span>
            </div>
            <Progress value={progressPct} className="h-2" />
          </div>
          {latestEntry && (
            <p className="text-[11px] text-muted-foreground">
              Last updated: {latestEntry.note || 'Manual entry'} · {formatDistanceToNow(parseISO(latestEntry.created_at), { addSuffix: true })}
              {latestEntry.created_by ? ` by ${latestEntry.created_by}` : ''}
            </p>
          )}
        </div>

        {/* (2) Upcoming churn summary */}
        {futureChurn.length > 0 && (
          <div className="rounded-lg border border-destructive/20 p-2.5 bg-destructive/5 space-y-1">
            <p className="text-xs font-medium flex items-center gap-1 text-destructive">
              <TrendingDown className="w-3 h-3" />
              Upcoming churn
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              {futureChurn.map(e => (
                <span key={e.id} className="text-destructive">
                  −{e.churn_count} on {format(parseISO(e.effective_date), 'MMM d')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* (3) Projected AMC after known churn */}
        {totalFutureChurn > 0 && (
          <div className="rounded-lg border p-2.5 bg-muted/30 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>Current</span>
              <span className="font-bold">{latestAmc}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-destructive">
              <span>After known churn</span>
              <span className="font-bold">{projectedAmc}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-primary">
              <span>Need to hit {AMC_TARGET}</span>
              <span className="font-bold">+{netNeeded} net</span>
            </div>
          </div>
        )}

        {/* (4) Log Churn — prominent, always visible */}
        <div className="rounded-lg border border-destructive/30 p-3 space-y-2 bg-destructive/5">
          <p className="text-sm font-medium flex items-center gap-1.5 text-destructive">
            <TrendingDown className="w-4 h-4" />
            Log Churn
          </p>
          <p className="text-xs text-muted-foreground">
            Log cancellations, freezes, or other member departures
          </p>
          <div className="flex gap-2 items-end">
            <div className="w-20">
              <Label className="text-xs">Count</Label>
              <Input
                type="number"
                min="1"
                value={churnCount}
                onChange={e => setChurnCount(e.target.value)}
                placeholder="3"
                className="h-9"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs">Effective Date</Label>
              <Input
                type="date"
                value={churnDate}
                onChange={e => setChurnDate(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs">Notes</Label>
              <Input
                value={churnNote}
                onChange={e => setChurnNote(e.target.value)}
                placeholder="e.g. 2 cancels, 1 freeze"
                className="h-9"
              />
            </div>
            <Button
              size="sm"
              onClick={handleChurnSubmit}
              disabled={isChurnSubmitting}
              className="h-9 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* (5) Upcoming churn entries — editable */}
        {upcomingChurn.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Scheduled churn entries</p>
            {upcomingChurn.map(e => (
              <div key={e.id}>
                {editingChurnId === e.id ? (
                  <div className="flex gap-1.5 items-end p-2 rounded-lg bg-muted/50 border">
                    <Input
                      type="number"
                      value={editChurnCount}
                      onChange={ev => setEditChurnCount(ev.target.value)}
                      className="h-8 w-16"
                    />
                    <Input
                      type="date"
                      value={editChurnDate}
                      onChange={ev => setEditChurnDate(ev.target.value)}
                      className="h-8 flex-1"
                    />
                    <Input
                      value={editChurnNote}
                      onChange={ev => setEditChurnNote(ev.target.value)}
                      className="h-8 flex-1"
                      placeholder="Note"
                    />
                    <Button size="sm" className="h-8 text-xs" onClick={handleSaveChurnEdit}>Save</Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingChurnId(null)}>✕</Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-destructive/5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{format(parseISO(e.effective_date), 'MMM d, yyyy')}</span>
                      <Badge variant="destructive" className="text-[10px]">−{e.churn_count}</Badge>
                      {e.note && <span className="text-muted-foreground truncate max-w-[150px]">— {e.note}</span>}
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => startEditChurn(e)}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteChurn(e.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* (6) Manual adjustment — collapsed */}
        <Collapsible open={manualOpen} onOpenChange={setManualOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-1.5 text-xs text-muted-foreground h-8">
              {manualOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <Wrench className="w-3 h-3" />
              Manual adjustment
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
              <p className="text-xs text-muted-foreground">
                Add or subtract members for corrections not captured by the app.
              </p>
              <div className="flex gap-2 items-end">
                <div className="w-24">
                  <Label className="text-xs">+/− Members</Label>
                  <Input
                    type="number"
                    value={manualValue}
                    onChange={e => setManualValue(e.target.value)}
                    placeholder="+3 or -2"
                    className="h-9"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs">Date</Label>
                  <Input
                    type="date"
                    value={manualDate}
                    onChange={e => setManualDate(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs">Note</Label>
                  <Input
                    value={manualNote}
                    onChange={e => setManualNote(e.target.value)}
                    placeholder="e.g. Corporate add"
                    className="h-9"
                  />
                </div>
                <Button size="sm" onClick={handleManualSubmit} disabled={isManualSubmitting} className="h-9">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* (7) AMC history log — collapsible */}
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-1.5 text-xs text-muted-foreground h-8">
              {historyOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <History className="w-3 h-3" />
              AMC history ({entries.length} entries)
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {[...entries].sort((a, b) => b.logged_date.localeCompare(a.logged_date) || b.created_at.localeCompare(a.created_at)).map(e => (
                <div key={e.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium shrink-0">{format(parseISO(e.logged_date), 'MMM d')}</span>
                    <span className="font-bold shrink-0">{e.amc_value}</span>
                    {e.note && (
                      <Badge variant={e.note.startsWith('Auto:') ? 'secondary' : 'outline'} className="text-[10px] truncate max-w-[180px]">
                        {e.note.startsWith('Auto:') ? '⚡ Auto' : '✏️ Manual'}
                      </Badge>
                    )}
                    {e.note && <span className="text-muted-foreground truncate">{e.note}</span>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive shrink-0"
                    onClick={() => handleDeleteEntry(e.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
