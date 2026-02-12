import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Target, Plus, Trash2 } from 'lucide-react';
import { format, subDays } from 'date-fns';

interface AmcEntry {
  id: string;
  logged_date: string;
  amc_value: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export default function AmcLogForm() {
  const { user } = useAuth();
  const [amcValue, setAmcValue] = useState('');
  const [logDate, setLogDate] = useState(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');
  const [entries, setEntries] = useState<AmcEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    const { data } = await supabase
      .from('amc_log')
      .select('*')
      .order('logged_date', { ascending: false })
      .limit(10);
    if (data) setEntries(data as AmcEntry[]);
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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          AMC Log
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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

        {/* Recent entries */}
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