/**
 * Shared IntroCard component — unified visual language for all intro/follow-up cards.
 *
 * Supports inline-editable header fields when `editable` is true.
 */
import { ReactNode, useState, useRef, useEffect } from 'react';
import { format, parse } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatDisplayTime } from '@/lib/time/timeUtils';
import { formatPhoneDisplay } from '@/lib/parsing/phone';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { COACHES, LEAD_SOURCES, CLASS_TIMES, CLASS_TIME_LABELS } from '@/types';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { CalendarIcon } from 'lucide-react';

export interface IntroCardProps {
  memberName: string;
  classDate: string;
  introTime: string | null;
  coachName: string | null;
  leadSource: string | null;
  phone: string | null;

  /** Inline editing support */
  bookingId?: string;
  editable?: boolean;
  editedBy?: string;
  onFieldSaved?: () => void;

  badges?: ReactNode;
  outcomeBadge?: ReactNode;
  timingInfo?: ReactNode;
  actionButtons: ReactNode;
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
  const [val, setVal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const save = async () => {
    setEditing(false);
    if (val === value) return;
    const { error } = await supabase.from('intros_booked').update({
      [field]: val, last_edited_at: new Date().toISOString(), last_edited_by: editedBy,
    } as any).eq('id', bookingId);
    if (error) { toast.error('Save failed'); setVal(value); } else { toast.success('Saved'); onSaved(); }
  };

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)}
        className="hover:underline cursor-pointer rounded px-0.5 -mx-0.5 hover:bg-white/10 transition-colors truncate max-w-[120px]"
        style={{ color: 'inherit' }}>
        {value || '—'}
      </button>
    );
  }
  return (
    <Input ref={ref} type={type} value={val} onChange={e => setVal(e.target.value)}
      onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setVal(value); setEditing(false); } }}
      className="h-5 text-[11px] w-24 px-1 py-0 bg-background text-foreground border rounded" />
  );
}

/* ── inline select ── */
function InlineSelect({ value, field, bookingId, editedBy, onSaved, options, placeholder }: {
  value: string; field: string; bookingId: string; editedBy: string; onSaved: () => void;
  options: readonly string[]; placeholder?: string;
}) {
  const save = async (val: string) => {
    const { error } = await supabase.from('intros_booked').update({
      [field]: val, last_edited_at: new Date().toISOString(), last_edited_by: editedBy,
    } as any).eq('id', bookingId);
    if (error) toast.error('Save failed'); else { toast.success('Saved'); onSaved(); }
  };

  return (
    <Select value={value || ''} onValueChange={save}>
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
  const [customMode, setCustomMode] = useState(false);
  const [customVal, setCustomVal] = useState(value || '');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (customMode) ref.current?.focus(); }, [customMode]);

  const save = async (val: string) => {
    const { error } = await supabase.from('intros_booked').update({
      intro_time: val, last_edited_at: new Date().toISOString(), last_edited_by: editedBy,
    } as any).eq('id', bookingId);
    if (error) toast.error('Save failed'); else { toast.success('Saved'); onSaved(); }
  };

  const handleSelect = (val: string) => {
    if (val === '__custom__') { setCustomMode(true); return; }
    setCustomMode(false);
    save(val);
  };

  const handleCustomBlur = () => {
    setCustomMode(false);
    if (customVal && customVal !== value) save(customVal);
  };

  if (customMode) {
    return (
      <Input ref={ref} type="time" value={customVal} onChange={e => setCustomVal(e.target.value)}
        onBlur={handleCustomBlur} onKeyDown={e => { if (e.key === 'Enter') handleCustomBlur(); if (e.key === 'Escape') setCustomMode(false); }}
        className="h-5 text-[11px] w-20 px-1 py-0 bg-background text-foreground border rounded" />
    );
  }

  const display = value ? (CLASS_TIME_LABELS[value] || formatDisplayTime(value)) : '—';

  return (
    <Select value={value || ''} onValueChange={handleSelect}>
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
  const dateObj = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;

  const save = async (d: Date | undefined) => {
    if (!d) return;
    const ymd = format(d, 'yyyy-MM-dd');
    setOpen(false);
    const { error } = await supabase.from('intros_booked').update({
      class_date: ymd, last_edited_at: new Date().toISOString(), last_edited_by: editedBy,
    } as any).eq('id', bookingId);
    if (error) toast.error('Save failed'); else { toast.success('Saved'); onSaved(); }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="hover:underline cursor-pointer rounded px-0.5 -mx-0.5 hover:bg-white/10 transition-colors flex items-center gap-0.5"
          style={{ color: 'inherit' }}>
          <CalendarIcon className="w-3 h-3 opacity-60" />
          {value ? format(parse(value, 'yyyy-MM-dd', new Date()), 'M/d') : '—'}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={dateObj} onSelect={save} initialFocus className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}

export default function IntroCard({
  memberName, classDate, introTime, coachName, leadSource, phone,
  bookingId, editable = false, editedBy = '', onFieldSaved,
  badges, outcomeBadge, timingInfo, actionButtons, secondaryActions,
  lastContactSummary, topBanner, outcomeBanner, children, className, id, style,
}: IntroCardProps) {
  const canEdit = editable && bookingId && editedBy;
  const refresh = () => onFieldSaved?.();

  // Build meta segments for non-editable mode
  const metaSegments: string[] = [];
  if (!canEdit) {
    if (introTime) metaSegments.push(formatDisplayTime(introTime));
    if (coachName && coachName !== 'TBD') metaSegments.push(coachName);
    if (leadSource) metaSegments.push(leadSource);
    if (phone) metaSegments.push(formatPhoneDisplay(phone) || phone);
  }

  return (
    <div className={cn('mb-5 rounded-lg border-2 border-black dark:border-white overflow-hidden', className)} id={id} style={style}>
      {/* ── HEADER BAR ── */}
      <div className="px-3 py-2" style={{ background: 'var(--intro-header-bg)' }}>
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Name — always static */}
          <h3 className="text-base font-bold leading-tight shrink-0" style={{ color: 'var(--intro-header-text)' }}>{memberName}</h3>
          {badges}

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
                options={LEAD_SOURCES} placeholder="Source" />
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
          <div className="flex w-full gap-1.5">{actionButtons}</div>
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
