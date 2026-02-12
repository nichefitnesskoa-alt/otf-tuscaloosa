import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Target, Plus, Trash2, TrendingDown, Calendar } from 'lucide-react';
import { format, subDays, parseISO, startOfMonth, endOfMonth, isAfter, isBefore } from 'date-fns';

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
  const [amcValue, setAmcValue] = useState('');
  const [logDate, setLogDate] = useState(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');
  const [entries, setEntries] = useState<AmcEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Churn state
  const [showChurnForm, setShowChurnForm] = useState(false);
  const [churnCount, setChurnCount] = useState('');
  const [churnDate, setChurnDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [churnNote, setChurnNote] = useState('');
  const [churnEntries, setChurnEntries] = useState<ChurnEntry[]>([]);
  const [isChurnSubmitting, setIsChurnSubmitting] = useState(false);

  useEffect(() => {
    fetchEntries();
    fetchChurnEntries();
  }, []);

  const fetchEntries = async () => {
    const { data } = await supabase
      .from('amc_log')
      .select('*')
      .order('logged_date', { ascending: false })
      .limit(10);
    if (data) setEntries(data as AmcEntry[]);
  };

  const fetchChurnEntries = async () => {
    const { data } = await supabase
      .from('churn_log')
      .select('*')
      .order('effective_date', { ascending: true });
    if (data) setChurnEntries(data as ChurnEntry[]);
  };

  const handleSubmit = async () => {
    if (!amcValue || isNaN(Number(amcValue))) {
      toast.error('Enter a valid AMC number');
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.from('amc_log').insert({
      logged_date: logDate,
      amc_value: Number(amcValue),
      note: note || null,
      created_by: user?.name || 'Admin',
    });
    if (error) {
      toast.error('Failed to log AMC');
    } else {
      toast.success('AMC logged!');
      setAmcValue('');
      setNote('');
      fetchEntries();
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('amc_log').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete');
    } else {
      toast.success('Entry deleted');
      fetchEntries();
    }
  };

  const handleChurnSubmit = async () => {
    if (!churnCount || isNaN(Number(churnCount)) || Number(churnCount) <= 0) {
      toast.error('Enter a valid churn count');
      return;
    }
    setIsChurnSubmitting(true);
    const { error } = await supabase.from('churn_log').insert({
      churn_count: Number(churnCount),
      effective_date: churnDate,
      note: churnNote || null,
      created_by: user?.name || 'Admin',
    } as any);
    if (error) {
      toast.error('Failed to log churn');
    } else {
      toast.success('Churn logged!');
      setChurnCount('');
      setChurnNote('');
      setShowChurnForm(false);
      fetchChurnEntries();
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

  // Calculate churn metrics
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const pendingChurnThisMonth = churnEntries
    .filter(e => {
      const d = parseISO(e.effective_date);
      return isAfter(d, subDays(currentMonthStart, 1)) && isBefore(d, currentMonthEnd);
    })
    .reduce((sum, e) => sum + e.churn_count, 0);

  const latestAmc = entries.length > 0 ? entries[0].amc_value : 0;
  const projectedAmc = latestAmc - pendingChurnThisMonth;
  const netNeeded = AMC_TARGET - projectedAmc;

  // Group upcoming churn by month
  const upcomingChurn = churnEntries.filter(e => isAfter(parseISO(e.effective_date), subDays(now, 1)));
  const churnByMonth = new Map<string, number>();
  upcomingChurn.forEach(e => {
    const monthKey = format(parseISO(e.effective_date), 'MMMM yyyy');
    churnByMonth.set(monthKey, (churnByMonth.get(monthKey) || 0) + e.churn_count);
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          AMC Log
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Projection summary */}
        {latestAmc > 0 && (
          <div className="rounded-lg border p-3 bg-muted/30 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>Current AMC</span>
              <span className="font-bold">{latestAmc}</span>
            </div>
            {pendingChurnThisMonth > 0 && (
              <div className="flex items-center justify-between text-sm text-destructive">
                <span className="flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Pending churn</span>
                <span className="font-bold">-{pendingChurnThisMonth}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span>Projected</span>
              <span className="font-bold">{projectedAmc}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-primary">
              <span>Need to hit {AMC_TARGET}</span>
              <span className="font-bold">+{Math.max(0, netNeeded)} net</span>
            </div>
          </div>
        )}

        {/* AMC entry form */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label className="text-xs">Date</Label>
            <Input
              type="date"
              value={logDate}
              onChange={e => setLogDate(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="w-24">
            <Label className="text-xs">AMC</Label>
            <Input
              type="number"
              value={amcValue}
              onChange={e => setAmcValue(e.target.value)}
              placeholder="344"
              className="h-9"
            />
          </div>
          <div className="flex-1">
            <Label className="text-xs">Note</Label>
            <Input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. 2 cancels"
              className="h-9"
            />
          </div>
          <Button size="sm" onClick={handleSubmit} disabled={isSubmitting} className="h-9">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Log Churn button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1 text-destructive border-destructive/30"
          onClick={() => setShowChurnForm(!showChurnForm)}
        >
          <TrendingDown className="w-3.5 h-3.5" />
          {showChurnForm ? 'Cancel' : 'Log Churn'}
        </Button>

        {/* Churn form */}
        {showChurnForm && (
          <div className="rounded-lg border border-destructive/30 p-3 space-y-2 bg-destructive/5">
            <p className="text-xs font-medium text-destructive">Log upcoming member departures</p>
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
              <Button size="sm" onClick={handleChurnSubmit} disabled={isChurnSubmitting} className="h-9 bg-destructive text-destructive-foreground hover:bg-destructive/90">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Scheduled Churn by month */}
        {churnByMonth.size > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium flex items-center gap-1"><Calendar className="w-3 h-3" /> Scheduled Churn</p>
            {Array.from(churnByMonth.entries()).map(([month, count]) => (
              <div key={month} className="flex items-center justify-between text-xs p-1.5 rounded bg-destructive/10">
                <span>{month}</span>
                <Badge variant="destructive" className="text-[10px]">-{count} members</Badge>
              </div>
            ))}
          </div>
        )}

        {/* Upcoming churn entries */}
        {upcomingChurn.length > 0 && (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            <p className="text-xs font-medium text-muted-foreground">Churn entries</p>
            {upcomingChurn.map(e => (
              <div key={e.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-destructive/5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{e.effective_date}</span>
                  <span className="font-bold text-destructive">-{e.churn_count}</span>
                  {e.note && <span className="text-muted-foreground">— {e.note}</span>}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  onClick={() => handleDeleteChurn(e.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Recent AMC entries */}
        {entries.length > 0 && (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {entries.map(e => (
              <div key={e.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/50">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{e.logged_date}</span>
                  <span className="font-bold">{e.amc_value}</span>
                  {e.note && <span className="text-muted-foreground">— {e.note}</span>}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(e.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}