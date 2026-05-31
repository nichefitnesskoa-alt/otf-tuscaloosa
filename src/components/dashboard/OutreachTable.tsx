import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Timer, MessageCircle, Users } from 'lucide-react';
import { SALeadMeasure } from '@/hooks/useLeadMeasures';
import { PersonListDrillDown, DrillNumber, PersonRow } from './PersonListDrillDown';
import { useJourneyCard } from '@/components/person/useJourneyCard';

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

function speedColor(minutes: number | null): 'success' | 'warning' | 'destructive' | 'default' {
  if (minutes === null) return 'default';
  if (minutes <= 15) return 'success';
  if (minutes <= 60) return 'warning';
  return 'destructive';
}

export function OutreachTable({ data, loading }: Props) {
  const journey = useJourneyCard('Studio · Outreach');
  const [drill, setDrill] = useState<{ sa: string; metric: 'fu' | 'dm' | 'leads' } | null>(null);

  const drillRows: PersonRow[] = useMemo(() => {
    if (!drill) return [];
    const sa = data.find(s => s.saName === drill.sa);
    if (!sa) return [];
    const base = drill.metric === 'fu' ? (sa.followUpPeople || [])
      : drill.metric === 'dm' ? (sa.dmPeople || [])
      : (sa.leadsReachedPeople || []);
    // Name-only resolve — these rows are aggregations, no bookingId attached.
    return base.map(r => ({
      ...r,
      onClick: () => journey.open({ name: r.name }),
    }));
  }, [drill, data, journey]);

  if (loading) return <div className="text-xs text-muted-foreground py-4 text-center">Loading outreach data…</div>;
  if (data.length === 0) return <div className="text-xs text-muted-foreground py-4 text-center">No data for this period</div>;

  return (
    <>
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
                    <Tooltip><TooltipTrigger asChild><div className="cursor-help"><Timer className="w-3 h-3 mx-auto" /><span className="block text-[9px]">Speed</span></div></TooltipTrigger><TooltipContent side="top" className="max-w-[200px] text-xs"><p><strong>Speed to Lead</strong></p><p>Avg time from lead created to first contact.</p></TooltipContent></Tooltip>
                  </th>
                  <th className="text-center py-2 px-1 font-medium text-muted-foreground">
                    <Tooltip><TooltipTrigger asChild><div className="cursor-help"><MessageCircle className="w-3 h-3 mx-auto" /><span className="block text-[9px]">FU</span></div></TooltipTrigger><TooltipContent side="top" className="text-xs">Follow-Up Touches</TooltipContent></Tooltip>
                  </th>
                  <th className="text-center py-2 px-1 font-medium text-muted-foreground">
                    <Tooltip><TooltipTrigger asChild><div className="cursor-help"><span className="block text-[9px]">DMs</span></div></TooltipTrigger><TooltipContent side="top" className="text-xs">DMs sent (from shift recaps)</TooltipContent></Tooltip>
                  </th>
                  <th className="text-center py-2 px-1 font-medium text-muted-foreground">
                    <Tooltip><TooltipTrigger asChild><div className="cursor-help"><Users className="w-3 h-3 mx-auto" /><span className="block text-[9px]">Leads</span></div></TooltipTrigger><TooltipContent side="top" className="text-xs">Unique leads first-contacted</TooltipContent></Tooltip>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((sa) => (
                  <tr key={sa.saName} className="border-b border-border/30 last:border-0">
                    <td className="py-1.5 pr-2 font-medium truncate max-w-[80px]">{sa.saName}</td>
                    <td className="text-center py-1.5 px-1">
                      <DrillNumber value={formatSpeed(sa.speedToLead)} onClick={() => setDrill({ sa: sa.saName, metric: 'leads' })} ariaLabel={`View leads for ${sa.saName}`} tone={speedColor(sa.speedToLead)} className="text-xs" />
                    </td>
                    <td className="text-center py-1.5 px-1">
                      <DrillNumber value={sa.followUpTouches} onClick={() => setDrill({ sa: sa.saName, metric: 'fu' })} ariaLabel={`View ${sa.followUpTouches} follow-up touches for ${sa.saName}`} className="text-xs" />
                    </td>
                    <td className="text-center py-1.5 px-1">
                      <DrillNumber value={sa.dmsSent} onClick={() => setDrill({ sa: sa.saName, metric: 'dm' })} ariaLabel={`View DMs for ${sa.saName}`} className="text-xs" />
                    </td>
                    <td className="text-center py-1.5 px-1">
                      <DrillNumber value={sa.leadsReachedOut} onClick={() => setDrill({ sa: sa.saName, metric: 'leads' })} ariaLabel={`View ${sa.leadsReachedOut} leads for ${sa.saName}`} className="text-xs" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TooltipProvider>
        <p className="text-[10px] text-muted-foreground mt-2">Tap any number to see the people behind it.</p>
      </CardContent>
    </Card>
    <PersonListDrillDown
      open={!!drill}
      onOpenChange={(o) => { if (!o) setDrill(null); }}
      title={drill ? `${drill.sa} · ${drill.metric === 'fu' ? 'Follow-up touches' : drill.metric === 'dm' ? 'DMs sent' : 'Leads reached'}` : ''}
      scopeBadge="Studio tab"
      rows={drillRows}
      emptyText="No outreach in this bucket."
    />
    {journey.element}
    </>
  );
}
