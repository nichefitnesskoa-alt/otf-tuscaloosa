import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Megaphone, Trash2, Calendar } from 'lucide-react';
import { format, isAfter, isBefore, parseISO } from 'date-fns';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from '@/components/ui/dialog';

interface Campaign {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  offer_description: string | null;
  target_audience: string | null;
  created_at: string;
  send_count?: number;
}

export default function CampaignsPanel() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [offer, setOffer] = useState('');
  const [audience, setAudience] = useState('');

  useEffect(() => { fetchCampaigns(); }, []);

  const fetchCampaigns = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      // Get send counts
      const { data: sends } = await supabase
        .from('campaign_sends')
        .select('campaign_id');

      const countMap = new Map<string, number>();
      sends?.forEach(s => countMap.set(s.campaign_id, (countMap.get(s.campaign_id) || 0) + 1));

      setCampaigns(data.map(c => ({ ...c, send_count: countMap.get(c.id) || 0 })));
    }
    setIsLoading(false);
  };

  const handleCreate = async () => {
    if (!name || !startDate) {
      toast.error('Name and start date required');
      return;
    }
    const { error } = await supabase.from('campaigns').insert({
      name,
      start_date: startDate,
      end_date: endDate || null,
      offer_description: offer || null,
      target_audience: audience || null,
    });
    if (error) {
      toast.error('Failed to create campaign');
    } else {
      toast.success('Campaign created!');
      setShowCreate(false);
      setName(''); setStartDate(''); setEndDate(''); setOffer(''); setAudience('');
      fetchCampaigns();
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('campaigns').delete().eq('id', id);
    toast.success('Campaign deleted');
    fetchCampaigns();
  };

  const getStatus = (c: Campaign) => {
    const now = new Date();
    const start = parseISO(c.start_date);
    if (isBefore(now, start)) return 'upcoming';
    if (c.end_date && isAfter(now, parseISO(c.end_date))) return 'ended';
    return 'active';
  };

  const statusColors: Record<string, string> = {
    active: 'bg-success text-success-foreground',
    upcoming: 'bg-info text-info-foreground',
    ended: 'bg-muted text-muted-foreground',
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Megaphone className="w-4 h-4" />
          Campaigns
        </CardTitle>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1">
              <Plus className="w-4 h-4" /> New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Campaign</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Campaign Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Spring Promo" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Start Date</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Offer Description</Label>
                <Textarea value={offer} onChange={e => setOffer(e.target.value)} placeholder="Free week trial..." />
              </div>
              <div>
                <Label>Target Audience</Label>
                <Input value={audience} onChange={e => setAudience(e.target.value)} placeholder="All leads, VIP only..." />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No campaigns yet</p>
        ) : (
          campaigns.map(c => {
            const status = getStatus(c);
            return (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{c.name}</p>
                    <Badge className={`${statusColors[status]} text-[10px]`}>{status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    {format(parseISO(c.start_date), 'MMM d')}
                    {c.end_date && ` – ${format(parseISO(c.end_date), 'MMM d')}`}
                    {c.send_count ? ` · ${c.send_count} sends` : ''}
                  </p>
                  {c.offer_description && (
                    <p className="text-xs text-muted-foreground">{c.offer_description}</p>
                  )}
                </div>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(c.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
