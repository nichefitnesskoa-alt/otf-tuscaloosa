import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  SHIFT_TYPES, COACHES, ALL_STAFF, LEAD_SOURCES, BOOKING_SOURCES,
  PROCESS_CHECKLIST, LEAD_MEASURES, MEMBERSHIP_TYPES,
  ShiftType, LeadSource, BookingSource, MembershipType,
  IntroBooked, IntroRun, SaleOutsideIntro
} from '@/types';
import { 
  ClipboardList, Phone, MessageSquare, Mail, Instagram,
  Users, Calendar, Plus, Trash2, Sparkles, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

export default function ShiftRecap() {
  const { user } = useAuth();
  const { addShiftRecap } = useData();

  // Basic Info
  const [shiftType, setShiftType] = useState<ShiftType>('AM Shift');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Activity Tracking
  const [callsMade, setCallsMade] = useState(0);
  const [textsSent, setTextsSent] = useState(0);
  const [emailsSent, setEmailsSent] = useState(0);
  const [dmsSent, setDmsSent] = useState(0);

  // Admin (Coaches Only)
  const [otbeatSales, setOtbeatSales] = useState(0);
  const [otbeatBuyerNames, setOtbeatBuyerNames] = useState('');
  const [upgrades, setUpgrades] = useState(0);
  const [upgradeDetails, setUpgradeDetails] = useState('');
  const [downgrades, setDowngrades] = useState(0);
  const [downgradeDetails, setDowngradeDetails] = useState('');
  const [cancellations, setCancellations] = useState(0);
  const [cancellationDetails, setCancellationDetails] = useState('');
  const [freezes, setFreezes] = useState(0);
  const [freezeDetails, setFreezeDetails] = useState('');

  // Intros Booked
  const [introsBooked, setIntrosBooked] = useState<Partial<IntroBooked>[]>([]);

  // Intros Run
  const [introsRun, setIntrosRun] = useState<Partial<IntroRun>[]>([]);

  // Sales Outside Intro
  const [hasSalesOutside, setHasSalesOutside] = useState(false);
  const [salesOutsideIntro, setSalesOutsideIntro] = useState<Partial<SaleOutsideIntro>[]>([]);

  // Misc
  const [milestones, setMilestones] = useState('');
  const [equipmentIssues, setEquipmentIssues] = useState('');
  const [otherInfo, setOtherInfo] = useState('');

  const isCoach = user?.role === 'Coach';
  const isSA = user?.role === 'SA' || user?.role === 'Admin';

  const addIntroBooked = () => {
    if (introsBooked.length < 5) {
      setIntrosBooked([...introsBooked, { id: crypto.randomUUID() }]);
    }
  };

  const removeIntroBooked = (index: number) => {
    setIntrosBooked(introsBooked.filter((_, i) => i !== index));
  };

  const updateIntroBooked = (index: number, updates: Partial<IntroBooked>) => {
    setIntrosBooked(introsBooked.map((intro, i) => 
      i === index ? { ...intro, ...updates } : intro
    ));
  };

  const addIntroRun = () => {
    if (introsRun.length < 5) {
      setIntrosRun([...introsRun, { 
        id: crypto.randomUUID(), 
        processChecklist: [], 
        leadMeasures: [],
        isSelfGen: false 
      }]);
    }
  };

  const removeIntroRun = (index: number) => {
    setIntrosRun(introsRun.filter((_, i) => i !== index));
  };

  const updateIntroRun = (index: number, updates: Partial<IntroRun>) => {
    setIntrosRun(introsRun.map((intro, i) => 
      i === index ? { ...intro, ...updates } : intro
    ));
  };

  const addSaleOutside = () => {
    if (salesOutsideIntro.length < 5) {
      setSalesOutsideIntro([...salesOutsideIntro, { id: crypto.randomUUID() }]);
    }
  };

  const removeSaleOutside = (index: number) => {
    setSalesOutsideIntro(salesOutsideIntro.filter((_, i) => i !== index));
  };

  const updateSaleOutside = (index: number, updates: Partial<SaleOutsideIntro>) => {
    setSalesOutsideIntro(salesOutsideIntro.map((sale, i) => 
      i === index ? { ...sale, ...updates } : sale
    ));
  };

  const handleSubmit = () => {
    // Celebrate!
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    addShiftRecap({
      staffName: user?.name || '',
      date,
      shiftType,
      callsMade,
      textsSent,
      emailsSent,
      dmsSent,
      otbeatSales: isCoach ? otbeatSales : undefined,
      otbeatBuyerNames: isCoach ? otbeatBuyerNames : undefined,
      upgrades: isCoach ? upgrades : undefined,
      upgradeDetails: isCoach ? upgradeDetails : undefined,
      downgrades: isCoach ? downgrades : undefined,
      downgradeDetails: isCoach ? downgradeDetails : undefined,
      cancellations: isCoach ? cancellations : undefined,
      cancellationDetails: isCoach ? cancellationDetails : undefined,
      freezes: isCoach ? freezes : undefined,
      freezeDetails: isCoach ? freezeDetails : undefined,
      introsBooked: introsBooked as IntroBooked[],
      introsRun: introsRun as IntroRun[],
      salesOutsideIntro: hasSalesOutside ? salesOutsideIntro as SaleOutsideIntro[] : [],
      milestonesCelebrated: milestones || undefined,
      equipmentIssues: equipmentIssues || undefined,
      otherInfo: otherInfo || undefined,
      submittedAt: new Date().toISOString(),
    });

    toast.success('Shift recap submitted! 🎉', {
      description: 'Great work today! Keep crushing it.',
    });

    // Reset form
    setCallsMade(0);
    setTextsSent(0);
    setEmailsSent(0);
    setDmsSent(0);
    setIntrosBooked([]);
    setIntrosRun([]);
    setSalesOutsideIntro([]);
    setHasSalesOutside(false);
    setMilestones('');
    setEquipmentIssues('');
    setOtherInfo('');
  };

  return (
    <div className="p-4 pb-8 space-y-4">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Shift Recap</h1>
        <p className="text-sm text-muted-foreground">
          Log your shift activities
        </p>
      </div>

      {/* Shift Basics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            Shift Basics
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
              <Label className="text-sm">Shift Type</Label>
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
            Activity Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Phone className="w-3 h-3" /> Calls Made
              </Label>
              <Input
                type="number"
                min="0"
                value={callsMade}
                onChange={(e) => setCallsMade(Number(e.target.value))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Texts Sent
              </Label>
              <Input
                type="number"
                min="0"
                value={textsSent}
                onChange={(e) => setTextsSent(Number(e.target.value))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Mail className="w-3 h-3" /> Emails Sent
              </Label>
              <Input
                type="number"
                min="0"
                value={emailsSent}
                onChange={(e) => setEmailsSent(Number(e.target.value))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Instagram className="w-3 h-3" /> DMs Sent
              </Label>
              <Input
                type="number"
                min="0"
                value={dmsSent}
                onChange={(e) => setDmsSent(Number(e.target.value))}
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Section (Coaches Only) */}
      {isCoach && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Admin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs"># OTBeat Sales</Label>
                <Input
                  type="number"
                  min="0"
                  value={otbeatSales}
                  onChange={(e) => setOtbeatSales(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">OTBeat Buyer Names</Label>
                <Input
                  value={otbeatBuyerNames}
                  onChange={(e) => setOtbeatBuyerNames(e.target.value)}
                  className="mt-1"
                  placeholder="Names..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Upgrades</Label>
                <Input
                  type="number"
                  min="0"
                  value={upgrades}
                  onChange={(e) => setUpgrades(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Upgrade Details</Label>
                <Input
                  value={upgradeDetails}
                  onChange={(e) => setUpgradeDetails(e.target.value)}
                  className="mt-1"
                  placeholder="Details..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Downgrades</Label>
                <Input
                  type="number"
                  min="0"
                  value={downgrades}
                  onChange={(e) => setDowngrades(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Downgrade Details</Label>
                <Input
                  value={downgradeDetails}
                  onChange={(e) => setDowngradeDetails(e.target.value)}
                  className="mt-1"
                  placeholder="Details..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Cancellations</Label>
                <Input
                  type="number"
                  min="0"
                  value={cancellations}
                  onChange={(e) => setCancellations(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Cancellation Details</Label>
                <Input
                  value={cancellationDetails}
                  onChange={(e) => setCancellationDetails(e.target.value)}
                  className="mt-1"
                  placeholder="Details..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Freezes</Label>
                <Input
                  type="number"
                  min="0"
                  value={freezes}
                  onChange={(e) => setFreezes(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Freeze Details</Label>
                <Input
                  value={freezeDetails}
                  onChange={(e) => setFreezeDetails(e.target.value)}
                  className="mt-1"
                  placeholder="Details..."
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Intros Booked (SA Feature) */}
      {isSA && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Intros Booked
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {introsBooked.map((intro, index) => (
              <div key={intro.id} className="p-3 bg-muted/50 rounded-lg space-y-3 relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={() => removeIntroBooked(index)}
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>

                <div>
                  <Label className="text-xs">Member Name *</Label>
                  <Input
                    value={intro.memberName || ''}
                    onChange={(e) => updateIntroBooked(index, { memberName: e.target.value })}
                    className="mt-1"
                    placeholder="Full name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Class Date *</Label>
                    <Input
                      type="date"
                      value={intro.classDate || ''}
                      onChange={(e) => updateIntroBooked(index, { classDate: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Coach *</Label>
                    <Select
                      value={intro.coachName || ''}
                      onValueChange={(v) => updateIntroBooked(index, { coachName: v })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {COACHES.map((coach) => (
                          <SelectItem key={coach} value={coach}>{coach}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">SA Working That Shift *</Label>
                  <Select
                    value={intro.saWorkingShift || ''}
                    onValueChange={(v) => updateIntroBooked(index, { saWorkingShift: v })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_STAFF.map((staff) => (
                        <SelectItem key={staff} value={staff}>{staff}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Fitness Goal</Label>
                  <Input
                    value={intro.fitnessGoal || ''}
                    onChange={(e) => updateIntroBooked(index, { fitnessGoal: e.target.value })}
                    className="mt-1"
                    placeholder="Member's goal"
                  />
                </div>

                <div>
                  <Label className="text-xs">Lead Source *</Label>
                  <Select
                    value={intro.leadSource || ''}
                    onValueChange={(v) => updateIntroBooked(index, { leadSource: v as LeadSource })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select source..." />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_SOURCES.map((source) => (
                        <SelectItem key={source} value={source}>{source}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}

            {introsBooked.length < 5 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={addIntroBooked}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Intro Booked ({introsBooked.length}/5)
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Intros Run */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Intros Run
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {introsRun.map((intro, index) => (
            <div key={intro.id} className="p-3 bg-muted/50 rounded-lg space-y-3 relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6"
                onClick={() => removeIntroRun(index)}
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Member Name *</Label>
                  <Input
                    value={intro.memberName || ''}
                    onChange={(e) => updateIntroRun(index, { memberName: e.target.value })}
                    className="mt-1"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <Label className="text-xs">Class Time *</Label>
                  <Input
                    type="time"
                    value={intro.classTime || ''}
                    onChange={(e) => updateIntroRun(index, { classTime: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Booking Source</Label>
                <Select
                  value={intro.bookingSource || ''}
                  onValueChange={(v) => updateIntroRun(index, { bookingSource: v as BookingSource })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select source..." />
                  </SelectTrigger>
                  <SelectContent>
                    {BOOKING_SOURCES.map((source) => (
                      <SelectItem key={source} value={source}>{source}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs mb-2 block">Process Checklist</Label>
                <div className="space-y-2">
                  {PROCESS_CHECKLIST.map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <Checkbox
                        id={`process-${index}-${item}`}
                        checked={intro.processChecklist?.includes(item)}
                        onCheckedChange={(checked) => {
                          const current = intro.processChecklist || [];
                          updateIntroRun(index, {
                            processChecklist: checked
                              ? [...current, item]
                              : current.filter(i => i !== item)
                          });
                        }}
                      />
                      <Label htmlFor={`process-${index}-${item}`} className="text-xs font-normal">
                        {item}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs mb-2 block">Lead Measures</Label>
                <div className="space-y-2">
                  {LEAD_MEASURES.map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <Checkbox
                        id={`lead-${index}-${item}`}
                        checked={intro.leadMeasures?.includes(item)}
                        onCheckedChange={(checked) => {
                          const current = intro.leadMeasures || [];
                          updateIntroRun(index, {
                            leadMeasures: checked
                              ? [...current, item]
                              : current.filter(i => i !== item)
                          });
                        }}
                      />
                      <Label htmlFor={`lead-${index}-${item}`} className="text-xs font-normal">
                        {item}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs">Result *</Label>
                <Select
                  value={intro.result || ''}
                  onValueChange={(v) => updateIntroRun(index, { result: v as MembershipType })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select result..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMBERSHIP_TYPES.map((type) => (
                      <SelectItem key={type.label} value={type.label}>
                        {type.label} {type.commission > 0 && `($${type.commission.toFixed(2)})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Additional Notes</Label>
                <Textarea
                  value={intro.notes || ''}
                  onChange={(e) => updateIntroRun(index, { notes: e.target.value })}
                  className="mt-1 min-h-[60px]"
                  placeholder="Any notes..."
                />
              </div>
            </div>
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

      {/* Sales Outside Intro (SA Feature) */}
      {isSA && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Sales Outside Intro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="hasSalesOutside"
                checked={hasSalesOutside}
                onCheckedChange={(checked) => setHasSalesOutside(!!checked)}
              />
              <Label htmlFor="hasSalesOutside" className="text-sm">
                Made sales outside of an intro?
              </Label>
            </div>

            {hasSalesOutside && (
              <>
                {salesOutsideIntro.map((sale, index) => (
                  <div key={sale.id} className="p-3 bg-muted/50 rounded-lg space-y-3 relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={() => removeSaleOutside(index)}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>

                    <div>
                      <Label className="text-xs">Member Name *</Label>
                      <Input
                        value={sale.memberName || ''}
                        onChange={(e) => updateSaleOutside(index, { memberName: e.target.value })}
                        className="mt-1"
                        placeholder="Full name"
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Lead Source *</Label>
                      <Select
                        value={sale.leadSource || ''}
                        onValueChange={(v) => updateSaleOutside(index, { leadSource: v as LeadSource })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select source..." />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_SOURCES.map((source) => (
                            <SelectItem key={source} value={source}>{source}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs">Membership Type *</Label>
                      <Select
                        value={sale.membershipType || ''}
                        onValueChange={(v) => updateSaleOutside(index, { membershipType: v as MembershipType })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select type..." />
                        </SelectTrigger>
                        <SelectContent>
                          {MEMBERSHIP_TYPES.filter(t => t.commission > 0).map((type) => (
                            <SelectItem key={type.label} value={type.label}>
                              {type.label} (${type.commission.toFixed(2)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}

                {salesOutsideIntro.length < 5 && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={addSaleOutside}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Sale ({salesOutsideIntro.length}/5)
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Miscellaneous */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Miscellaneous</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Milestones Celebrated Today</Label>
            <Textarea
              value={milestones}
              onChange={(e) => setMilestones(e.target.value)}
              className="mt-1 min-h-[60px]"
              placeholder="Any member milestones..."
            />
          </div>

          <div>
            <Label className="text-xs">Equipment Issues</Label>
            <Textarea
              value={equipmentIssues}
              onChange={(e) => setEquipmentIssues(e.target.value)}
              className="mt-1 min-h-[60px]"
              placeholder="Any equipment problems..."
            />
          </div>

          <div>
            <Label className="text-xs">Other Important Info</Label>
            <Textarea
              value={otherInfo}
              onChange={(e) => setOtherInfo(e.target.value)}
              className="mt-1 min-h-[60px]"
              placeholder="Anything else to note..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <Button 
        onClick={handleSubmit}
        className="w-full h-14 text-lg font-bold"
        size="lg"
      >
        <CheckCircle className="w-5 h-5 mr-2" />
        Submit Shift Recap
      </Button>
    </div>
  );
}
