import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Timer, MessageCircle, Users } from 'lucide-react';
import { SALeadMeasure } from '@/hooks/useLeadMeasures';

interface Props {
  data: SALeadMeasure[];
  loading?: boolean;
}

function formatSpeed(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function speedColor(minutes: number | null): string {
  if (minutes === null) return 'text-muted-foreground';
  if (minutes <= 15) return 'text-success';
  if (minutes <= 60) return 'text-warning';
  return 'text-destructive';
}

export function OutreachTable({ data, loading }: Props) {
  if (loading) return <div className="text-xs text-muted-foreground py-4 text-center">Loading outreach data…</div>;
  if (data.length === 0) return <div className="text-xs text-muted-foreground py-4 text-center">No data for this period</div>;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Outreach by SA</CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left py-2 pr-2 font-medium text-muted-foreground">SA</th>
                  <th className="text-center py-2 px-1 font-medium text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-help">
                          <Timer className="w-3 h-3 mx-auto" />
                          <span className="block text-[9px]">Speed</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[200px] text-xs">
                        <p><strong>Speed to Lead</strong></p>
                        <p>Average time from when a lead is created to first contact (call, text, DM, or email).</p>
                      </TooltipContent>
                    </Tooltip>
                  </th>
                  <th className="text-center py-2 px-1 font-medium text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-help">
                          <MessageCircle className="w-3 h-3 mx-auto" />
                          <span className="block text-[9px]">FU</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[200px] text-xs">
                        <p><strong>Follow-Up Touches</strong></p>
                        <p>Total follow-up touches logged (calls, texts, DMs) for this SA.</p>
                      </TooltipContent>
                    </Tooltip>
                  </th>
                  <th className="text-center py-2 px-1 font-medium text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-help">
                          <span className="block text-[9px]">DMs</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[200px] text-xs">
                        <p><strong>DMs Sent</strong></p>
                        <p>Total DMs sent as reported in shift recaps.</p>
                      </TooltipContent>
                    </Tooltip>
                  </th>
                  <th className="text-center py-2 px-1 font-medium text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-help">
                          <Users className="w-3 h-3 mx-auto" />
                          <span className="block text-[9px]">Leads</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[200px] text-xs">
                        <p><strong>Leads Reached</strong></p>
                        <p>Number of unique leads this SA made first contact with.</p>
                      </TooltipContent>
                    </Tooltip>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((sa) => (
                  <tr key={sa.saName} className="border-b border-border/30 last:border-0">
                    <td className="py-1.5 pr-2 font-medium truncate max-w-[80px]">{sa.saName}</td>
                    <td className={`text-center py-1.5 px-1 font-semibold ${speedColor(sa.speedToLead)}`}>
                      {formatSpeed(sa.speedToLead)}
                    </td>
                    <td className="text-center py-1.5 px-1 font-semibold">{sa.followUpTouches}</td>
                    <td className="text-center py-1.5 px-1 font-semibold">{sa.dmsSent}</td>
                    <td className="text-center py-1.5 px-1 font-semibold">{sa.leadsReachedOut}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TooltipProvider>
        <p className="text-[10px] text-muted-foreground mt-2">
          Speed = avg time to first contact · FU = follow-up touches · DMs = from shift recaps · Leads = unique leads contacted
        </p>
      </CardContent>
    </Card>
  );
}
