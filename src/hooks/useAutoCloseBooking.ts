import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getSpreadsheetId } from '@/lib/sheets-sync';
import { toast } from '@/hooks/use-toast';

interface MatchingBooking {
  booking_id: string;
  member_name: string;
  member_key: string;
  intro_date: string;
  intro_time: string;
  lead_source: string;
  notes: string;
  originating_booking_id: string;
  row_number: number;
}

interface AutoCloseResult {
  success: boolean;
  closedCount?: number;
  requiresConfirmation?: boolean;
  matches?: MatchingBooking[];
  error?: string;
}

export function useAutoCloseBooking() {
  const [isClosing, setIsClosing] = useState(false);
  const [pendingMatches, setPendingMatches] = useState<MatchingBooking[] | null>(null);
  const [pendingSaleInfo, setPendingSaleInfo] = useState<{
    saleId: string;
    memberKey: string;
    changedBy: string;
  } | null>(null);

  const normalizeName = (name: string): string => {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  };

  const closeBookingOnSale = async (
    memberName: string,
    commissionAmount: number,
    membershipType: string,
    saleId: string,
    relatedBookingId?: string,
    changedBy: string = 'System'
  ): Promise<AutoCloseResult> => {
    // Check if this sale qualifies for auto-close
    if (commissionAmount <= 0 && !membershipType) {
      return { success: true }; // No action needed
    }

    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) {
      return { success: false, error: 'No spreadsheet configured' };
    }

    setIsClosing(true);
    try {
      // If we have a specific booking ID, close it directly
      if (relatedBookingId) {
        const { data, error } = await supabase.functions.invoke('sync-sheets', {
          body: {
            action: 'update_booking_status',
            spreadsheetId,
            data: {
              bookingId: relatedBookingId,
              newStatus: 'CLOSED',
              statusReason: 'Purchased membership',
              changedBy,
              closedSaleId: saleId,
            },
          },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);

        toast({
          title: 'Membership logged',
          description: 'Removed from booked intros.',
        });

        return { success: true, closedCount: data.updatedRows || 1 };
      }

      // Otherwise, find matching bookings by member key
      const memberKey = normalizeName(memberName);
      
      const { data: matchData, error: matchError } = await supabase.functions.invoke('sync-sheets', {
        body: {
          action: 'find_active_bookings_by_member',
          spreadsheetId,
          data: { memberKey },
        },
      });

      if (matchError) throw matchError;
      if (!matchData.success) throw new Error(matchData.error);

      const matches: MatchingBooking[] = matchData.matches || [];

      if (matches.length === 0) {
        // No active bookings to close
        return { success: true, closedCount: 0 };
      }

      if (matches.length === 1) {
        // Exactly one match - close it automatically
        const { data, error } = await supabase.functions.invoke('sync-sheets', {
          body: {
            action: 'update_booking_status',
            spreadsheetId,
            data: {
              bookingId: matches[0].booking_id,
              memberKey: matches[0].member_key,
              newStatus: 'CLOSED',
              statusReason: 'Purchased membership',
              changedBy,
              closedSaleId: saleId,
            },
          },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);

        toast({
          title: 'Membership logged',
          description: 'Removed from booked intros.',
        });

        return { success: true, closedCount: data.updatedRows || 1 };
      }

      // Multiple matches - require admin confirmation
      setPendingMatches(matches);
      setPendingSaleInfo({ saleId, memberKey, changedBy });
      
      return { 
        success: true, 
        requiresConfirmation: true, 
        matches 
      };

    } catch (err) {
      console.error('Error auto-closing booking:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to close booking' 
      };
    } finally {
      setIsClosing(false);
    }
  };

  const confirmCloseBooking = async (bookingId: string): Promise<AutoCloseResult> => {
    if (!pendingSaleInfo) {
      return { success: false, error: 'No pending sale info' };
    }

    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) {
      return { success: false, error: 'No spreadsheet configured' };
    }

    setIsClosing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-sheets', {
        body: {
          action: 'update_booking_status',
          spreadsheetId,
          data: {
            bookingId,
            newStatus: 'CLOSED',
            statusReason: 'Purchased membership',
            changedBy: pendingSaleInfo.changedBy,
            closedSaleId: pendingSaleInfo.saleId,
          },
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({
        title: 'Membership logged',
        description: 'Removed from booked intros.',
      });

      // Clear pending state
      setPendingMatches(null);
      setPendingSaleInfo(null);

      return { success: true, closedCount: data.updatedRows || 1 };

    } catch (err) {
      console.error('Error confirming close:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to close booking' 
      };
    } finally {
      setIsClosing(false);
    }
  };

  const clearPendingMatches = () => {
    setPendingMatches(null);
    setPendingSaleInfo(null);
  };

  return {
    isClosing,
    pendingMatches,
    closeBookingOnSale,
    confirmCloseBooking,
    clearPendingMatches,
  };
}
