import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ClipboardList, Phone, MessageSquare, Mail, Instagram,
  Plus, CheckCircle, Loader2, Save
} from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import IntroBookingEntry, { IntroBookingData } from '@/components/IntroBookingEntry';
import IntroRunEntry, { IntroRunData } from '@/components/IntroRunEntry';
import SaleEntry, { SaleData } from '@/components/SaleEntry';
import FollowupPurchaseEntry from '@/components/FollowupPurchaseEntry';
import { supabase } from '@/integrations/supabase/client';
import { getSpreadsheetId } from '@/lib/sheets-sync';
import { postShiftRecapToGroupMe } from '@/lib/groupme';
import { format } from 'date-fns';
import { useAutoCloseBooking } from '@/hooks/useAutoCloseBooking';
import { useFormAutoSave } from '@/hooks/useFormAutoSave';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';


const SHIFT_TYPES = ['AM Shift', 'PM Shift', 'Mid Shift'] as const;
type ShiftType = typeof SHIFT_TYPES[number];

export default function ShiftRecap() {
  const { user } = useAuth();
  const { refreshData } = useData();
  const spreadsheetId = getSpreadsheetId();
  const { 
    isClosing, 
    pendingMatches, 
    closeBookingOnSale, 
    confirmCloseBooking, 
    clearPendingMatches 
  } = useAutoCloseBooking();
  
  // Auto-save hook
  const { loadDraft, saveDraft, clearDraft, lastSaved } = useFormAutoSave(user?.name);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);

  // Basic Info
  const [shiftType, setShiftType] = useState<ShiftType>('AM Shift');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Confirmation dialog for multiple matching bookings
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

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

  // Load draft on mount
  useEffect(() => {
    if (!isDraftLoaded && user?.name) {
      const draft = loadDraft();
      if (draft) {
        setShiftType(draft.shiftType as ShiftType || 'AM Shift');
        setDate(draft.date || new Date().toISOString().split('T')[0]);
        setCallsMade(draft.callsMade || 0);
        setTextsSent(draft.textsSent || 0);
        setEmailsSent(draft.emailsSent || 0);
        setDmsSent(draft.dmsSent || 0);
        setIntrosBooked(draft.introsBooked || []);
        setIntrosRun(draft.introsRun || []);
        setSales(draft.sales || []);
        setNotes(draft.notes || '');
        toast.info('Draft restored', {
          description: 'Your unsaved work has been loaded.',
        });
      }
      setIsDraftLoaded(true);
    }
  }, [user?.name, loadDraft, isDraftLoaded]);

  // Auto-save on changes (debounced)
  useEffect(() => {
    if (!isDraftLoaded) return;
    
    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer
    autoSaveTimerRef.current = setTimeout(() => {
      saveDraft({
        shiftType,
        date,
        callsMade,
        textsSent,
        emailsSent,
        dmsSent,
        introsBooked,
        introsRun,
        sales,
        notes,
      });
    }, 3000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [shiftType, date, callsMade, textsSent, emailsSent, dmsSent, introsBooked, introsRun, sales, notes, saveDraft, isDraftLoaded]);


  // CRUD helpers for Intro Bookings
  const addIntroBooking = () => {
    setIntrosBooked([...introsBooked, { 
      id: crypto.randomUUID(),
      memberName: '',
      introDate: date,
      introTime: '',
      leadSource: '',
      notes: ''
    }]);
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
    setIntrosRun([...introsRun, { 
      id: crypto.randomUUID(),
      memberName: '',
      runDate: date,
      runTime: '',
      leadSource: '',
      outcome: '',
      goalWhyCaptured: '',
      relationshipExperience: '',
      madeAFriend: false,
      notes: '',
      linkedBookingId: undefined,
      secondIntroDate: undefined,
      secondIntroTime: undefined,
      bookedBy: undefined,
      originatingBookingId: undefined
    }]);
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
    setSales([...sales, { 
      id: crypto.randomUUID(),
      memberName: '',
      leadSource: '',
      membershipType: '',
      commissionAmount: 0
    }]);
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
      //    - booked_by = logged-in SA (booking credit)
      //    - intro_owner is NULL at booking time; only set when first intro is RUN
      for (const booking of introsBooked) {
        if (booking.memberName && booking.introDate) {
          const bookingId = `booking_${crypto.randomUUID().substring(0, 8)}`;
          const staffName = user?.name || '';
          
          await supabase.from('intros_booked').insert({
            booking_id: bookingId,
            member_name: booking.memberName,
            class_date: booking.introDate,
            intro_time: booking.introTime || null,
            coach_name: 'TBD',
            sa_working_shift: staffName, // Legacy field (still populated for backwards compatibility)
            booked_by: staffName,        // NEW: booked_by = who booked it
            lead_source: booking.leadSource || 'Source Not Found',
            fitness_goal: booking.notes || null,
            shift_recap_id: shiftData.id,
            // intro_owner is NULL at booking creation (set on first run)
            intro_owner: null,
            intro_owner_locked: false,
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
                  booked_by: staffName, // Booking credit
                  intro_owner: '',      // NULL at booking time
                  booking_status: 'ACTIVE',
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
          let linkedBookingId = run.linkedBookingId;
          
          // Determine intro_owner:
          // - If linked booking already has a locked intro_owner, carry forward
          // - Otherwise, this runner becomes the intro_owner and we lock it
          let introOwner = user?.name || '';
          let introOwnerLocked = false;
          let isFirstRun = true;

          if (linkedBookingId) {
            // First check if the booking itself has a locked intro_owner
            const { data: linkedBooking } = await supabase
              .from('intros_booked')
              .select('intro_owner, intro_owner_locked')
              .eq('id', linkedBookingId)
              .maybeSingle();

            if (linkedBooking?.intro_owner_locked && linkedBooking.intro_owner) {
              // Booking already has a locked owner, carry forward
              introOwner = linkedBooking.intro_owner;
              introOwnerLocked = true;
              isFirstRun = false;
            } else {
              // Check if any previous run exists for this booking (non-no-show)
              const { data: existingRuns } = await supabase
                .from('intros_run')
                .select('intro_owner, intro_owner_locked, result')
                .eq('linked_intro_booked_id', linkedBookingId)
                .neq('result', 'No-show')
                .eq('intro_owner_locked', true)
                .limit(1);

              if (existingRuns && existingRuns.length > 0) {
                introOwner = existingRuns[0].intro_owner || introOwner;
                introOwnerLocked = true;
                isFirstRun = false;
              } else {
                // First non-no-show run → this SA becomes intro_owner
                introOwnerLocked = true;
                isFirstRun = true;
              }
            }
          } else {
            // P0 FIX: Manual entry → AUTO-CREATE BOOKING for data integrity
            const autoBookingId = `booking_${crypto.randomUUID().substring(0, 8)}`;
            const staffName = user?.name || '';
            
            // Create a corresponding booking record
            const { data: newBooking, error: bookingError } = await supabase
              .from('intros_booked')
              .insert({
                booking_id: autoBookingId,
                member_name: run.memberName,
                class_date: run.runDate,
                intro_time: run.runTime || null,
                coach_name: 'TBD',
                sa_working_shift: staffName,
                booked_by: 'Run-first entry', // Mark as auto-created
                lead_source: run.leadSource || 'Source Not Found',
                fitness_goal: `Auto-created from manual intro run by ${staffName}`,
                shift_recap_id: shiftData.id,
                intro_owner: staffName, // Runner becomes owner
                intro_owner_locked: true,
                booking_status: 'Active',
              })
              .select()
              .single();

            if (bookingError) {
              console.error('Error auto-creating booking:', bookingError);
            } else if (newBooking) {
              // Link the run to the new booking
              linkedBookingId = newBooking.id;
            }

            introOwnerLocked = true;
            isFirstRun = true;
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
            goal_why_captured: run.goalWhyCaptured || null,
            relationship_experience: run.relationshipExperience || null,
            made_a_friend: run.madeAFriend,
            notes: run.notes || null,
            sa_name: user?.name || null,
            commission_amount: commissionAmount,
            linked_intro_booked_id: linkedBookingId || null, // Use the potentially updated linkedBookingId
            shift_recap_id: shiftData.id,
          });

          if (runError) throw runError;

          // If this is the first non-no-show run, lock intro_owner on the booking too
          if (isFirstRun && linkedBookingId && run.outcome !== 'No-show') {
            await supabase
              .from('intros_booked')
              .update({
                intro_owner: introOwner,
                intro_owner_locked: true,
                last_edited_at: new Date().toISOString(),
                last_edited_by: 'System (first run)',
                edit_reason: `Intro owner set to ${introOwner} on first run`,
              })
              .eq('id', linkedBookingId);
          }

          // If sale outcome, close the linked booking
          if (commissionAmount > 0 && linkedBookingId) {
            await closeBookingOnSale(
              run.memberName,
              commissionAmount,
              run.outcome,
              runId,
              linkedBookingId,
              user?.name || 'System'
            );
          }

          // Handle "Booked 2nd intro" outcome - create a new booking with proper date/time
          if (run.outcome === 'Booked 2nd intro') {
            const secondBookingId = `booking_${crypto.randomUUID().substring(0, 8)}`;
            const secondIntroDate = run.secondIntroDate || new Date().toISOString().split('T')[0];
            const secondIntroTime = run.secondIntroTime || null;
            
            // Determine originating booking ID for chain tracking
            const originatingId = run.originatingBookingId || linkedBookingId || null;
            
            // 2nd intro booking: booked_by = current SA, intro_owner carries forward from first run
            await supabase.from('intros_booked').insert({
              booking_id: secondBookingId,
              member_name: run.memberName,
              class_date: secondIntroDate,
              intro_time: secondIntroTime,
              coach_name: 'TBD',
              sa_working_shift: user?.name || '', // Legacy field
              booked_by: user?.name || '',        // booked_by = SA scheduling the 2nd
              lead_source: '2nd Class Intro (staff booked)',
              fitness_goal: `2nd intro - Intro owner: ${introOwner}`,
              intro_owner: introOwner,            // carry forward from first
              intro_owner_locked: true,           // already locked
              originating_booking_id: originatingId, // Link to original for chain tracking
            });

            // Sync the 2nd booking to Google Sheets with proper tracking
            if (spreadsheetId) {
              await supabase.functions.invoke('sync-sheets', {
                body: {
                  action: 'sync_booking',
                  spreadsheetId,
                  data: {
                    booking_id: secondBookingId,
                    member_name: run.memberName,
                    class_date: secondIntroDate,
                    intro_time: secondIntroTime,
                    lead_source: '2nd Class Intro (staff booked)',
                    notes: `2nd intro - Intro owner: ${introOwner}`,
                    originating_booking_id: originatingId,
                    booking_status: 'ACTIVE',
                    booked_by: user?.name || '', // SA who scheduled the 2nd intro
                    intro_owner: introOwner, // Carry forward from first intro
                  },
                },
              });
            }
            
            toast.info('2nd intro booked', {
              description: `Scheduled for ${secondIntroDate}`,
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
                  // New lead measures (spec-compliant)
                  goal_why_captured: run.goalWhyCaptured,
                  relationship_experience: run.relationshipExperience,
                  made_a_friend: run.madeAFriend,
                  notes: run.notes,
                },
              },
            });
          }
        }
      }

      // 4. Save sales outside intro with auto-close
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
            date_closed: date, // Use shift date as date_closed for pay period filtering
          });

          // Auto-close any matching active bookings
          if (sale.commissionAmount > 0 || sale.membershipType) {
            const closeResult = await closeBookingOnSale(
              sale.memberName,
              sale.commissionAmount,
              sale.membershipType,
              saleId,
              undefined, // no specific booking ID
              user?.name || 'System'
            );

            // If multiple matches, show confirmation dialog
            if (closeResult.requiresConfirmation && closeResult.matches) {
              setShowConfirmDialog(true);
            }
          }

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

      // 6. Post to GroupMe - await to ensure it completes
      try {
        const groupMeResult = await postShiftRecapToGroupMe({
          staffName: user?.name || '',
          shiftDate: date,
          shiftType,
          callsMade,
          textsSent,
          dmsSent,
          emailsSent,
          introsBooked: introsBooked.map(b => ({ memberName: b.memberName, leadSource: b.leadSource })),
          introsRun: introsRun.map(r => ({
            memberName: r.memberName,
            outcome: r.outcome,
            goalWhyCaptured: r.goalWhyCaptured,
            relationshipExperience: r.relationshipExperience,
            madeAFriend: r.madeAFriend,
          })),
          sales: sales.map(s => ({ memberName: s.memberName, membershipType: s.membershipType, commissionAmount: s.commissionAmount })),
          notes,
        }, shiftData.id);
        
        if (!groupMeResult.success) {
          console.error('GroupMe post failed:', groupMeResult.error);
          toast.error('GroupMe post failed', {
            description: groupMeResult.error || 'Check admin settings',
          });
        }
      } catch (err) {
        console.error('GroupMe post error:', err);
        toast.error('GroupMe post failed', {
          description: 'Could not post to GroupMe',
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

      // Refresh dashboard data immediately
      await refreshData();

      // Reset form and clear draft
      clearDraft();
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
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Shift Recap</h1>
          {lastSaved && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Save className="w-3 h-3" />
              Draft saved {format(lastSaved, 'h:mm a')}
            </span>
          )}
        </div>
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
          <p className="text-xs text-muted-foreground">
            Booking credit goes to you (who books it)
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {introsBooked.length === 0 ? (
            <button
              onClick={addIntroBooking}
              className="w-full p-6 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-colors"
            >
              <div className="flex flex-col items-center gap-2 text-primary">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="font-medium">Book an intro?</span>
                <span className="text-xs text-muted-foreground">Tap here to add one</span>
              </div>
            </button>
          ) : (
            <>
              {introsBooked.map((booking, index) => (
                <IntroBookingEntry
                  key={booking.id}
                  booking={booking}
                  index={index}
                  onUpdate={updateIntroBooking}
                  onRemove={removeIntroBooking}
                />
              ))}
              
              <Button
                variant="outline"
                className="w-full"
                onClick={addIntroBooking}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Another
              </Button>
            </>
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
          {introsRun.length === 0 ? (
            <button
              onClick={addIntroRun}
              className="w-full p-6 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-colors"
            >
              <div className="flex flex-col items-center gap-2 text-primary">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="font-medium">Run an intro today?</span>
                <span className="text-xs text-muted-foreground">Tap here to log it</span>
              </div>
            </button>
          ) : (
            <>
              {introsRun.map((run, index) => (
                <IntroRunEntry
                  key={run.id}
                  intro={run}
                  index={index}
                  onUpdate={updateIntroRun}
                  onRemove={removeIntroRun}
                />
              ))}
              
              <Button
                variant="outline"
                className="w-full"
                onClick={addIntroRun}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Another
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Follow-up Purchases */}
      <FollowupPurchaseEntry 
        shiftDate={date} 
        staffName={user?.name || ''} 
        onPurchaseComplete={refreshData}
      />

      {/* Sales Outside Intro */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sales (Outside Intro)</CardTitle>
          <p className="text-xs text-muted-foreground">
            For sales not tied to an intro run
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {sales.length === 0 ? (
            <button
              onClick={addSale}
              className="w-full p-6 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/50 transition-colors"
            >
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="font-medium">Any other sales?</span>
                <span className="text-xs">Tap here if you made a sale outside of an intro</span>
              </div>
            </button>
          ) : (
            <>
              {sales.map((sale, index) => (
                <SaleEntry
                  key={sale.id}
                  sale={sale}
                  index={index}
                  onUpdate={updateSale}
                  onRemove={removeSale}
                />
              ))}
              
              <Button
                variant="outline"
                className="w-full"
                onClick={addSale}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Another
              </Button>
            </>
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

      {/* Multiple Matching Bookings Dialog */}
      <Dialog open={showConfirmDialog && pendingMatches !== null} onOpenChange={(open) => {
        if (!open) {
          setShowConfirmDialog(false);
          clearPendingMatches();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Multiple Bookings Found</DialogTitle>
            <DialogDescription>
              Multiple active bookings match this member. Select which booking chain to close:
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2 max-h-[300px] overflow-y-auto">
            {pendingMatches?.map((match) => (
              <button
                key={match.booking_id}
                className="w-full p-3 text-left border rounded-lg hover:bg-muted/50 transition-colors"
                onClick={async () => {
                  await confirmCloseBooking(match.booking_id);
                  setShowConfirmDialog(false);
                }}
              >
                <div className="font-medium text-sm">{match.member_name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {match.intro_date && <span className="mr-2">{match.intro_date}</span>}
                  {match.intro_time && <span className="mr-2">{match.intro_time}</span>}
                  <span>{match.lead_source}</span>
                </div>
                {match.notes && (
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {match.notes}
                  </div>
                )}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowConfirmDialog(false);
              clearPendingMatches();
            }}>
              Skip (Don't Close)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
