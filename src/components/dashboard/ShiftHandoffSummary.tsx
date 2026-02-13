import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, MessageSquare, Users, TrendingUp, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

interface ShiftHandoffSummaryProps {
  todayCompletedCount: number;
  todayActiveCount: number;
  scriptsSentCount: number;
  followUpsSentCount: number;
  userName: string;
}

export function ShiftHandoffSummary({
  todayCompletedCount,
  todayActiveCount,
  scriptsSentCount,
  followUpsSentCount,
  userName,
}: ShiftHandoffSummaryProps) {
  const totalActions = todayCompletedCount + scriptsSentCount + followUpsSentCount;
  
  if (totalActions === 0) return null;

  const metrics = [
    { icon: CheckCircle2, label: 'Intros Logged', value: todayCompletedCount, color: 'text-success' },
    { icon: MessageSquare, label: 'Scripts Sent', value: scriptsSentCount, color: 'text-info' },
    { icon: Users, label: 'Follow-Ups', value: followUpsSentCount, color: 'text-warning' },
  ].filter(m => m.value > 0);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-primary" />
          Today's Shift Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {metrics.map(m => (
            <div key={m.label} className="text-center">
              <m.icon className={`w-4 h-4 mx-auto mb-1 ${m.color}`} />
              <p className="text-xl font-bold">{m.value}</p>
              <p className="text-[10px] text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>
        {todayActiveCount > 0 && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            {todayActiveCount} intro{todayActiveCount !== 1 ? 's' : ''} still pending
          </p>
        )}
      </CardContent>
    </Card>
  );
}
