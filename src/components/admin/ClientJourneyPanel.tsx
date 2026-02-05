import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  RefreshCw, 
  Loader2,
  Search,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  User,
  Calendar,
  DollarSign,
  Target,
  Wand2,
  Eye
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ALL_STAFF, SALES_ASSOCIATES } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { capitalizeName } from '@/lib/utils';
import { isMembershipSale } from '@/lib/sales-detection';

interface ClientBooking {
  id: string;
  booking_id: string | null;
  member_name: string;
  class_date: string;
  intro_time: string | null;
  sa_working_shift: string;
  booked_by: string | null;
  lead_source: string;
  booking_status: string | null;
  intro_owner: string | null;
  intro_owner_locked: boolean | null;
}

interface ClientRun {
  id: string;
  member_name: string;
  run_date: string | null;
  class_time: string;
  result: string;
  intro_owner: string | null;
  ran_by: string | null;
  commission_amount: number | null;
  linked_intro_booked_id: string | null;
}

interface ClientJourney {
  memberKey: string;
  memberName: string;
  bookings: ClientBooking[];
  runs: ClientRun[];
  // Derived
  hasInconsistency: boolean;
  inconsistencyType: string | null;
  hasSale: boolean;
  totalCommission: number;
  latestIntroOwner: string | null;
  status: 'active' | 'purchased' | 'not_interested' | 'no_show' | 'unknown';
}

// Sync intro_owner from run to linked booking (real-time sync utility)
export async function syncIntroOwnerToBooking(
  bookingId: string, 
  introOwner: string,
  editor: string = 'System'
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('intros_booked')
      .update({
        intro_owner: introOwner,
        intro_owner_locked: true,
        last_edited_at: new Date().toISOString(),
        last_edited_by: `${editor} (Auto-Sync)`,
        edit_reason: 'Synced intro_owner from linked run',
      })
      .eq('id', bookingId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error syncing intro_owner:', error);
    return false;
  }
}

export default function ClientJourneyPanel() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterInconsistencies, setFilterInconsistencies] = useState(false);
  const [journeys, setJourneys] = useState<ClientJourney[]>([]);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  
  // Auto-fix dialog
  const [showFixDialog, setShowFixDialog] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [fixResults, setFixResults] = useState<{ fixed: number; errors: number } | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [bookingsRes, runsRes] = await Promise.all([
        supabase
          .from('intros_booked')
          .select('id, booking_id, member_name, class_date, intro_time, sa_working_shift, booked_by, lead_source, booking_status, intro_owner, intro_owner_locked')
          .order('class_date', { ascending: false }),
        supabase
          .from('intros_run')
          .select('id, member_name, run_date, class_time, result, intro_owner, ran_by, commission_amount, linked_intro_booked_id')
          .order('run_date', { ascending: false }),
      ]);

      if (bookingsRes.error) throw bookingsRes.error;
      if (runsRes.error) throw runsRes.error;

      const bookings = (bookingsRes.data || []) as ClientBooking[];
      const runs = (runsRes.data || []) as ClientRun[];

      // Group by member_key (lowercase, no spaces)
      const clientMap = new Map<string, { bookings: ClientBooking[]; runs: ClientRun[] }>();

      bookings.forEach(b => {
        const key = b.member_name.toLowerCase().replace(/\s+/g, '');
        if (!clientMap.has(key)) {
          clientMap.set(key, { bookings: [], runs: [] });
        }
        clientMap.get(key)!.bookings.push(b);
      });

      runs.forEach(r => {
        const key = r.member_name.toLowerCase().replace(/\s+/g, '');
        if (!clientMap.has(key)) {
          clientMap.set(key, { bookings: [], runs: [] });
        }
        clientMap.get(key)!.runs.push(r);
      });

      // Build journeys with inconsistency detection
      const clientJourneys: ClientJourney[] = [];

      clientMap.forEach((data, key) => {
        const memberName = data.bookings[0]?.member_name || data.runs[0]?.member_name || key;
        
        // Detect inconsistencies
        let hasInconsistency = false;
        let inconsistencyType: string | null = null;

        // Check for linked runs where booking has different intro_owner
        data.runs.forEach(run => {
          if (run.linked_intro_booked_id) {
            const linkedBooking = data.bookings.find(b => b.id === run.linked_intro_booked_id);
            if (linkedBooking) {
              const runOwner = run.intro_owner || run.ran_by;
              if (runOwner && linkedBooking.intro_owner !== runOwner && run.result !== 'No-show') {
                hasInconsistency = true;
                inconsistencyType = `Run shows ${runOwner} but booking shows ${linkedBooking.intro_owner || 'none'}`;
              }
            }
          }
        });

        // Check for corrupted intro_owner (timestamp values)
        data.bookings.forEach(b => {
          if (b.intro_owner && (b.intro_owner.includes('T') && b.intro_owner.includes(':'))) {
            hasInconsistency = true;
            inconsistencyType = 'Corrupted intro_owner (timestamp value)';
          }
        });

        // Determine status
        let status: ClientJourney['status'] = 'unknown';
        const hasSale = data.runs.some(r => isMembershipSale(r.result));
        const hasNotInterested = data.bookings.some(b => b.booking_status === 'Not interested');
        const hasClosed = data.bookings.some(b => b.booking_status === 'Closed (Purchased)');
        const hasActive = data.bookings.some(b => b.booking_status === 'Active' || !b.booking_status);
        const hasNoShow = data.runs.some(r => r.result === 'No-show');

        if (hasSale || hasClosed) {
          status = 'purchased';
        } else if (hasNotInterested) {
          status = 'not_interested';
        } else if (hasNoShow && !hasActive) {
          status = 'no_show';
        } else if (hasActive) {
          status = 'active';
        }

        // Get latest intro_owner
        const latestRun = data.runs.find(r => r.result !== 'No-show');
        const latestIntroOwner = latestRun?.intro_owner || latestRun?.ran_by || data.bookings[0]?.intro_owner || null;

        // Calculate total commission
        const totalCommission = data.runs.reduce((sum, r) => sum + (r.commission_amount || 0), 0);

        clientJourneys.push({
          memberKey: key,
          memberName: capitalizeName(memberName) || memberName,
          bookings: data.bookings,
          runs: data.runs,
          hasInconsistency,
          inconsistencyType,
          hasSale,
          totalCommission,
          latestIntroOwner: capitalizeName(latestIntroOwner),
          status,
        });
      });

      // Sort: inconsistencies first, then by recent activity
      clientJourneys.sort((a, b) => {
        if (a.hasInconsistency && !b.hasInconsistency) return -1;
        if (!a.hasInconsistency && b.hasInconsistency) return 1;
        
        const aDate = a.runs[0]?.run_date || a.bookings[0]?.class_date || '';
        const bDate = b.runs[0]?.run_date || b.bookings[0]?.class_date || '';
        return bDate.localeCompare(aDate);
      });

      setJourneys(clientJourneys);
    } catch (error) {
      console.error('Error fetching client data:', error);
      toast.error('Failed to load client data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredJourneys = useMemo(() => {
    let filtered = journeys;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(j => 
        j.memberName.toLowerCase().includes(term) ||
        j.latestIntroOwner?.toLowerCase().includes(term)
      );
    }

    if (filterInconsistencies) {
      filtered = filtered.filter(j => j.hasInconsistency);
    }

    return filtered;
  }, [journeys, searchTerm, filterInconsistencies]);

  const inconsistencyCount = useMemo(() => 
    journeys.filter(j => j.hasInconsistency).length,
    [journeys]
  );

  const toggleExpand = (key: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Auto-fix all inconsistencies
  const handleAutoFix = async () => {
    setIsFixing(true);
    setFixResults(null);
    
    let fixed = 0;
    let errors = 0;

    try {
      const inconsistentJourneys = journeys.filter(j => j.hasInconsistency);

      for (const journey of inconsistentJourneys) {
        for (const run of journey.runs) {
          if (run.linked_intro_booked_id && run.result !== 'No-show') {
            const runOwner = run.intro_owner || run.ran_by;
            if (runOwner) {
              const linkedBooking = journey.bookings.find(b => b.id === run.linked_intro_booked_id);
              if (linkedBooking && linkedBooking.intro_owner !== runOwner) {
                const success = await syncIntroOwnerToBooking(
                  run.linked_intro_booked_id,
                  runOwner,
                  user?.name || 'Admin'
                );
                if (success) {
                  fixed++;
                } else {
                  errors++;
                }
              }
            }
          }
        }

        // Fix corrupted intro_owner values
        for (const booking of journey.bookings) {
          if (booking.intro_owner && booking.intro_owner.includes('T') && booking.intro_owner.includes(':')) {
            // Find the run's intro_owner to use
            const linkedRun = journey.runs.find(r => 
              r.linked_intro_booked_id === booking.id && r.result !== 'No-show'
            );
            const correctOwner = linkedRun?.intro_owner || linkedRun?.ran_by || null;
            
            const { error } = await supabase
              .from('intros_booked')
              .update({
                intro_owner: correctOwner,
                intro_owner_locked: !!correctOwner,
                last_edited_at: new Date().toISOString(),
                last_edited_by: `${user?.name || 'Admin'} (Auto-Fix)`,
                edit_reason: 'Fixed corrupted intro_owner value',
              })
              .eq('id', booking.id);

            if (error) {
              errors++;
            } else {
              fixed++;
            }
          }
        }
      }

      setFixResults({ fixed, errors });
      if (fixed > 0) {
        toast.success(`Fixed ${fixed} inconsistencies`);
        await fetchData();
      }
    } catch (error) {
      console.error('Error auto-fixing:', error);
      toast.error('Failed to auto-fix');
    } finally {
      setIsFixing(false);
    }
  };

  const getStatusBadge = (status: ClientJourney['status']) => {
    switch (status) {
      case 'purchased':
        return <Badge className="bg-success text-success-foreground">Purchased</Badge>;
      case 'not_interested':
        return <Badge variant="secondary">Not Interested</Badge>;
      case 'no_show':
        return <Badge variant="destructive">No-show</Badge>;
      case 'active':
        return <Badge variant="outline">Active</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4" />
            Client Journey View
          </CardTitle>
          <div className="flex items-center gap-2">
            {inconsistencyCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFixDialog(true)}
                className="text-warning"
              >
                <Wand2 className="w-4 h-4 mr-1" />
                Fix {inconsistencyCount}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchData}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Unified view of client bookings, runs, and outcomes
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or intro owner..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button
            variant={filterInconsistencies ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterInconsistencies(!filterInconsistencies)}
          >
            <AlertTriangle className="w-4 h-4 mr-1" />
            Issues ({inconsistencyCount})
          </Button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className="p-2 bg-muted/50 rounded">
            <div className="font-bold">{journeys.length}</div>
            <div className="text-muted-foreground">Clients</div>
          </div>
          <div className="p-2 bg-muted/50 rounded">
            <div className="font-bold text-success">{journeys.filter(j => j.hasSale).length}</div>
            <div className="text-muted-foreground">Purchased</div>
          </div>
          <div className="p-2 bg-muted/50 rounded">
            <div className="font-bold text-primary">{journeys.filter(j => j.status === 'active').length}</div>
            <div className="text-muted-foreground">Active</div>
          </div>
          <div className="p-2 bg-muted/50 rounded">
            <div className="font-bold text-warning">{inconsistencyCount}</div>
            <div className="text-muted-foreground">Issues</div>
          </div>
        </div>

        {/* Client list */}
        <ScrollArea className="h-[500px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredJourneys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No clients found
            </div>
          ) : (
            <div className="space-y-2">
              {filteredJourneys.slice(0, 100).map((journey) => (
                <Collapsible
                  key={journey.memberKey}
                  open={expandedClients.has(journey.memberKey)}
                  onOpenChange={() => toggleExpand(journey.memberKey)}
                >
                  <CollapsibleTrigger asChild>
                    <div
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        journey.hasInconsistency 
                          ? 'bg-warning/10 border border-warning/30 hover:bg-warning/20' 
                          : 'bg-muted/50 hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {expandedClients.has(journey.memberKey) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                          <span className="font-medium">{journey.memberName}</span>
                          {journey.hasInconsistency && (
                            <AlertTriangle className="w-4 h-4 text-warning" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(journey.status)}
                          {journey.totalCommission > 0 && (
                            <Badge variant="outline" className="text-success">
                              ${journey.totalCommission.toFixed(0)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>{journey.bookings.length} booking(s)</span>
                        <span>{journey.runs.length} run(s)</span>
                        {journey.latestIntroOwner && (
                          <span>Owner: {journey.latestIntroOwner}</span>
                        )}
                      </div>
                      {journey.hasInconsistency && journey.inconsistencyType && (
                        <div className="mt-1 text-xs text-warning">
                          ⚠️ {journey.inconsistencyType}
                        </div>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-6 mt-2 space-y-3 pb-2">
                      {/* Bookings */}
                      {journey.bookings.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Bookings
                          </div>
                          <div className="space-y-1">
                            {journey.bookings.map(b => (
                              <div key={b.id} className="text-xs p-2 bg-background rounded border flex justify-between">
                                <div>
                                  <span className="font-medium">{b.class_date}</span>
                                  {b.intro_time && <span className="text-muted-foreground"> @ {b.intro_time}</span>}
                                  <div className="text-muted-foreground">
                                    Booked by: {capitalizeName(b.booked_by || b.sa_working_shift)}
                                    {b.intro_owner && <span> | Owner: {capitalizeName(b.intro_owner)}</span>}
                                  </div>
                                </div>
                                <Badge variant="outline" className="h-5">
                                  {b.booking_status || 'Active'}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Runs */}
                      {journey.runs.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                            <Target className="w-3 h-3" /> Intro Runs
                          </div>
                          <div className="space-y-1">
                            {journey.runs.map(r => (
                              <div key={r.id} className="text-xs p-2 bg-background rounded border flex justify-between">
                                <div>
                                  <span className="font-medium">{r.run_date || 'No date'}</span>
                                  <span className="text-muted-foreground"> @ {r.class_time}</span>
                                  <div className="text-muted-foreground">
                                    Ran by: {capitalizeName(r.ran_by)}
                                    {r.intro_owner && <span> | Owner: {capitalizeName(r.intro_owner)}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge 
                                    variant={isMembershipSale(r.result) ? 'default' : 'outline'}
                                    className={isMembershipSale(r.result) ? 'bg-success' : ''}
                                  >
                                    {r.result}
                                  </Badge>
                                  {(r.commission_amount || 0) > 0 && (
                                    <span className="text-success font-medium">${r.commission_amount}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
              {filteredJourneys.length > 100 && (
                <div className="text-center text-xs text-muted-foreground py-2">
                  Showing first 100 of {filteredJourneys.length} clients
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Auto-fix dialog */}
        <Dialog open={showFixDialog} onOpenChange={setShowFixDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Fix Attribution Inconsistencies</DialogTitle>
              <DialogDescription>
                Found {inconsistencyCount} client(s) with mismatched intro_owner between runs and bookings.
                This will sync the intro_owner from runs to their linked bookings.
              </DialogDescription>
            </DialogHeader>
            
            {fixResults && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-success" />
                  <span>Fixed {fixResults.fixed} records</span>
                </div>
                {fixResults.errors > 0 && (
                  <div className="flex items-center gap-2 mt-2 text-destructive">
                    <AlertTriangle className="w-5 h-5" />
                    <span>{fixResults.errors} errors</span>
                  </div>
                )}
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowFixDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAutoFix} disabled={isFixing}>
                {isFixing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    Fixing...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-1" />
                    Fix All
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
