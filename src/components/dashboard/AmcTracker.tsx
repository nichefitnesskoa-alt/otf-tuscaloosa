import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, Target } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { LineChart, Line, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis } from 'recharts';

const AMC_TARGET = 400;

interface AmcEntry {
  id: string;
  logged_date: string;
  amc_value: number;
  note: string | null;
  created_at: string;
}

export function AmcTracker() {
  const [entries, setEntries] = useState<AmcEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    const { data } = await supabase
      .from('amc_log')
      .select('*')
      .order('logged_date', { ascending: true });
    if (data) setEntries(data as AmcEntry[]);
    setIsLoading(false);
  };

  if (isLoading || entries.length === 0) return null;

  const latest = entries[entries.length - 1];
  const previous = entries.length > 1 ? entries[entries.length - 2] : null;
  const netChange = previous ? latest.amc_value - previous.amc_value : 0;
  const progressPct = Math.min((latest.amc_value / AMC_TARGET) * 100, 100);

  const chartData = entries.slice(-30).map(e => ({
    date: format(parseISO(e.logged_date), 'M/d'),
    amc: e.amc_value,
  }));

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            AMC Tracker
          </span>
          <Badge variant="outline" className="text-xs">
            Target: {AMC_TARGET}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current Value */}
        <div className="flex items-end gap-3">
          <span className="text-4xl font-bold">{latest.amc_value}</span>
          {netChange !== 0 && (
            <span className={`flex items-center gap-0.5 text-sm font-medium pb-1 ${netChange > 0 ? 'text-success' : 'text-destructive'}`}>
              {netChange > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {netChange > 0 ? '+' : ''}{netChange} since {previous ? format(parseISO(previous.logged_date), 'MMM d') : ''}
            </span>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progressPct.toFixed(0)}% to goal</span>
            <span>{AMC_TARGET - latest.amc_value} to go</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>

        {/* Sparkline */}
        {chartData.length > 1 && (
          <div className="h-16">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="date" hide />
                <RechartsTooltip
                  contentStyle={{ fontSize: '11px', padding: '4px 8px' }}
                  formatter={(value: number) => [value, 'AMC']}
                />
                <Line
                  type="monotone"
                  dataKey="amc"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Latest note */}
        {latest.note && (
          <p className="text-xs text-muted-foreground italic">"{latest.note}"</p>
        )}
      </CardContent>
    </Card>
  );
}