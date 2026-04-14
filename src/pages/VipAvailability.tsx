/**
 * Public VIP Availability page — /vip-availability
 * Monthly calendar showing available VIP session slots.
 * Groups can view and claim available slots via a modal form.
 * No auth required. OTF-branded.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
const sb = supabase as any;
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Loader2, CheckCircle, ChevronLeft, ChevronRight, ChevronDown, Download } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  isBefore,
  isSameMonth,
  isToday as isDateToday,
} from 'date-fns';
import { formatDisplayTime } from '@/lib/time/timeUtils';
import { getNowCentral, getTodayYMD } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

/* ── Types ─────────────────────────────────────────── */

interface PublicSession {
  id: string;
  session_date: string;
  session_time: string;
  status: string;
  reserved_by_group: string | null;
  description: string | null;
  session_type: string | null;
}

/* ── Claim Modal ───────────────────────────────────── */

function ClaimDialog({
  session,
  open,
  onOpenChange,
  onClaimed,
}: {
  session: PublicSession | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onClaimed: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [phone, setPhone] = useState('');

  const [sessionType, setSessionType] = useState<'exclusive' | 'business_customers' | ''>('');
  const [businessSubType, setBusinessSubType] = useState<'staff_only' | 'staff_customers' | 'staff_members' | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setGroupName('');
      setPhone('');
      setSessionType('');
      setBusinessSubType('');
      setError(null);
      setConfirmed(false);
    }
  }, [open]);

  if (!session) return null;

  // Block claims within 7 days — public page cannot override
  const sessionDate = new Date(session.session_date + 'T00:00:00');
  const now = getNowCentral();
  const diffDays = Math.ceil((sessionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const tooSoon = diffDays < 3;

  const canSubmit =
    name.trim() && groupName.trim() && phone.trim() && sessionType &&
    (sessionType !== 'business_customers' || businessSubType) && !tooSoon;

  const handleClaim = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const { data: current } = await sb
        .from('vip_sessions')
        .select('status')
        .eq('id', session.id)
        .is('archived_at', null)
        .single();
      if (!current || (current as any).status !== 'open') {
        setError('This slot was just claimed. Please choose another.');
        setSubmitting(false);
        return;
      }

      const { error: upErr } = await sb
        .from('vip_sessions')
        .update({
          status: 'reserved',
          reserved_by_group: groupName.trim(),
          reserved_contact_name: name.trim(),
          reserved_contact_phone: phone.trim(),
          session_type: sessionType,
          business_sub_type: sessionType === 'business_customers' ? businessSubType : null,
        } as any)
        .eq('id', session.id)
        .eq('status', 'open')
        .is('archived_at', null);
      if (upErr) throw upErr;

      await sb.from('vip_registrations').insert({
        vip_session_id: session.id,
        first_name: name.trim().split(' ')[0] || name.trim(),
        last_name: name.trim().split(' ').slice(1).join(' ') || '',
        phone: phone.trim(),
        is_group_contact: true,
      } as any);

      const formattedDate = format(
        new Date(session.session_date + 'T00:00:00'),
        'MMM d'
      );
      const formattedTime = formatDisplayTime(session.session_time);

      await sb.from('notifications').insert({
        notification_type: 'vip_slot_claimed',
        title: `${groupName.trim()} claimed VIP slot`,
        body: `${groupName.trim()} claimed the ${formattedDate} ${formattedTime} VIP slot (${sessionType}). Contact: ${name.trim()}`,
        target_user: null,
        meta: {
          session_id: session.id,
          group_name: groupName.trim(),
          contact_name: name.trim(),
          contact_phone: phone.trim(),
          session_type: sessionType,
          business_sub_type: sessionType === 'business_customers' ? businessSubType : null,
        },
      });

      // Post to GroupMe (non-blocking)
      const gmMsg = `🎉 VIP Class Claimed!\n${groupName.trim()} booked ${formattedDate} at ${formattedTime}\nType: ${sessionType === 'exclusive' ? 'Private — Group Only' : 'Business'}\nContact: ${name.trim()} (${phone.trim()})`;
      supabase.functions.invoke('post-groupme', {
        body: { action: 'custom', text: gmMsg },
      }).catch(() => {});

      setConfirmed(true);
      onClaimed(session.id);
    } catch (err: any) {
      console.error('Claim error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Claim{' '}
            {format(new Date(session.session_date + 'T00:00:00'), 'EEEE, MMM d')}{' '}
            at {formatDisplayTime(session.session_time)}
          </DialogTitle>
          <DialogDescription>
            Fill out the form below to reserve this private group class.
          </DialogDescription>
        </DialogHeader>

        {confirmed ? (
          (() => {
            const d = new Date(session.session_date + 'T00:00:00');
            const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
            const month = monthNames[d.getMonth()];
            const day = d.getDate();
            const [h, m_] = session.session_time.split(':');
            const hour = parseInt(h);
            const min = m_ || '00';
            const ampm = hour >= 12 ? 'pm' : 'am';
            const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
            const slug = `vip-${month}${day}-${h12}${min !== '00' ? min : ''}${ampm}`;
            const shareableLink = `https://otf-tuscaloosa.lovable.app/vip/${slug}/register`;
            const prettyDate = format(d, 'EEEE, MMMM d, yyyy');
            const prettyTime = formatDisplayTime(session.session_time);
            const brandedClassTitle = `OTF Tuscaloosa x ${groupName.trim() || 'VIP'} VIP Class`;
            const safeGroupName = groupName.trim().replace(/[^a-zA-Z0-9]/g, '-');
            const fileName = `OTF-VIP-${safeGroupName}-${format(d, 'yyyy-MM-dd')}.png`;

            const handleDownloadQR = () => {
              const canvas = document.createElement('canvas');
              const size = 600;
              const padding = 60;
              const textAreaHeight = 120;
              const totalHeight = size + padding * 2 + textAreaHeight;
              const totalWidth = size + padding * 2;
              canvas.width = totalWidth;
              canvas.height = totalHeight;
              const ctx = canvas.getContext('2d');
              if (!ctx) return;

              // White background
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, totalWidth, totalHeight);

              // Copy QR from DOM
              const qrCanvas = document.getElementById('qr-canvas') as HTMLCanvasElement | null;
              if (qrCanvas) {
                ctx.drawImage(qrCanvas, padding, padding, size, size);
              }

              // Orange border around QR
              ctx.strokeStyle = '#E8540A';
              ctx.lineWidth = 4;
              ctx.strokeRect(padding - 6, padding - 6, size + 12, size + 12);

              // Text below QR
              const textY = padding + size + 30;
              ctx.fillStyle = '#1a1a1a';
              ctx.textAlign = 'center';
              ctx.font = 'bold 22px sans-serif';
              ctx.fillText(brandedClassTitle, totalWidth / 2, textY);
              ctx.font = '18px sans-serif';
              ctx.fillText(`${prettyDate} at ${prettyTime}`, totalWidth / 2, textY + 32);
              ctx.font = '16px sans-serif';
              ctx.fillStyle = '#666666';
              ctx.fillText('Scan to register before class', totalWidth / 2, textY + 62);

              const link = document.createElement('a');
              link.download = fileName;
              link.href = canvas.toDataURL('image/png');
              link.click();
            };

            return (
              <div className="py-4 text-center space-y-4">
                <CheckCircle className="w-10 h-10 text-green-600 mx-auto" />
                <p className="font-semibold text-green-700 dark:text-green-400">
                  Your slot is confirmed!
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {brandedClassTitle}
                </p>
                <p className="text-sm text-muted-foreground">
                  Share this link with your group so each member can fill out their info before class.
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={shareableLink}
                    className="text-xs h-10 border bg-muted/30"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button
                    variant="outline"
                    className="h-10 min-h-[44px] shrink-0 text-xs font-medium"
                    onClick={() => navigator.clipboard.writeText(shareableLink)}
                  >
                    Copy
                  </Button>
                </div>

                {/* QR Code */}
                <div className="flex flex-col items-center gap-2 pt-2">
                  <div className="border-4 border-[#E8540A] rounded-lg p-2 bg-white inline-block">
                    <QRCodeCanvas
                      id="qr-canvas"
                      value={shareableLink}
                      size={180}
                      bgColor="#FFFFFF"
                      fgColor="#000000"
                      level="M"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Scan to fill out your info before class
                  </p>
                </div>

                {/* Download QR */}
                <Button
                  variant="outline"
                  className="w-full min-h-[44px] text-sm font-medium gap-2"
                  onClick={handleDownloadQR}
                >
                  <Download className="w-4 h-4" />
                  Download QR Code
                </Button>

                {/* Collab Post Tip */}
                <div className="border-t pt-4 mt-2">
                  <div className="bg-muted/40 rounded-lg p-4 text-left space-y-2">
                    <p className="text-sm font-semibold">📲 Maximize your group's experience</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      The best engagement we've seen is sharing this link on a social media post — and we'd love to collaborate.
                      Tag <span className="font-medium text-foreground">@otftuscaloosa</span> and we'll reshare your post to our audience,
                      helping you promote your event while we build our community together.
                    </p>
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="space-y-3">
            {tooSoon && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-400">
                ⚠️ This slot is less than 3 days away and can no longer be claimed online. Please contact us directly if you need to book on short notice.
              </div>
            )}
            {error && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Your Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" className="border h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Group Name</Label>
              <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Alpha Phi Sorority" className="border h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(205) 555-1234" className="border h-11" />
            </div>

            {/* Class Type Selection */}
            <div className="space-y-2">
              <Label>Who will be joining this class?</Label>
              <div className="grid grid-cols-1 gap-2">
                {/* Option 1 — Private */}
                <button
                  type="button"
                  onClick={() => { setSessionType('exclusive'); setBusinessSubType(''); }}
                  className={cn(
                    'w-full text-left rounded-lg border-2 p-3 cursor-pointer transition-colors min-h-[44px]',
                    sessionType === 'exclusive'
                      ? 'border-[#FF6900] bg-orange-50 dark:bg-orange-950/20'
                      : 'border-border hover:border-muted-foreground/30'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">Private — Group Only</p>
                    <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', sessionType === 'exclusive' && 'rotate-180')} />
                  </div>
                  {sessionType === 'exclusive' && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Just your group. No outside members. An intimate experience designed entirely for your people.
                    </p>
                  )}
                </button>

                {/* Option 2 — Business Event */}
                <div>
                  <button
                    type="button"
                    onClick={() => { setSessionType('business_customers'); }}
                    className={cn(
                      'w-full text-left rounded-lg border-2 p-3 cursor-pointer transition-colors min-h-[44px]',
                      sessionType === 'business_customers'
                        ? 'border-[#FF6900] bg-orange-50 dark:bg-orange-950/20'
                        : 'border-border hover:border-muted-foreground/30'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">Business</p>
                      <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', sessionType === 'business_customers' && 'rotate-180')} />
                    </div>
                    {sessionType === 'business_customers' && (
                      <div className="mt-1.5 space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Bring your staff AND invite your customers for a community bonding event. We'll give you a QR code to help drive sign-ups and get your customers through the door.
                        </p>
                        {/* Sub-options */}
                        <div className="space-y-1.5 pl-1">
                          {([
                            { val: 'staff_only' as const, label: 'Staff only — just your team', sub: 'Keep it internal. A private experience for your staff.' },
                            { val: 'staff_customers' as const, label: 'Staff + your customers', sub: "Invite your community. We'll provide a QR code for sign-ups so your customers can join the event." },
                            { val: 'staff_members' as const, label: 'Staff + OTF members', sub: "We'll market with you. Your group joins our members for a collaborative class and we'll do a collab post together on social." },
                          ]).map((opt) => (
                            <button
                              key={opt.val}
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setBusinessSubType(opt.val); }}
                              className={cn(
                                'w-full text-left rounded-md border p-2.5 cursor-pointer transition-colors min-h-[44px]',
                                businessSubType === opt.val
                                  ? 'border-[#FF6900] bg-orange-50/50 dark:bg-orange-950/10'
                                  : 'border-border hover:border-muted-foreground/30'
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  'w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
                                  businessSubType === opt.val ? 'border-[#FF6900]' : 'border-muted-foreground/40'
                                )}>
                                  {businessSubType === opt.val && <span className="w-1.5 h-1.5 rounded-full bg-[#FF6900]" />}
                                </span>
                                <p className="text-xs font-medium">{opt.label}</p>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-1 pl-5.5">{opt.sub}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <Button
              className="w-full h-11 bg-[#FF6900] hover:bg-[#e55f00] text-white font-semibold"
              onClick={handleClaim}
              disabled={submitting || !canSubmit}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Claim This Slot
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Desktop Slot Pill ─────────────────────────────── */

function SlotPill({
  session,
  onClaim,
  isConfirmed,
}: {
  session: PublicSession;
  onClaim: () => void;
  isConfirmed: boolean;
}) {
  const isOpen = session.status === 'open';
  const isOpenType = session.session_type === 'open';
  const isBusiness = session.session_type === 'business_customers';

  // Check 7-day block
  const sessionDate = new Date(session.session_date + 'T00:00:00');
  const now = getNowCentral();
  const diffDays = Math.ceil((sessionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const tooSoon = isOpen && diffDays < 3;

  if (isConfirmed) {
    return (
      <div className="rounded border-l-4 border-l-green-500 bg-green-50 dark:bg-green-950/30 px-1.5 py-1 text-center">
        <CheckCircle className="w-3.5 h-3.5 text-green-600 mx-auto" />
      </div>
    );
  }

  const borderColor = isOpen
    ? tooSoon ? 'border-l-gray-400' : 'border-l-green-500'
    : isBusiness
      ? 'border-l-blue-500'
      : isOpenType
        ? 'border-l-teal-500'
        : 'border-l-amber-500';

  const canClick = isOpen && !tooSoon;

  return (
    <div
      role={canClick ? 'button' : undefined}
      tabIndex={canClick ? 0 : undefined}
      onClick={(e) => {
        if (canClick) {
          e.stopPropagation();
          onClaim();
        }
      }}
      onKeyDown={(e) => {
        if (canClick && (e.key === 'Enter' || e.key === ' ')) {
          e.stopPropagation();
          onClaim();
        }
      }}
      className={cn(
        'rounded border-l-4 px-1.5 py-1 bg-card',
        borderColor,
        canClick && 'cursor-pointer hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors'
      )}
    >
      <p className={cn('text-[11px] font-semibold leading-tight', (!isOpen || tooSoon) && 'text-muted-foreground')}>
        {formatDisplayTime(session.session_time)}
      </p>
      {isOpen && tooSoon ? (
        <p className="text-[10px] leading-tight text-muted-foreground italic">Contact us</p>
      ) : isOpen ? (
        <p className="text-[10px] leading-tight text-green-600 dark:text-green-400 font-medium">Available</p>
      ) : isBusiness ? (
        <p className="text-[10px] leading-tight text-blue-600 dark:text-blue-400 truncate">
          {session.reserved_by_group || 'Group'} · Business Event
        </p>
      ) : isOpenType ? (
        <p className="text-[10px] leading-tight text-teal-600 dark:text-teal-400 truncate">
          {session.reserved_by_group || 'Group'} · Members Welcome
        </p>
      ) : (
        <p className="text-[10px] leading-tight text-amber-600 dark:text-amber-400 italic truncate">
          {session.reserved_by_group || 'Reserved'}
        </p>
      )}
    </div>
  );
}

/* ── Day Detail List ──────────────────────────────── */

function DaySlotList({
  sessions,
  confirmedIds,
  onClaim,
}: {
  sessions: PublicSession[];
  confirmedIds: Set<string>;
  onClaim: (s: PublicSession) => void;
}) {
  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">No slots this day</p>;
  }

  return (
    <div className="space-y-2">
      {sessions.map((s) => {
        const isOpen = s.status === 'open';
        const isOpenType = s.session_type === 'open';
        const isBusiness = s.session_type === 'business_customers';
        const confirmed = confirmedIds.has(s.id);

        if (confirmed) {
          return (
            <div key={s.id} className="rounded-lg border-l-4 border-l-green-500 bg-green-50 dark:bg-green-950/30 p-3 text-center">
              <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
              <p className="text-xs font-semibold text-green-700 dark:text-green-400">Confirmed!</p>
            </div>
          );
        }

        const borderColor = isOpen
          ? 'border-l-green-500'
          : isBusiness
            ? 'border-l-blue-500'
            : isOpenType
              ? 'border-l-teal-500'
              : 'border-l-amber-500';

        return (
          <div key={s.id} className={cn('rounded-lg border-l-4 p-3', borderColor, 'bg-card')}>
            <p className="font-semibold text-sm">{formatDisplayTime(s.session_time)}</p>
            {isOpen ? (
              <>
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">Available</p>
                <Button
                  className="w-full h-11 mt-2 bg-[#FF6900] hover:bg-[#e55f00] text-white font-semibold text-sm"
                  onClick={() => onClaim(s)}
                >
                  Claim This Slot
                </Button>
              </>
            ) : isBusiness ? (
              <>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  Reserved — {s.reserved_by_group || 'Group'} · Business Event
                </p>
              </>
            ) : isOpenType ? (
              <>
                <p className="text-xs text-teal-600 dark:text-teal-400 font-medium">
                  Reserved — {s.reserved_by_group || 'Group'} + Members Welcome
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Reserved — Private Event</p>
                {s.reserved_by_group && (
                  <p className="text-xs text-muted-foreground italic mt-0.5">{s.reserved_by_group}</p>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Month Helpers ─────────────────────────────────── */

function useMonthData(monthOffset: number) {
  return useMemo(() => {
    const now = getNowCentral();
    const base = addMonths(now, monthOffset);
    const monthStart = startOfMonth(base);
    const monthEnd = endOfMonth(base);
    // Calendar grid: start from Sunday of the week containing monthStart
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const todayStr = getTodayYMD();

    return {
      monthStart,
      monthEnd,
      monthLabel: format(monthStart, 'MMMM yyyy'),
      days: allDays.map((d) => {
        const dateStr = format(d, 'yyyy-MM-dd');
        return {
          date: dateStr,
          dayDate: d,
          dateNum: d.getDate(),
          isToday: dateStr === todayStr,
          isCurrentMonth: isSameMonth(d, monthStart),
          isPast: isBefore(d, new Date(todayStr + 'T00:00:00')) && dateStr !== todayStr,
        };
      }),
      todayStr,
      queryStart: format(gridStart, 'yyyy-MM-dd'),
      queryEnd: format(gridEnd, 'yyyy-MM-dd'),
    };
  }, [monthOffset]);
}

/* ── Main Page ─────────────────────────────────────── */

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function VipAvailability() {
  const isMobile = useIsMobile();
  const [sessions, setSessions] = useState<PublicSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0);
  const [claimSession, setClaimSession] = useState<PublicSession | null>(null);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { monthLabel, days, queryStart, queryEnd } = useMonthData(monthOffset);

  const isCurrentMonth = monthOffset === 0;

  const fetchSessions = useCallback(async () => {
    const { data } = await sb
      .from('vip_sessions')
      .select('id, session_date, session_time, status, reserved_by_group, description, session_type')
      .is('archived_at', null)
      .eq('is_on_availability_page', true)
      .gte('session_date', queryStart)
      .lte('session_date', queryEnd)
      .neq('status', 'cancelled')
      .order('session_date', { ascending: true })
      .order('session_time', { ascending: true });
    setSessions((data as any[]) || []);
    setLoading(false);
  }, [queryStart, queryEnd]);

  useEffect(() => {
    setLoading(true);
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    const channel = sb
      .channel('vip-availability')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vip_sessions' },
        () => fetchSessions()
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [fetchSessions]);

  // Group sessions by date
  const sessionsByDate = useMemo(() => {
    const map: Record<string, PublicSession[]> = {};
    for (const s of sessions) {
      if (!map[s.session_date]) map[s.session_date] = [];
      map[s.session_date].push(s);
    }
    return map;
  }, [sessions]);

  // Selected day sessions for mobile sheet
  const selectedDaySessions = selectedDay ? sessionsByDate[selectedDay] || [] : [];

  // Split days into weeks (rows of 7)
  const weeks = useMemo(() => {
    const result: typeof days[number][][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-[#FF6900] text-white py-8 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-2xl font-bold">
            OTF Tuscaloosa — VIP Group Classes
          </h1>
          <p className="mt-2 text-sm opacity-90">
            We host free private fitness experiences for groups. Pick an
            available time below to claim your slot.
          </p>
        </div>
      </div>

      {/* Story */}
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-2 text-center">
        <p className="text-base font-semibold text-foreground">
          Your group. Our coaches. One hour that changes how your team sees each other.
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Free for your entire group. All fitness levels welcome. Just pick a time.
        </p>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-4">
        {/* Month Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="min-h-[44px] flex-1 text-sm font-medium"
            disabled={isCurrentMonth}
            onClick={() => setMonthOffset((o) => o - 1)}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous Month
          </Button>
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold">{monthLabel}</p>
            {!isCurrentMonth && (
              <button
                onClick={() => setMonthOffset(0)}
                className="text-xs text-[#FF6900] underline cursor-pointer mt-0.5"
              >
                Back to this month
              </button>
            )}
          </div>
          <Button
            variant="outline"
            className="min-h-[44px] flex-1 text-sm font-medium"
            onClick={() => setMonthOffset((o) => o + 1)}
          >
            Next Month
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Calendar Grid */}
            <div className="border rounded-lg overflow-hidden bg-card">
              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b bg-muted/30">
                {DAY_HEADERS.map((d) => (
                  <div key={d} className="text-center py-2 text-xs font-bold text-muted-foreground">
                    {d}
                  </div>
                ))}
              </div>

              {/* Week Rows */}
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
                  {week.map((day) => {
                    const daySessions = sessionsByDate[day.date] || [];
                    const hasSlots = daySessions.length > 0;

                    return (
                      <button
                        key={day.date}
                        onClick={() => {
                          if (isMobile && hasSlots) setSelectedDay(day.date);
                        }}
                        className={cn(
                          'relative border-r last:border-r-0 p-1 transition-colors text-left align-top',
                          isMobile ? 'min-h-[52px]' : 'min-h-[80px] min-w-[120px]',
                          !day.isCurrentMonth && 'bg-muted/20',
                          day.isToday && 'bg-orange-50/50 dark:bg-orange-950/10',
                          isMobile && hasSlots && 'cursor-pointer hover:bg-muted/40',
                          (!hasSlots || !isMobile) && 'cursor-default'
                        )}
                      >
                        {/* Date Number */}
                        <span
                          className={cn(
                            'inline-flex items-center justify-center text-xs font-medium',
                            isMobile ? 'w-6 h-6' : 'w-7 h-7',
                            day.isToday
                              ? 'bg-[#FF6900] text-white rounded-full font-bold'
                              : !day.isCurrentMonth
                                ? 'text-muted-foreground/40'
                                : 'text-foreground'
                          )}
                        >
                          {day.dateNum}
                        </span>

                        {/* Slot display */}
                        {hasSlots && (
                          isMobile ? (
                            /* Mobile: colored dots */
                            <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                              {daySessions.map((s) => {
                                const isOpen = s.status === 'open';
                                const isOpenType = s.session_type === 'open';
                                const isBusiness = s.session_type === 'business_customers';
                                const dotColor = confirmedIds.has(s.id)
                                  ? 'bg-green-500 ring-1 ring-green-300'
                                  : isOpen
                                    ? 'bg-green-500'
                                    : isBusiness
                                      ? 'bg-blue-500'
                                      : isOpenType
                                        ? 'bg-teal-500'
                                        : 'bg-amber-500';
                                return <span key={s.id} className={cn('w-2 h-2 rounded-full', dotColor)} />;
                              })}
                            </div>
                          ) : (
                            /* Desktop: inline time pills */
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              {daySessions.map((s) => (
                                <SlotPill
                                  key={s.id}
                                  session={s}
                                  isConfirmed={confirmedIds.has(s.id)}
                                  onClaim={() => setClaimSession(s)}
                                />
                              ))}
                            </div>
                          )
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>


            {/* Legend line */}
            <p className="text-center text-xs text-muted-foreground pt-2">
              Green = available to claim · Amber = reserved private · Blue = business event · Teal = open to members · Max capacity: 36 · Tap to book
            </p>
          </>
        )}
      </div>

      {/* Mobile Bottom Sheet */}
      {isMobile && (
        <Sheet open={!!selectedDay} onOpenChange={(o) => { if (!o) setSelectedDay(null); }}>
          <SheetContent side="bottom" className="max-h-[70vh]">
            <SheetHeader>
              <SheetTitle>
                {selectedDay && format(new Date(selectedDay + 'T00:00:00'), 'EEEE, MMMM d')}
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 overflow-y-auto">
              <DaySlotList
                sessions={selectedDaySessions}
                confirmedIds={confirmedIds}
                onClaim={(s) => {
                  setSelectedDay(null);
                  setTimeout(() => setClaimSession(s), 200);
                }}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Claim Dialog */}
      <ClaimDialog
        session={claimSession}
        open={!!claimSession}
        onOpenChange={(o) => {
          if (!o) setClaimSession(null);
        }}
        onClaimed={(id) => {
          setConfirmedIds((prev) => new Set(prev).add(id));
          fetchSessions();
        }}
      />
    </div>
  );
}
