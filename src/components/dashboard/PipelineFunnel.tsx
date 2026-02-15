import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDown, Users, UserCheck, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PipelineFunnelProps {
  booked: number;
  showed: number;
  sold: number;
  revenue?: number;
  className?: string;
}

export function PipelineFunnel({
  booked,
  showed,
  sold,
  className,
}: PipelineFunnelProps) {
  const showRate = booked > 0 ? (showed / booked) * 100 : 0;
  const closeRate = showed > 0 ? (sold / showed) * 100 : 0;
  const overallRate = booked > 0 ? (sold / booked) * 100 : 0;

  const stages = [
    {
      label: 'Booked',
      value: booked,
      icon: Users,
      color: 'bg-info/20 text-info border-info/30',
      rate: null,
    },
    {
      label: 'Showed',
      value: showed,
      icon: UserCheck,
      color: 'bg-warning/20 text-warning border-warning/30',
      rate: showRate,
      rateLabel: 'Show Rate',
    },
    {
      label: 'Sold',
      value: sold,
      icon: Target,
      color: 'bg-success/20 text-success border-success/30',
      rate: closeRate,
      rateLabel: 'Close Rate',
    },
  ];

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          Pipeline Funnel
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Booked → Showed → Sold → Revenue
        </p>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex flex-col items-center gap-1">
          {stages.map((stage, index) => (
            <div key={stage.label} className="w-full">
              <div
                className={cn(
                  'relative flex items-center justify-between p-3 rounded-lg border transition-all',
                  stage.color
                )}
                style={{
                  width: `${100 - index * 10}%`,
                  marginLeft: 'auto',
                  marginRight: 'auto',
                }}
              >
                <div className="flex items-center gap-2">
                  <stage.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{stage.label}</span>
                </div>
                <span className="text-lg font-bold">{stage.value}</span>
              </div>
              {index < stages.length - 1 && (
                <div className="flex items-center justify-center my-1">
                  <ArrowDown className="w-4 h-4 text-muted-foreground" />
                  {stages[index + 1].rate !== null && (
                    <span className={cn(
                      'ml-2 text-xs font-medium',
                      stages[index + 1].rate >= 75 ? 'text-success' :
                      stages[index + 1].rate >= 50 ? 'text-warning' : 'text-destructive'
                    )}>
                      {stages[index + 1].rate.toFixed(0)}%
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Overall Stats */}
        <div className="mt-4 pt-3 border-t flex justify-center text-xs text-muted-foreground">
          <span>Booking-to-Sale Rate: <span className="font-medium text-foreground">{overallRate.toFixed(0)}%</span></span>
        </div>
      </CardContent>
    </Card>
  );
}
