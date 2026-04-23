/**
 * Shared IntroCard component — unified visual language for all intro/follow-up cards.
 *
 * Supports inline-editable header fields when `editable` is true.
 */
import { ReactNode, useState, useRef, useEffect, useCallback } from 'react';
import { format, parse } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatDisplayTime } from '@/lib/time/timeUtils';
import { formatPhoneDisplay } from '@/lib/parsing/phone';
import { PhoneLink } from '@/components/shared/PhoneLink';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { COACHES, LEAD_SOURCES, CLASS_TIMES, CLASS_TIME_LABELS } from '@/types';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Sparkles } from 'lucide-react';
import { VipSessionPicker } from '@/components/shared/VipSessionPicker';
import { detectVipSessionForBooking } from '@/lib/vip/detectVipSessionForBooking';

const isVipSource = (s: string | null | undefined) =>
  !!s && (s === 'VIP Class' || s === 'VIP Class (Friend)' || s.toLowerCase().startsWith('vip class'));

export interface IntroCardProps {
  memberName: string;
  classDate: string;
  introTime: string | null;
  coachName: string | null;
  leadSource: string | null;
  phone: string | null;
  email?: string | null;
  vipSessionId?: string | null;
  vipClassName?: string | null;
  referredBy?: string | null;

  /** Inline editing support */
  bookingId?: string;
  editable?: boolean;
  editedBy?: string;
  onFieldSaved?: () => void;

  badges?: ReactNode;
  outcomeBadge?: ReactNode;
  timingInfo?: ReactNode;
  actionButtons?: ReactNode;
  secondaryActions?: ReactNode;
  lastContactSummary?: string;
  borderColor?: string;
  topBanner?: ReactNode;
  outcomeBanner?: ReactNode;
  children?: ReactNode;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
  onCopyPhone?: () => void;
}

/* ── tiny inline text editor ── */
function InlineText({ value, field, bookingId, editedBy, onSaved, type = 'text' }: {
  value: string; field: string; bookingId: string; editedBy: string; onSaved: () => void; type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [val, setVal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocalValue(value); setVal(value); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const save = async () => {
    setEditing(false);
    if (val === localValue) return;
    const prev = localValue;
    setLocalValue(val); // optimistic
    const { error } = await supabase.from('intros_booked').update({
      [field]: val, last_edited_at: new Date().toISOString(), last_edited_by: editedBy,
    } as any).eq('id', bookingId);
    if (error) {
      toast.error('Save failed');
      setLocalValue(prev);
      setVal(prev);
    } else {
      toast.success('Saved');
      onSaved();
    }
  };

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)}
        className="hover:underline cursor-pointer rounded px-0.5 -mx-0.5 hover:bg-white/10 transition-colors truncate max-w-[120px]"
        style={{ color: 'inherit' }}>
        {localValue || '—'}
      </button>
    );
  }
  return (
    <Input ref={ref} type={type} value={val} onChange={e => setVal(e.target.value)}
      onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setVal(localValue); setEditing(false); } }}
      className="h-5 text-[11px] w-24 px-1 py-0 bg-background text-foreground border rounded" />
  );
}

/* ── inline select ── */
function InlineSelect({ value, field, bookingId, editedBy, onSaved, options, placeholder, onAfterSave }: {
  value: string; field: string; bookingId: string; editedBy: string; onSaved: () => void;
  options: readonly string[]; placeholder?: string;
  onAfterSave?: (newVal: string) => void;
}) {
  const [localValue, setLocalValue] = useState(value);
  useEffect(() => { setLocalValue(value); }, [value]);

  const save = async (val: string) => {
    const prev = localValue;
    setLocalValue(val); // optimistic
    const { error } = await supabase.from('intros_booked').update({
      [field]: val, last_edited_at: new Date().toISOString(), last_edited_by: editedBy,
    } as any).eq('id', bookingId);
    if (error) {
      toast.error('Save failed');
      setLocalValue(prev);
    } else {
      toast.success('Saved');
      onSaved();
      onAfterSave?.(val);
    }
  };

  return (
    <Select value={localValue || ''} onValueChange={save}>
      <SelectTrigger className="h-5 text-[11px] px-1 py-0 border-0 bg-transparent gap-0.5 w-auto min-w-0 focus:ring-0 hover:bg-white/10 transition-colors"
        style={{ color: 'inherit' }}>
        <SelectValue placeholder={placeholder || '—'} />
      </SelectTrigger>
      <SelectContent className="max-h-60">
        {options.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/* ── inline time picker ── */
function InlineTimePicker({ value, bookingId, editedBy, onSaved }: {
  value: string | null; bookingId: string; editedBy: string; onSaved: () => void;
}) {
  const [localValue, setLocalValue] = useState<string | null>(value);
  const [customMode, setCustomMode] = useState(false);
  const [customVal, setCustomVal] = useState(value || '');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocalValue(value); setCustomVal(value || ''); }, [value]);
  useEffect(() => { if (customMode) ref.current?.focus(); }, [customMode]);

  const save = async (val: string) => {
    const prev = localValue;
    setLocalValue(val); // optimistic
    const { error } = await supabase.from('intros_booked').update({
      intro_time: val, last_edited_at: new Date().toISOString(), last_edited_by: editedBy,
    } as any).eq('id', bookingId);
    if (error) {
      toast.error('Save failed');
      setLocalValue(prev);
    } else {
      toast.success('Saved');
      onSaved();
    }
  };

  const handleSelect = (val: string) => {
    if (val === '__custom__') { setCustomMode(true); return; }
    setCustomMode(false);
    save(val);
  };

  const handleCustomBlur = () => {
    setCustomMode(false);
    if (customVal && customVal !== localValue) save(customVal);
  };

  if (customMode) {
    return (
      <Input ref={ref} type="time" value={customVal} onChange={e => setCustomVal(e.target.value)}
        onBlur={handleCustomBlur} onKeyDown={e => { if (e.key === 'Enter') handleCustomBlur(); if (e.key === 'Escape') setCustomMode(false); }}
        className="h-5 text-[11px] w-20 px-1 py-0 bg-background text-foreground border rounded" />
    );
  }

  const display = localValue ? (CLASS_TIME_LABELS[localValue] || formatDisplayTime(localValue)) : '—';

  return (
    <Select value={localValue || ''} onValueChange={handleSelect}>
      <SelectTrigger className="h-5 text-[11px] px-1 py-0 border-0 bg-transparent gap-0.5 w-auto min-w-0 focus:ring-0 hover:bg-white/10 transition-colors"
        style={{ color: 'inherit' }}>
        <SelectValue placeholder="Time">{display}</SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-60">
        {CLASS_TIMES.map(t => (
          <SelectItem key={t} value={t} className="text-xs">{CLASS_TIME_LABELS[t]}</SelectItem>
        ))}
        <SelectItem value="__custom__" className="text-xs font-medium">Custom time…</SelectItem>
      </SelectContent>
    </Select>
  );
}

/* ── inline date picker ── */
function InlineDatePicker({ value, bookingId, editedBy, onSaved }: {
  value: string; bookingId: string; editedBy: string; onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  useEffect(() => { setLocalValue(value); }, [value]);

  const dateObj = localValue ? parse(localValue, 'yyyy-MM-dd', new Date()) : undefined;

  const save = async (d: Date | undefined) => {
    if (!d) return;
    const ymd = format(d, 'yyyy-MM-dd');
    setOpen(false);
    const prev = localValue;
    setLocalValue(ymd); // optimistic
    const { error } = await supabase.from('intros_booked').update({
      class_date: ymd, last_edited_at: new Date().toISOString(), last_edited_by: editedBy,
    } as any).eq('id', bookingId);
    if (error) {
      toast.error('Save failed');
      setLocalValue(prev);
    } else {
      toast.success('Saved');
      onSaved();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="hover:underline cursor-pointer rounded px-0.5 -mx-0.5 hover:bg-white/10 transition-colors flex items-center gap-0.5"
          style={{ color: 'inherit' }}>
          <CalendarIcon className="w-3 h-3 opacity-60" />
          {localValue ? format(parse(localValue, 'yyyy-MM-dd', new Date()), 'M/d') : '—'}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={dateObj} onSelect={save} initialFocus className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}

export default function IntroCard({
  memberName, classDate, introTime, coachName, leadSource, phone, email,
  vipSessionId, vipClassName, referredBy,
  bookingId, editable = false, editedBy = '', onFieldSaved,
  badges, outcomeBadge, timingInfo, actionButtons, secondaryActions,
  lastContactSummary, topBanner, outcomeBanner, children, className, id, style,
}: IntroCardProps) {
  const canEdit = editable && bookingId && editedBy;
  const refresh = () => onFieldSaved?.();

  // VIP picker state — opens after lead source becomes VIP, or via affordance
  const [vipPickerOpen, setVipPickerOpen] = useState(false);
  const [vipPickerValue, setVipPickerValue] = useState<string>(vipSessionId || '');
  const [localVipClassName, setLocalVipClassName] = useState<string | null>(vipClassName || null);
  const [localVipSessionId, setLocalVipSessionId] = useState<string | null>(vipSessionId || null);
  useEffect(() => { setLocalVipSessionId(vipSessionId || null); setVipPickerValue(vipSessionId || ''); }, [vipSessionId]);
  useEffect(() => { setLocalVipClassName(vipClassName || null); }, [vipClassName]);

  const saveVipSession = useCallback(async (sessionId: string) => {
    if (!bookingId) return;
    // Look up reserved_by_group for vip_class_name sync
    const sb = supabase as any;
    const { data: sess } = await sb
      .from('vip_sessions')
      .select('reserved_by_group, vip_class_name')
      .eq('id', sessionId)
      .maybeSingle();
    const className = sess?.reserved_by_group || sess?.vip_class_name || null;
    const prevId = localVipSessionId;
    const prevName = localVipClassName;
    setLocalVipSessionId(sessionId);
    setLocalVipClassName(className);
    setVipPickerValue(sessionId);
    const { error } = await supabase.from('intros_booked').update({
      vip_session_id: sessionId,
      vip_class_name: className,
      last_edited_at: new Date().toISOString(),
      last_edited_by: editedBy,
    } as any).eq('id', bookingId);
    if (error) {
      toast.error('Failed to link VIP class');
      setLocalVipSessionId(prevId);
      setLocalVipClassName(prevName);
    } else {
      toast.success('VIP class linked');
      onFieldSaved?.();
    }
  }, [bookingId, editedBy, localVipSessionId, localVipClassName, onFieldSaved]);

  // Auto-detect VIP session on mount when card is editable, VIP-source, and not yet linked.
  // Only Tier 1 (registration match) writes silently — Tiers 2/3 are surfaced via the picker.
  const autoDetectAttemptedRef = useRef(false);
  useEffect(() => {
    if (autoDetectAttemptedRef.current) return;
    if (!editable || !bookingId) return;
    if (!isVipSource(leadSource)) return;
    if (localVipSessionId) return;
    autoDetectAttemptedRef.current = true;
    (async () => {
      try {
        const det = await detectVipSessionForBooking({
          member_name: memberName,
          phone,
          email,
          class_date: classDate,
          vip_class_name: localVipClassName,
        });
        if (det.sessionId && det.autoSave) {
          await saveVipSession(det.sessionId);
        }
      } catch { /* silent */ }
    })();
  }, [editable, bookingId, leadSource, localVipSessionId, memberName, phone, email, classDate, localVipClassName, saveVipSession]);

  const handleLeadSourceChanged = useCallback(async (newSource: string) => {
    if (!isVipSource(newSource) || !bookingId) return;
    // Try auto-detect
    const det = await detectVipSessionForBooking({
      member_name: memberName,
      phone,
      email,
      class_date: classDate,
      vip_class_name: localVipClassName,
    });
    if (det.sessionId && det.autoSave) {
      // Tier-1 silent auto-save
      await saveVipSession(det.sessionId);
      return;
    }
    // Pre-select suggestion (if any) and open picker for confirmation
    if (det.sessionId) setVipPickerValue(det.sessionId);
    setVipPickerOpen(true);
  }, [bookingId, memberName, phone, email, classDate, localVipClassName, saveVipSession]);

  // Build meta segments for non-editable mode (phone rendered as PhoneLink so it opens SMS)
  const metaSegments: React.ReactNode[] = [];
  if (!canEdit) {
    if (introTime) metaSegments.push(formatDisplayTime(introTime));
    if (coachName && coachName !== 'TBD') metaSegments.push(coachName);
    if (leadSource) metaSegments.push(leadSource);
    if (phone) {
      const display = formatPhoneDisplay(phone);
      metaSegments.push(
        display
          ? <PhoneLink phone={phone} className="text-inherit no-underline hover:underline" />
          : phone,
      );
    }
  }

  const showVipAffordance = isVipSource(leadSource);

  return (
    <div className={cn('mb-5 rounded-lg border-2 border-black dark:border-white overflow-hidden', className)} id={id} style={style}>
      {/* ── HEADER BAR ── */}
      <div className="px-3 py-2" style={{ background: 'var(--intro-header-bg)' }}>
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Name — always static */}
          <h3 className="text-base font-bold leading-tight shrink-0" style={{ color: 'var(--intro-header-text)' }}>{memberName}</h3>
          {badges}
          {referredBy && (
            <span className="text-[10px] px-1.5 py-0 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 shrink-0 font-medium">
              Referred by {referredBy}
            </span>
          )}

          {/* Editable meta fields inline next to name */}
          {canEdit ? (
            <div className="flex items-center gap-1 text-[11px] flex-wrap" style={{ color: 'var(--intro-header-meta)' }}>
              <span className="opacity-50">·</span>
              <InlineDatePicker value={classDate} bookingId={bookingId!} editedBy={editedBy!} onSaved={refresh} />
              <span className="opacity-50">·</span>
              <InlineTimePicker value={introTime} bookingId={bookingId!} editedBy={editedBy!} onSaved={refresh} />
              <span className="opacity-50">·</span>
              <InlineSelect value={coachName || ''} field="coach_name" bookingId={bookingId!} editedBy={editedBy!} onSaved={refresh}
                options={COACHES} placeholder="Coach" />
              <span className="opacity-50">·</span>
              <InlineSelect value={leadSource || ''} field="lead_source" bookingId={bookingId!} editedBy={editedBy!} onSaved={refresh}
                options={LEAD_SOURCES} placeholder="Source" onAfterSave={handleLeadSourceChanged} />
              {showVipAffordance && (
                <Popover open={vipPickerOpen} onOpenChange={setVipPickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        'text-[10px] px-1.5 py-0 rounded-full border shrink-0 font-medium hover:bg-white/10 transition-colors flex items-center gap-1',
                        localVipSessionId
                          ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40',
                      )}
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      {localVipSessionId
                        ? `VIP class: ${localVipClassName || 'set'}`
                        : 'VIP class not set — pick one'}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-3" align="start">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Which past VIP class did this member come from?
                      </p>
                      <VipSessionPicker
                        value={vipPickerValue}
                        onValueChange={(id) => {
                          setVipPickerValue(id);
                          if (id) {
                            saveVipSession(id);
                            setVipPickerOpen(false);
                          }
                        }}
                        required
                        showWarning={!vipPickerValue}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              {phone !== undefined && (
                <>
                  <span className="opacity-50">·</span>
                  <InlineText value={phone || ''} field="phone" bookingId={bookingId!} editedBy={editedBy!} onSaved={refresh} type="tel" />
                </>
              )}
            </div>
          ) : metaSegments.length > 0 ? (
            <div className="flex items-center gap-1.5 text-[11px] flex-wrap" style={{ color: 'var(--intro-header-meta)' }}>
              {metaSegments.map((seg, i) => (
                <span key={i} className="flex items-center gap-1.5 shrink-0">
                  {i > 0 && <span className="opacity-50">·</span>}
                  <span>{seg}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* ── CARD BODY ── */}
      <div className="bg-card">
        {topBanner}
        {(outcomeBadge || timingInfo) && (
          <div className="flex items-center gap-2 flex-wrap px-4 pt-3">
            {outcomeBadge}
            {timingInfo && <span className="text-xs text-muted-foreground">{timingInfo}</span>}
          </div>
        )}
        <div className="p-4 space-y-3">
          {actionButtons && <div className="flex w-full gap-1.5">{actionButtons}</div>}
          {secondaryActions && <div className="flex w-full">{secondaryActions}</div>}
          {children}
          {lastContactSummary && (
            <div className="text-xs text-muted-foreground pt-1 border-t border-border/50">
              <span className="truncate">{lastContactSummary}</span>
            </div>
          )}
        </div>
        {outcomeBanner}
      </div>
    </div>
  );
}
