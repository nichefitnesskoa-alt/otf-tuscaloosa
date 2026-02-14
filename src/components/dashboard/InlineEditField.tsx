import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface InlineEditFieldProps {
  value: string;
  displayValue?: string;
  onSave: (value: string) => Promise<void>;
  type?: 'text' | 'time' | 'tel' | 'email';
  options?: { label: string; value: string }[];
  placeholder?: string;
  className?: string;
  /** Show as muted text when not editing */
  muted?: boolean;
}

export function InlineEditField({
  value,
  displayValue,
  onSave,
  type = 'text',
  options,
  placeholder,
  className,
  muted,
}: InlineEditFieldProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = async (newValue: string) => {
    if (newValue === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(newValue);
      setShowCheck(true);
      setTimeout(() => setShowCheck(false), 1500);
      setEditing(false);
    } catch (err) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleBlur = () => {
    if (!saving) handleSave(editValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave(editValue);
    if (e.key === 'Escape') { setEditing(false); setEditValue(value); }
  };

  if (editing) {
    if (options) {
      return (
        <Select
          value={editValue}
          onValueChange={(v) => {
            setEditValue(v);
            handleSave(v);
          }}
        >
          <SelectTrigger className={cn('h-6 text-[11px] w-auto min-w-[80px]', className)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    return (
      <Input
        ref={inputRef}
        type={type}
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn('h-6 text-[11px] px-1.5 w-auto min-w-[60px]', className)}
        disabled={saving}
      />
    );
  }

  return (
    <span
      className={cn(
        'cursor-pointer hover:bg-muted/50 rounded px-0.5 -mx-0.5 transition-colors inline-flex items-center gap-0.5',
        muted && 'text-muted-foreground',
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        setEditValue(value);
        setEditing(true);
      }}
      title="Tap to edit"
    >
      {displayValue || value || placeholder}
      {showCheck && <Check className="w-3 h-3 text-emerald-600 animate-in fade-in" />}
    </span>
  );
}
