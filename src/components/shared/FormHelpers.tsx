/**
 * Shared form helper components — reusable across all forms/modals.
 * ClassTimeSelect, DatePickerField, auto-format helpers.
 */
import { useState } from 'react';
import { format, parse } from 'date-fns';
import { cn } from '@/lib/utils';
import { CLASS_TIMES, CLASS_TIME_LABELS } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';

/* ── Class Time Select ── */
interface ClassTimeSelectProps {
  value: string;
  onValueChange: (val: string) => void;
  className?: string;
  triggerClassName?: string;
  placeholder?: string;
}

export function ClassTimeSelect({ value, onValueChange, className, triggerClassName, placeholder = 'Select time...' }: ClassTimeSelectProps) {
  const [customMode, setCustomMode] = useState(false);
  const [customVal, setCustomVal] = useState(value);

  if (customMode) {
    return (
      <Input
        type="time"
        value={customVal}
        onChange={e => setCustomVal(e.target.value)}
        onBlur={() => {
          setCustomMode(false);
          if (customVal) onValueChange(customVal);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') { setCustomMode(false); if (customVal) onValueChange(customVal); }
          if (e.key === 'Escape') setCustomMode(false);
        }}
        autoFocus
        className={cn('h-10', triggerClassName)}
      />
    );
  }

  const handleChange = (val: string) => {
    if (val === '__custom__') {
      setCustomVal(value);
      setCustomMode(true);
      return;
    }
    onValueChange(val);
  };

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className={cn(triggerClassName)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={cn('max-h-60', className)}>
        {CLASS_TIMES.map(t => (
          <SelectItem key={t} value={t}>{CLASS_TIME_LABELS[t]}</SelectItem>
        ))}
        <SelectItem value="__custom__" className="font-medium">Custom time…</SelectItem>
      </SelectContent>
    </Select>
  );
}

/* ── Date Picker Field ── */
interface DatePickerFieldProps {
  value: string; // yyyy-MM-dd
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
  disablePast?: boolean;
}

export function DatePickerField({ value, onChange, className, placeholder = 'Pick a date', disablePast = false }: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const dateObj = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn('w-full justify-start text-left font-normal', !value && 'text-muted-foreground', className)}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(parse(value, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateObj}
          onSelect={(d) => {
            if (d) {
              onChange(format(d, 'yyyy-MM-dd'));
              setOpen(false);
            }
          }}
          initialFocus
          className="p-3 pointer-events-auto"
          disabled={disablePast ? (d) => d < new Date(new Date().setHours(0, 0, 0, 0)) : undefined}
        />
      </PopoverContent>
    </Popover>
  );
}

/* ── Phone auto-format ── */
export function formatPhoneAsYouType(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  // Strip leading 1 for US numbers
  const d = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits;
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
}

/* ── Name auto-capitalize ── */
export function autoCapitalizeName(name: string): string {
  return name.replace(/\b\w/g, c => c.toUpperCase());
}
