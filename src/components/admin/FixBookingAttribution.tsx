import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle, Loader2, Search, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getSpreadsheetId } from '@/lib/sheets-sync';
import { toast } from 'sonner';
import { SALES_ASSOCIATES } from '@/types';

interface MisattributedBooking {
  id: string;
  booking_id: string | null;
  member_name: string;
  intro_owner: string | null;
  sa_working_shift: string;
  class_date: string;
  suggestedFix: string | null;
}

interface FixBookingAttributionProps {
  onFixComplete?: () => void;
}

export default function FixBookingAttribution({ onFixComplete }: FixBookingAttributionProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isApplyingFixes, setIsApplyingFixes] = useState(false);
  const [misattributed, setMisattributed] = useState<MisattributedBooking[]>([]);
  const [fixes, setFixes] = useState<Record<string, string>>({});

  // Check if a value looks like a member name (lowercase, no spaces) vs a staff name
  const looksLikeMemberName = (value: string): boolean => {
    if (!value) return false;
    // Staff names are proper case with possible spaces
    const staffNames = [...SALES_ASSOCIATES, 'TBD', 'Unknown', ''];
    if (staffNames.includes(value)) return false;
    
    // If it's all lowercase with no spaces, it's likely a member_key
    if (value === value.toLowerCase() && !value.includes(' ')) {
      return true;
    }
    return false;
  };

  const handleScan = async () => {
    setIsScanning(true);
    setMisattributed([]);
    setFixes({});

    try {
      // Fetch all bookings where intro_owner looks like a member name
      const { data: bookings, error } = await supabase
        .from('intros_booked')
        .select('id, booking_id, member_name, intro_owner, sa_working_shift, class_date')
        .not('deleted_at', 'is', null)
        .is('deleted_at', null);

      if (error) throw error;

      const problems: MisattributedBooking[] = [];

      for (const booking of bookings || []) {
        const introOwner = booking.intro_owner || '';
        
        // Check if intro_owner looks like a member_key instead of a staff name
        if (looksLikeMemberName(introOwner)) {
          // Use sa_working_shift as the suggested fix if it's valid
          const saWorking = booking.sa_working_shift || '';
          const suggestedFix = SALES_ASSOCIATES.includes(saWorking as any) ? saWorking : null;

          problems.push({
            id: booking.id,
            booking_id: booking.booking_id,
            member_name: booking.member_name,
            intro_owner: introOwner,
            sa_working_shift: saWorking,
            class_date: booking.class_date,
            suggestedFix,
          });
        }
      }

      setMisattributed(problems);
      
      // Pre-fill suggested fixes
      const initialFixes: Record<string, string> = {};
      problems.forEach(p => {
        if (p.suggestedFix) {
          initialFixes[p.id] = p.suggestedFix;
        }
      });
      setFixes(initialFixes);

      if (problems.length === 0) {
        toast.success('No misattributed bookings found!');
      } else {
        toast.info(`Found ${problems.length} bookings with incorrect intro_owner`);
      }
    } catch (error) {
      console.error('Error scanning bookings:', error);
      toast.error('Failed to scan bookings');
    } finally {
      setIsScanning(false);
    }
  };

  const handleFixChange = (bookingId: string, newOwner: string) => {
    setFixes(prev => ({ ...prev, [bookingId]: newOwner }));
  };

  const handleApplyFixes = async () => {
    const fixesToApply = Object.entries(fixes).filter(([id, owner]) => owner);
    
    if (fixesToApply.length === 0) {
      toast.error('No fixes selected');
      return;
    }

    setIsApplyingFixes(true);
    const spreadsheetId = getSpreadsheetId();
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const [id, newOwner] of fixesToApply) {
        const booking = misattributed.find(b => b.id === id);
        if (!booking) continue;

        // Update database
        const { error: dbError } = await supabase
          .from('intros_booked')
          .update({
            intro_owner: newOwner,
            last_edited_at: new Date().toISOString(),
            last_edited_by: 'Admin (Attribution Fix)',
            edit_reason: `Corrected intro_owner from "${booking.intro_owner}" to "${newOwner}"`,
          })
          .eq('id', id);

        if (dbError) {
          errorCount++;
          console.error('Error updating booking:', dbError);
          continue;
        }

        // Sync to Google Sheets if configured
        if (spreadsheetId && booking.booking_id) {
          try {
            await supabase.functions.invoke('sync-sheets', {
              body: {
                action: 'sync_booking',
                spreadsheetId,
                data: {
                  id,
                  booking_id: booking.booking_id,
                  member_name: booking.member_name,
                  class_date: booking.class_date,
                  intro_owner: newOwner,
                  sa_working_shift: booking.sa_working_shift,
                },
                editedBy: 'Admin (Attribution Fix)',
                editReason: `Corrected intro_owner from "${booking.intro_owner}" to "${newOwner}"`,
              },
            });
          } catch (sheetError) {
            console.warn('Failed to sync to sheets:', sheetError);
          }
        }

        successCount++;
      }

      toast.success(`Fixed ${successCount} bookings`, {
        description: errorCount > 0 ? `${errorCount} failed` : undefined,
      });

      // Clear fixed items from list
      setMisattributed(prev => prev.filter(b => !fixes[b.id]));
      setFixes({});
      
      onFixComplete?.();
    } catch (error) {
      console.error('Error applying fixes:', error);
      toast.error('Failed to apply fixes');
    } finally {
      setIsApplyingFixes(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="w-4 h-4 text-warning" />
            Fix Booking Attribution
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleScan}
            disabled={isScanning}
          >
            {isScanning ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <Search className="w-4 h-4 mr-1" />
            )}
            Scan
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Find and fix bookings where intro_owner was incorrectly set to the member name
        </p>
      </CardHeader>
      <CardContent>
        {misattributed.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-success" />
            <p className="text-sm">Click "Scan" to check for misattributed bookings</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="destructive">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {misattributed.length} bookings need fixing
              </Badge>
              <Button
                size="sm"
                onClick={handleApplyFixes}
                disabled={isApplyingFixes || Object.keys(fixes).length === 0}
              >
                {isApplyingFixes ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : null}
                Apply Fixes ({Object.keys(fixes).filter(k => fixes[k]).length})
              </Button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {misattributed.map((booking) => (
                <div
                  key={booking.id}
                  className="p-3 bg-muted/50 rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{booking.member_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {booking.class_date}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Current:</span>
                      <Badge variant="destructive" className="ml-1 text-xs">
                        {booking.intro_owner}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Fix to:</span>
                      <Select
                        value={fixes[booking.id] || ''}
                        onValueChange={(v) => handleFixChange(booking.id, v)}
                      >
                        <SelectTrigger className="h-7 text-xs ml-1 w-32 inline-flex">
                          <SelectValue placeholder="Select SA..." />
                        </SelectTrigger>
                        <SelectContent>
                          {SALES_ASSOCIATES.map((sa) => (
                            <SelectItem key={sa} value={sa} className="text-xs">
                              {sa}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
