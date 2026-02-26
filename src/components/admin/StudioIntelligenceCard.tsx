import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Brain, RefreshCw, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface StudioIntelligenceData {
  report_date: string;
  intros_ran: number;
  sales: number;
  close_rate: number;
  best_source: string;
  best_source_rate: number;
  top_sa: string;
  top_sa_rate: number;
  top_objection: string;
  top_objection_count: number;
  pending_followups: number;
  report_text: string;
}

interface StudioIntelligenceCardProps {
  dismissible?: boolean;
  onDismiss?: () => void;
}

export function StudioIntelligenceCard({ dismissible = false, onDismiss }: StudioIntelligenceCardProps) {
  const [data, setData] = useState<StudioIntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchLatest();
  }, []);

  const fetchLatest = async () => {
    setLoading(true);
    const { data: rows } = await supabase
      .from('studio_intelligence')
      .select('content_json')
      .order('report_date', { ascending: false })
      .limit(1);
    if (rows && rows.length > 0) {
      setData((rows[0] as any).content_json as StudioIntelligenceData);
    }
    setLoading(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: '{}',
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchLatest();
    } catch (err: any) {
      console.error('Generate failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return null;
  if (!data) {
    return (
      <Card className="border-primary/30">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Brain className="w-4 h-4" />
            No intelligence report yet
          </div>
          <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating} className="h-7 text-xs">
            <RefreshCw className={`w-3 h-3 mr-1 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generating…' : 'Generate Now'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            📊 Studio Intelligence — {data.report_date}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={handleGenerate} disabled={generating} className="h-6 w-6 p-0">
              <RefreshCw className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
            </Button>
            {dismissible && onDismiss && (
              <Button size="sm" variant="ghost" onClick={onDismiss} className="h-6 w-6 p-0">
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md bg-background p-2 text-center">
            <div className="text-lg font-bold">{data.intros_ran}</div>
            <div className="text-muted-foreground">Intros</div>
          </div>
          <div className="rounded-md bg-background p-2 text-center">
            <div className="text-lg font-bold text-green-600">{data.sales}</div>
            <div className="text-muted-foreground">Sales</div>
          </div>
          <div className="rounded-md bg-background p-2 text-center">
            <div className="text-lg font-bold">{data.close_rate}%</div>
            <div className="text-muted-foreground">Close Rate</div>
          </div>
        </div>

        {/* Key insights */}
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px]">Best Source</Badge>
            <span>{data.best_source} ({data.best_source_rate}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px]">Top SA</Badge>
            <span>{data.top_sa} ({data.top_sa_rate}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px]">Top Objection</Badge>
            <span>{data.top_objection} ({data.top_objection_count}x)</span>
          </div>
          {data.pending_followups > 0 && (
            <div className="flex items-center gap-1.5">
              <Badge variant="destructive" className="text-[10px]">Follow-ups</Badge>
              <span>{data.pending_followups} pending</span>
            </div>
          )}
        </div>

        {/* AI Report */}
        {data.report_text && (
          <div className="rounded-md bg-background border p-3 text-xs leading-relaxed whitespace-pre-line">
            {data.report_text}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
