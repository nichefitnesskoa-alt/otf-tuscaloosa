import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserCheck, DollarSign, Calendar, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { capitalizeName } from '@/lib/utils';
import { MEMBERSHIP_TYPES } from '@/types';
import { isMembershipSale } from '@/lib/sales-detection';
import { incrementAmcOnSale } from '@/lib/amc-auto';

interface EligibleFollowup {
  runId: string;
  memberName: string;
  introDate: string;
  introOwner: string;
  linkedBookingId: string | null;
  leadSource: string | null;
  result: string;
}

interface FollowupPurchaseEntryProps {
  shiftDate: string;
  staffName: string;
  onPurchaseComplete?: () => void;
}

// Commission rates by membership type
const COMMISSION_RATES: Record<string, number> = {
  'Premier + OTBeat': 15,
  'Premier w/o OTBeat': 7.5,
  'Elite + OTBeat': 12,
  'Elite w/o OTBeat': 6,
  'Basic + OTBeat': 9,
  'Basic w/o OTBeat': 3,
};

export default function FollowupPurchaseEntry({ 
  shiftDate, 
  staffName,
  onPurchaseComplete 
}: FollowupPurchaseEntryProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eligibleClients, setEligibleClients] = useState<EligibleFollowup[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [membershipType, setMembershipType] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState(shiftDate);

  // Fetch eligible follow-up clients
  useEffect(() => {
    const fetchEligibleClients = async () => {
      setIsLoading(true);
      try {
        // Get all runs
        const { data: runs, error } = await supabase
          .from('intros_run')
          .select('id, member_name, run_date, result, intro_owner, ran_by, linked_intro_booked_id, lead_source')
          .order('run_date', { ascending: false });

        if (error) throw error;

        // Group runs by member name (lowercase, no spaces)
        const memberRuns = new Map<string, typeof runs>();
        (runs || []).forEach(run => {
          const key = run.member_name.toLowerCase().replace(/\s+/g, '');
          const existing = memberRuns.get(key) || [];
          existing.push(run);
          memberRuns.set(key, existing);
        });

        // Find eligible clients: those with Follow-up needed or Booked 2nd intro
        // who haven't already purchased
        const eligible: EligibleFollowup[] = [];
        
        memberRuns.forEach((memberRunList) => {
          // Check if any run has a sale result
          const hasSale = memberRunList.some(r => isMembershipSale(r.result));
          if (hasSale) return; // Already purchased, skip

          // Find the most recent follow-up run
          const followupRun = memberRunList.find(r => 
            r.result === 'Follow-up needed' || r.result === 'Booked 2nd intro'
          );

          if (followupRun) {
            eligible.push({
              runId: followupRun.id,
              memberName: followupRun.member_name,
              introDate: followupRun.run_date || '',
              introOwner: followupRun.intro_owner || followupRun.ran_by || '',
              linkedBookingId: followupRun.linked_intro_booked_id,
              leadSource: followupRun.lead_source,
              result: followupRun.result,
            });
          }
        });

        // Sort by date descending
        eligible.sort((a, b) => b.introDate.localeCompare(a.introDate));
        setEligibleClients(eligible);
      } catch (error) {
        console.error('Error fetching eligible clients:', error);
        toast.error('Failed to load follow-up clients');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEligibleClients();
  }, []);

  const selectedClientData = eligibleClients.find(c => c.runId === selectedClient);
  const commission = membershipType ? COMMISSION_RATES[membershipType] || 0 : 0;

  const handleSubmit = async () => {
    if (!selectedClient || !membershipType) {
      toast.error('Please select a client and membership type');
      return;
    }

    const client = eligibleClients.find(c => c.runId === selectedClient);
    if (!client) return;

    setIsSubmitting(true);
    try {
      // Update the existing run record with the sale
      const { error: runError } = await supabase
        .from('intros_run')
        .update({
          result: membershipType,
          buy_date: purchaseDate,
          commission_amount: commission,
          notes: `[Previous: ${client.result}] Follow-up purchase logged by ${staffName} on ${purchaseDate}`,
          last_edited_at: new Date().toISOString(),
          last_edited_by: staffName,
          edit_reason: 'Follow-up purchase conversion',
        })
        .eq('id', client.runId);

      if (runError) throw runError;

      // Auto-increment AMC for this sale
      await incrementAmcOnSale(client.memberName, membershipType, staffName, purchaseDate);

      // Close the linked booking if exists
      if (client.linkedBookingId) {
        const { error: bookingError } = await supabase
          .from('intros_booked')
          .update({
            booking_status: 'Closed (Purchased)',
            closed_at: new Date().toISOString(),
            closed_by: staffName,
            last_edited_at: new Date().toISOString(),
            last_edited_by: staffName,
            edit_reason: 'Closed via follow-up purchase',
          })
          .eq('id', client.linkedBookingId);

        if (bookingError) {
          console.error('Error closing booking:', bookingError);
        }
      }

      toast.success(`${capitalizeName(client.memberName)} marked as purchased!`, {
        description: `$${commission.toFixed(2)} commission for ${capitalizeName(client.introOwner)}`,
      });

      // Reset form
      setSelectedClient('');
      setMembershipType('');
      
      // Remove from eligible list
      setEligibleClients(prev => prev.filter(c => c.runId !== client.runId));
      
      onPurchaseComplete?.();
    } catch (error) {
      console.error('Error recording follow-up purchase:', error);
      toast.error('Failed to record purchase');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (eligibleClients.length === 0) {
    return null; // Don't show if no eligible clients
  }

  return (
    <Card className="border-success/30 bg-success/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-success" />
          Follow-up Purchase
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Mark a client who came back to buy after their intro
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Client Selector */}
        <div className="space-y-2">
          <Label>Select Client</Label>
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a follow-up client..." />
            </SelectTrigger>
            <SelectContent>
              {eligibleClients.map(client => (
                <SelectItem key={client.runId} value={client.runId}>
                  <div className="flex flex-col">
                    <span className="font-medium">{capitalizeName(client.memberName)}</span>
                    <span className="text-xs text-muted-foreground">
                      {client.introDate} • Owner: {capitalizeName(client.introOwner)} • {client.result}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedClientData && (
          <>
            {/* Client Info Badge */}
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>Intro on {selectedClientData.introDate}</span>
              <Badge variant="outline">{selectedClientData.result}</Badge>
            </div>

            {/* Membership Type */}
            <div className="space-y-2">
              <Label>Membership Type</Label>
              <Select value={membershipType} onValueChange={setMembershipType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select membership..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(COMMISSION_RATES).map(([type, rate]) => (
                    <SelectItem key={type} value={type}>
                      {type} (${rate.toFixed(2)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Purchase Date */}
            <div className="space-y-2">
              <Label>Purchase Date</Label>
              <Input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>

            {/* Commission Info */}
            {membershipType && (
              <div className="flex items-center gap-2 p-3 bg-success/10 rounded-lg border border-success/20">
                <Info className="w-4 h-4 text-success" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-success">
                    ${commission.toFixed(2)} commission
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Goes to {capitalizeName(selectedClientData.introOwner)} (intro owner)
                  </p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={!membershipType || isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <DollarSign className="w-4 h-4 mr-2" />
                  Record Follow-up Purchase
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
