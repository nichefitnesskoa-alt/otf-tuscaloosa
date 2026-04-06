import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Send, Inbox } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ScriptSendDrawer } from '@/components/scripts/ScriptSendDrawer';

interface NewLead {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  source: string;
  created_at: string;
}

interface NewLeadsAlertProps {
  onOpenScript?: (leadName: string) => void;
}

export function NewLeadsAlert({ onOpenScript }: NewLeadsAlertProps) {
  const { user } = useAuth();
  const [leads, setLeads] = useState<NewLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [touchedLeadIds, setTouchedLeadIds] = useState<Set<string>>(new Set());

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<NewLead | null>(null);

  useEffect(() => {
    const fetchNewLeads = async () => {
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

      const { data: newLeads } = await supabase
        .from('leads')
        .select('id, first_name, last_name, phone, source, created_at')
        .eq('stage', 'new')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false });

      if (!newLeads || newLeads.length === 0) {
        setLeads([]);
        setLoading(false);
        return;
      }

      const ids = newLeads.map(l => l.id);
      const { data: activities } = await supabase
        .from('lead_activities')
        .select('lead_id')
        .in('lead_id', ids);

      const touchedIds = new Set((activities || []).map(a => a.lead_id));
      const untouched = newLeads.filter(l => !touchedIds.has(l.id));

      setLeads(untouched);
      setLoading(false);
    };

    fetchNewLeads();
    const interval = setInterval(fetchNewLeads, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenScript = (lead: NewLead) => {
    setSelectedLead(lead);
    setDrawerOpen(true);
  };

  const handleDrawerClose = (open: boolean) => {
    if (!open && selectedLead) {
      // Mark as touched visually
      setTouchedLeadIds(prev => new Set(prev).add(selectedLead.id));
      setSelectedLead(null);
    }
    setDrawerOpen(open);
  };

  // Always render — show empty state if no leads
  if (loading) {
    return (
      <Card className="border border-border bg-muted/10">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Inbox className="w-4 h-4 text-muted-foreground shrink-0" />
            <p className="text-sm font-bold">New Leads</p>
          </div>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (leads.length === 0) {
    return (
      <Card className="border border-border bg-muted/10">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <Inbox className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-bold">New Leads</p>
              <p className="text-xs text-muted-foreground">No new leads right now. When one comes in, it appears here first.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-2 border-amber-500/40 bg-amber-500/5">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-bold">New Leads — Respond Now</p>
              <p className="text-xs text-muted-foreground">{leads.length} new lead{leads.length !== 1 ? 's' : ''} waiting for a first touch</p>
            </div>
          </div>

          <div className="divide-y divide-border">
            {leads.map(lead => {
              const isTouched = touchedLeadIds.has(lead.id);
              return (
                <div key={lead.id} className="flex items-center justify-between py-2 gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{lead.first_name} {lead.last_name}</p>
                      {isTouched && (
                        <Badge className="text-[10px] h-4 bg-green-600/20 text-green-500 border-green-500/30 hover:bg-green-600/20">Touched</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{lead.source}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(parseISO(lead.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 text-xs gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 min-h-[44px] cursor-pointer"
                    onClick={() => handleOpenScript(lead)}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send Script
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Script Send Drawer */}
      <ScriptSendDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
        leadId={selectedLead?.id}
        leadName={selectedLead ? `${selectedLead.first_name} ${selectedLead.last_name}` : null}
        leadPhone={selectedLead?.phone || null}
        categoryFilter={['web_lead', 'cold_lead']}
        saName={user?.name || 'Unknown'}
      />
    </>
  );
}
