import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ClipboardList, Phone, MessageSquare, Mail, Instagram,
  Plus, CheckCircle, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import IntroBookingEntry, { IntroBookingData } from '@/components/IntroBookingEntry';
import IntroRunEntry, { IntroRunData } from '@/components/IntroRunEntry';
import SaleEntry, { SaleData } from '@/components/SaleEntry';
import { supabase } from '@/integrations/supabase/client';
import { getSpreadsheetId } from '@/lib/sheets-sync';
import { format } from 'date-fns';

const SHIFT_TYPES = ['AM Shift', 'PM Shift', 'Mid Shift'] as const;
type ShiftType = typeof SHIFT_TYPES[number];

export default function ShiftRecap() {
  const { user } = useAuth();
  const spreadsheetId = getSpreadsheetId();

  // Basic Info
  const [shiftType, setShiftType] = useState<ShiftType>('AM Shift');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Activity Tracking
  const [callsMade, setCallsMade] = useState(0);
  const [textsSent, setTextsSent] = useState(0);
  const [emailsSent, setEmailsSent] = useState(0);
  const [dmsSent, setDmsSent] = useState(0);

  // Intros Booked
  const [introsBooked, setIntrosBooked] = useState<IntroBookingData[]>([]);

  // Intros Run
  const [introsRun, setIntrosRun] = useState<IntroRunData[]>([]);

  // Sales Outside Intro
  const [sales, setSales] = useState<SaleData[]>([]);

  // Misc
  const [notes, setNotes] = useState('');

  // CRUD helpers for Intro Bookings
  const addIntroBooking = () => {
    if (introsBooked.length < 5) {
      setIntrosBooked([...introsBooked, { 
        id: crypto.randomUUID(),
        memberName: '',
        introDate: date,
        introTime: '',
        leadSource: '',
        notes: ''
      }]);
    }
  };

  const updateIntroBooking = (index: number, updates: Partial<IntroBookingData>) => {
    setIntrosBooked(introsBooked.map((intro, i) => 
      i === index ? { ...intro, ...updates } : intro
    ));
  };

  const removeIntroBooking = (index: number) => {
    setIntrosBooked(introsBooked.filter((_, i) => i !== index));
  };

  // CRUD helpers for Intro Runs
  const addIntroRun = () => {
    if (introsRun.length < 5) {
      setIntrosRun([...introsRun, { 
        id: crypto.randomUUID(),
        memberName: '',
        runDate: date,
        runTime: '',
        leadSource: '',
        outcome: '',
        goalQuality: '',
        pricingEngagement: '',
        fvcCompleted: false,
        rfgPresented: false,
        choiceArchitecture: false,
        halfwayEncouragement: false,
        premobilityEncouragement: false,
        coachingSummaryPresence: false,
        notes: '',
        linkedBookingId: undefined
      }]);
    }
  };

  const updateIntroRun = (index: number, updates: Partial<IntroRunData>) => {
    setIntrosRun(introsRun.map((intro, i) => 
      i === index ? { ...intro, ...updates } : intro
    ));
  };

  const removeIntroRun = (index: number) => {
    setIntrosRun(introsRun.filter((_, i) => i !== index));
  };

  // CRUD helpers for Sales
  const addSale = () => {
    if (sales.length < 5) {
      setSales([...sales, { 
        id: crypto.randomUUID(),
        memberName: '',
        leadSource: '',
        membershipType: '',
        commissionAmount: 0
      }]);
    }
  };

  const updateSale = (index: number, updates: Partial<SaleData>) => {
    setSales(sales.map((sale, i) => 
      i === index ? { ...sale, ...updates } : sale
    ));
  };

  const removeSale = (index: number) => {
    setSales(sales.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      // 1. Create shift recap
      const { data: shiftData, error: shiftError } = await supabase
        .from('shift_recaps')
        .insert({
          shift_id: `shift_${crypto.randomUUID().substring(0, 8)}`,
          staff_name: user?.name || '',
          shift_date: date,
          shift_type: shiftType,
          calls_made: callsMade,
          texts_sent: textsSent,
          emails_sent: emailsSent,
          dms_sent: dmsSent,
          other_info: notes || null,
          submitted_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (shiftError) throw shiftError;

      // 2. Save intro bookings
      for (const booking of introsBooked) {
        if (booking.memberName && booking.introDate) {
          const bookingId = `booking_${crypto.randomUUID().substring(0, 8)}`;
          await supabase.from('intros_booked').insert({
            booking_id: bookingId,
            member_name: booking.memberName,
            class_date: booking.introDate,
            intro_time: booking.introTime || null,
            coach_name: 'TBD',
            sa_working_shift: user?.name || '',
            lead_source: booking.leadSource || 'Source Not Found',
            fitness_goal: booking.notes || null,
            shift_recap_id: shiftData.id,
          });

          // Sync to Google Sheets if configured
          if (spreadsheetId) {
            await supabase.functions.invoke('sync-sheets', {
              body: {
                action: 'sync_booking',
                spreadsheetId,
                data: {
                  booking_id: bookingId,
                  member_name: booking.memberName,
                  class_date: booking.introDate,
                  intro_time: booking.introTime,
                  lead_source: booking.leadSource,
                  notes: booking.notes,
                },
              },
            });
          }
        }
      }

      // 3. Save intro runs with intro ownership logic
      for (const run of introsRun) {
        if (run.memberName && run.outcome) {
          const runId = `run_${crypto.randomUUID().substring(0, 8)}`;
          
          // Check if this booking already has an intro owner
          let introOwner = user?.name || '';
          let introOwnerLocked = false;

          if (run.linkedBookingId) {
            // Check if any previous run exists for this booking
            const { data: existingRuns } = await supabase
              .from('intros_run')
              .select('intro_owner, intro_owner_locked')
              .eq('linked_intro_booked_id', run.linkedBookingId)
              .eq('intro_owner_locked', true)
              .limit(1);

            if (existingRuns && existingRuns.length > 0) {
              // Keep the original intro owner
              introOwner = existingRuns[0].intro_owner || introOwner;
              introOwnerLocked = true;
            } else {
              // First run for this booking - lock in this SA as owner
              introOwnerLocked = true;
            }
          } else {
            // Manual entry - this SA owns it
            introOwnerLocked = true;
          }

          // Calculate commission
          let commissionAmount = 0;
          const outcomeLower = run.outcome.toLowerCase();
          if (outcomeLower.includes('premier') && outcomeLower.includes('otbeat')) commissionAmount = 15;
          else if (outcomeLower.includes('premier')) commissionAmount = 7.5;
          else if (outcomeLower.includes('elite') && outcomeLower.includes('otbeat')) commissionAmount = 12;
          else if (outcomeLower.includes('elite')) commissionAmount = 6;
          else if (outcomeLower.includes('basic') && outcomeLower.includes('otbeat')) commissionAmount = 9;
          else if (outcomeLower.includes('basic')) commissionAmount = 3;

          // Insert the intro run
          const { error: runError } = await supabase.from('intros_run').insert({
            run_id: runId,
            member_name: run.memberName,
            run_date: run.runDate,
            class_time: run.runTime || '09:00',
            lead_source: run.leadSource || null,
            result: run.outcome,
            intro_owner: introOwner,
            intro_owner_locked: introOwnerLocked,
            goal_quality: run.goalQuality || null,
            pricing_engagement: run.pricingEngagement || null,
            fvc_completed: run.fvcCompleted,
            rfg_presented: run.rfgPresented,
            choice_architecture: run.choiceArchitecture,
            halfway_encouragement: run.halfwayEncouragement,
            premobility_encouragement: run.premobilityEncouragement,
            coaching_summary_presence: run.coachingSummaryPresence,
            notes: run.notes || null,
            sa_name: user?.name || null,
            commission_amount: commissionAmount,
            linked_intro_booked_id: run.linkedBookingId || null,
            shift_recap_id: shiftData.id,
          });

          if (runError) throw runError;

          // Handle "Booked 2nd intro" outcome - create a new booking
          if (run.outcome === 'Booked 2nd intro') {
            const secondBookingId = `booking_${crypto.randomUUID().substring(0, 8)}`;
            await supabase.from('intros_booked').insert({
              booking_id: secondBookingId,
              member_name: run.memberName,
              class_date: new Date().toISOString().split('T')[0], // TBD date
              coach_name: 'TBD',
              sa_working_shift: user?.name || '',
              lead_source: run.leadSource || '2nd Class Intro (staff booked)',
              fitness_goal: `2nd intro - Original owner: ${introOwner}`,
            });
          }

          // Sync to Google Sheets if configured
          if (spreadsheetId) {
            await supabase.functions.invoke('sync-sheets', {
              body: {
                action: 'sync_run',
                spreadsheetId,
                data: {
                  run_id: runId,
                  member_name: run.memberName,
                  run_date: run.runDate,
                  class_time: run.runTime,
                  lead_source: run.leadSource,
                  intro_owner: introOwner,
                  result: run.outcome,
                  goal_quality: run.goalQuality,
                  pricing_engagement: run.pricingEngagement,
                  fvc_completed: run.fvcCompleted,
                  rfg_presented: run.rfgPresented,
                  choice_architecture: run.choiceArchitecture,
                  halfway_encouragement: run.halfwayEncouragement,
                  premobility_encouragement: run.premobilityEncouragement,
                  coaching_summary_presence: run.coachingSummaryPresence,
                  notes: run.notes,
                },
              },
            });
          }
        }
      }

      // 4. Save sales outside intro
      for (const sale of sales) {
        if (sale.memberName && sale.membershipType) {
          const saleId = `sale_${crypto.randomUUID().substring(0, 8)}`;
          
          await supabase.from('sales_outside_intro').insert({
            sale_id: saleId,
            sale_type: 'outside_intro',
            member_name: sale.memberName,
            lead_source: sale.leadSource || 'Source Not Found',
            membership_type: sale.membershipType,
            commission_amount: sale.commissionAmount,
            intro_owner: user?.name || null,
            shift_recap_id: shiftData.id,
          });

          // Sync to Google Sheets if configured
          if (spreadsheetId) {
            await supabase.functions.invoke('sync-sheets', {
              body: {
                action: 'sync_sale',
                spreadsheetId,
                data: {
                  sale_id: saleId,
                  member_name: sale.memberName,
                  lead_source: sale.leadSource,
                  membership_type: sale.membershipType,
                  commission_amount: sale.commissionAmount,
                  intro_owner: user?.name,
                },
              },
            });
          }
        }
      }

      // 5. Sync shift recap to Google Sheets
      if (spreadsheetId) {
        await supabase.functions.invoke('sync-sheets', {
          body: {
            action: 'sync_shift',
            spreadsheetId,
            data: shiftData,
          },
        });
      }

      // Success!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      toast.success('Shift recap submitted! 🎉', {
        description: 'Great work today!',
      });

      // Reset form
      setCallsMade(0);
      setTextsSent(0);
      setEmailsSent(0);
      setDmsSent(0);
      setIntrosBooked([]);
      setIntrosRun([]);
      setSales([]);
      setNotes('');
    } catch (error) {
      console.error('Error submitting recap:', error);
      toast.error('Failed to submit recap');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 pb-8 space-y-4">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Shift Recap</h1>
        <p className="text-sm text-muted-foreground">
          Log your shift in under 3 minutes
        </p>
      </div>

      {/* Shift Basics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            Shift Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm">Shift</Label>
              <Select value={shiftType} onValueChange={(v) => setShiftType(v as ShiftType)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHIFT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Tracking */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="w-4 h-4 text-primary" />
            Outreach Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center">
              <Label className="text-xs flex items-center justify-center gap-1 mb-1">
                <Phone className="w-3 h-3" /> Calls
              </Label>
              <Input
                type="number"
                min="0"
                value={callsMade}
                onChange={(e) => setCallsMade(Number(e.target.value))}
                className="text-center"
              />
            </div>
            <div className="text-center">
              <Label className="text-xs flex items-center justify-center gap-1 mb-1">
                <MessageSquare className="w-3 h-3" /> Texts
              </Label>
              <Input
                type="number"
                min="0"
                value={textsSent}
                onChange={(e) => setTextsSent(Number(e.target.value))}
                className="text-center"
              />
            </div>
            <div className="text-center">
              <Label className="text-xs flex items-center justify-center gap-1 mb-1">
                <Instagram className="w-3 h-3" /> DMs
              </Label>
              <Input
                type="number"
                min="0"
                value={dmsSent}
                onChange={(e) => setDmsSent(Number(e.target.value))}
                className="text-center"
              />
            </div>
            <div className="text-center">
              <Label className="text-xs flex items-center justify-center gap-1 mb-1">
                <Mail className="w-3 h-3" /> Emails
              </Label>
              <Input
                type="number"
                min="0"
                value={emailsSent}
                onChange={(e) => setEmailsSent(Number(e.target.value))}
                className="text-center"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Intro Bookings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Intros Booked</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {introsBooked.map((booking, index) => (
            <IntroBookingEntry
              key={booking.id}
              booking={booking}
              index={index}
              onUpdate={updateIntroBooking}
              onRemove={removeIntroBooking}
            />
          ))}
          
          {introsBooked.length < 5 && (
            <Button
              variant="outline"
              className="w-full"
              onClick={addIntroBooking}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Booking ({introsBooked.length}/5)
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Intro Runs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Intros Run</CardTitle>
          <p className="text-xs text-muted-foreground">
            Select from booked intros or add manually
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {introsRun.map((run, index) => (
            <IntroRunEntry
              key={run.id}
              intro={run}
              index={index}
              onUpdate={updateIntroRun}
              onRemove={removeIntroRun}
            />
          ))}
          
          {introsRun.length < 5 && (
            <Button
              variant="outline"
              className="w-full"
              onClick={addIntroRun}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Intro Run ({introsRun.length}/5)
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Sales Outside Intro */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sales (Outside Intro)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sales.map((sale, index) => (
            <SaleEntry
              key={sale.id}
              sale={sale}
              index={index}
              onUpdate={updateSale}
              onRemove={removeSale}
            />
          ))}
          
          {sales.length < 5 && (
            <Button
              variant="outline"
              className="w-full"
              onClick={addSale}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Sale ({sales.length}/5)
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes..."
            className="min-h-[80px]"
          />
        </CardContent>
      </Card>

      {/* Submit Button */}
      <Button 
        onClick={handleSubmit}
        className="w-full h-14 text-lg font-bold"
        size="lg"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <CheckCircle className="w-5 h-5 mr-2" />
            Submit Shift Recap
          </>
        )}
      </Button>
    </div>
  );
}
