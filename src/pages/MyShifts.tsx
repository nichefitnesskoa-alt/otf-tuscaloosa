import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ClipboardList, RefreshCw, Calendar, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import ShiftRecapDetails from '@/components/admin/ShiftRecapDetails';
import { parseLocalDate } from '@/lib/utils';
import { IndividualActivityTable } from '@/components/dashboard/IndividualActivityTable';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { DatePreset, DateRange, getDateRangeForPreset } from '@/lib/pay-period';

interface ShiftRecap {
  id: string;
  staff_name: string;
  shift_date: string;
  shift_type: string;
  calls_made: number | null;
  texts_sent: number | null;
  emails_sent: number | null;
  dms_sent: number | null;
  other_info: string | null;
  created_at: string;
}

export default function MyShifts() {
  const { user } = useAuth();
  const { introsBooked, introsRun, sales, shiftRecaps, lastUpdated: globalLastUpdated } = useData();
  const [recaps, setRecaps] = useState<ShiftRecap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecap, setSelectedRecap] = useState<ShiftRecap | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const hasMountedRef = useRef(false);

  // Date filter for activity
  const [datePreset, setDatePreset] = useState<DatePreset>('pay_period');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const dateRange = useMemo(() => getDateRangeForPreset(datePreset, customRange), [datePreset, customRange]);
  const userName = user?.name || '';
  const metrics = useDashboardMetrics(introsBooked, introsRun, sales, dateRange, shiftRecaps, userName);
  const personalActivity = useMemo(() => {
    return metrics.individualActivity.filter(m => m.saName === userName);
  }, [metrics.individualActivity, userName]);

  const fetchMyRecaps = async () => {
    if (!user?.name) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('shift_recaps')
        .select('id, staff_name, shift_date, shift_type, calls_made, texts_sent, emails_sent, dms_sent, other_info, created_at')
        .eq('staff_name', user.name)
        .order('shift_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setRecaps(data || []);
    } catch (error) {
      console.error('Error fetching shift recaps:', error);
      toast.error('Failed to load your shifts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyRecaps();
    hasMountedRef.current = true;
  }, [user?.name]);

  // Re-fetch when global data is refreshed (e.g., from Admin edits)
  useEffect(() => {
    if (hasMountedRef.current && globalLastUpdated) {
      fetchMyRecaps();
    }
  }, [globalLastUpdated]);

  const handleOpenDetails = (recap: ShiftRecap) => {
    setSelectedRecap(recap);
    setViewDialogOpen(true);
  };

  const getTotalContacts = (recap: ShiftRecap) => {
    return (recap.calls_made || 0) + (recap.texts_sent || 0) + (recap.emails_sent || 0) + (recap.dms_sent || 0);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            My Shifts
          </h1>
          <p className="text-sm text-muted-foreground">
            View your submitted shift recaps
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchMyRecaps} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground text-center">Loading your shifts...</p>
          </CardContent>
        </Card>
      ) : recaps.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground text-center">
              No shift recaps found. Submit a shift recap to see it here!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {recaps.map((recap) => (
            <Card 
              key={recap.id} 
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => handleOpenDetails(recap)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {format(parseLocalDate(recap.shift_date), 'EEEE, MMMM d, yyyy')}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs">
                          {recap.shift_type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {getTotalContacts(recap)} contacts
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Showing {recaps.length} shift{recaps.length !== 1 ? 's' : ''}
      </p>

      {/* My Activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">My Activity</CardTitle>
          <div className="mt-2">
            <DateRangeFilter
              preset={datePreset}
              customRange={customRange}
              onPresetChange={setDatePreset}
              onCustomRangeChange={setCustomRange}
              dateRange={dateRange || { start: new Date(2020, 0, 1), end: new Date() }}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <IndividualActivityTable data={personalActivity} />
        </CardContent>
      </Card>

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Shift Details</DialogTitle>
          </DialogHeader>
          {selectedRecap && (
            <ShiftRecapDetails
              shiftRecapId={selectedRecap.id}
              staffName={selectedRecap.staff_name}
              shiftDate={selectedRecap.shift_date}
              shiftType={selectedRecap.shift_type}
              callsMade={selectedRecap.calls_made || 0}
              textsSent={selectedRecap.texts_sent || 0}
              emailsSent={selectedRecap.emails_sent || 0}
              dmsSent={selectedRecap.dms_sent || 0}
              otherInfo={selectedRecap.other_info}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
