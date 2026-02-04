import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquare, Send, RefreshCw, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { testGroupMeConnection, resendRecapToGroupMe } from '@/lib/groupme';
import { format } from 'date-fns';

interface DailyRecap {
  id: string;
  created_at: string;
  shift_date: string;
  staff_name: string;
  recap_text: string;
  status: string;
  error_message: string | null;
}

export function GroupMeSettings() {
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [recaps, setRecaps] = useState<DailyRecap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');

  const fetchRecaps = async () => {
    setIsLoading(true);
    let query = supabase
      .from('daily_recaps')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (dateFilter) {
      query = query.eq('shift_date', dateFilter);
    }
    if (staffFilter) {
      query = query.ilike('staff_name', `%${staffFilter}%`);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Failed to fetch recaps:', error);
      toast.error('Failed to load recaps');
    } else {
      setRecaps((data as DailyRecap[]) || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchRecaps();
  }, [dateFilter, staffFilter]);

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    const result = await testGroupMeConnection();
    setIsTestingConnection(false);

    if (result.success) {
      toast.success('GroupMe connection successful!', {
        description: 'Test message sent to your GroupMe.',
      });
    } else {
      toast.error('GroupMe connection failed', {
        description: result.error || 'Unknown error',
      });
    }
  };

  const handleResend = async (recapId: string) => {
    setResendingId(recapId);
    const result = await resendRecapToGroupMe(recapId);
    setResendingId(null);

    if (result.success) {
      toast.success('Recap resent successfully!');
      fetchRecaps();
    } else {
      toast.error('Failed to resend', {
        description: result.error || 'Unknown error',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-success"><CheckCircle className="w-3 h-3 mr-1" />Sent</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const failedRecaps = recaps.filter(r => r.status === 'failed');

  return (
    <div className="space-y-4">
      {/* Connection Test */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            GroupMe Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Shift recaps are automatically posted to GroupMe when submitted.
          </p>
          <Button 
            onClick={handleTestConnection}
            disabled={isTestingConnection}
            variant="outline"
          >
            {isTestingConnection ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Test GroupMe Connection
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Failed Recaps Alert */}
      {failedRecaps.length > 0 && (
        <Card className="border-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              {failedRecaps.length} Failed Recap{failedRecaps.length > 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">
              These recaps failed to post to GroupMe. Click resend to retry.
            </p>
            {failedRecaps.slice(0, 3).map((recap) => (
              <div key={recap.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="text-sm">
                  <span className="font-medium">{recap.staff_name}</span>
                  <span className="text-muted-foreground"> - {recap.shift_date}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleResend(recap.id)}
                  disabled={resendingId === recap.id}
                >
                  {resendingId === recap.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Resend
                    </>
                  )}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recaps History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Daily Recaps Log</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-2 mb-4">
            <div className="flex-1">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs">Staff</Label>
              <Input
                placeholder="Filter by name..."
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button variant="ghost" size="icon" onClick={fetchRecaps}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : recaps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No recaps found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Staff</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recaps.map((recap) => (
                    <TableRow key={recap.id}>
                      <TableCell className="text-sm">{recap.staff_name}</TableCell>
                      <TableCell className="text-sm">{recap.shift_date}</TableCell>
                      <TableCell>{getStatusBadge(recap.status)}</TableCell>
                      <TableCell>
                        {recap.status === 'failed' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleResend(recap.id)}
                            disabled={resendingId === recap.id}
                          >
                            {resendingId === recap.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
