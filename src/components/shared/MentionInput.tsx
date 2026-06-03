import { useState, useRef, useEffect, useLayoutEffect, useMemo, KeyboardEvent, ChangeEvent } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useActiveStaff } from '@/hooks/useActiveStaff';
import { useActiveOwners } from '@/hooks/useTheTable';
import {
  buildMentionCandidates, filterCandidates, MentionCandidate,
} from '@/lib/table/mentions';

interface Props {
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  variant?: 'textarea' | 'input';
  autoFocus?: boolean;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  /**
   * When this key changes, the internal text is reset to the latest
   * `defaultValue`. Use it to seed the input from a specific record id
   * (e.g. the entry row id) without losing typed text on unrelated re-renders.
   */
  resetKey?: string | number | null;
}

/**
 * Free text input with `@` autocomplete that lists active staff names AND
 * active lane owner roles (e.g. `@IG Owner — Bri`). Picks insert the chosen
 * token verbatim into the text.
 *
 * Always renders the underlying field as a fully controlled input — even
 * when called with `defaultValue`. That prevents React from flipping the
 * field between controlled/uncontrolled when parents re-render from realtime
 * invalidations, which previously wiped in-progress text on Own It.
 */
export function MentionInput({
  defaultValue, value, onChange, onBlur, placeholder, className, disabled,
  variant = 'textarea', autoFocus, onKeyDown, resetKey,
}: Props) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? '');
  const text = isControlled ? (value as string) : internal;

  // Re-seed internal state only when the caller explicitly says the source
  // record changed (resetKey). Re-renders alone never reset.
  const lastResetKey = useRef(resetKey);
  useEffect(() => {
    if (isControlled) return;
    if (lastResetKey.current !== resetKey) {
      lastResetKey.current = resetKey;
      setInternal(defaultValue ?? '');
    }
  }, [resetKey, defaultValue, isControlled]);

  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const [openAt, setOpenAt] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);

  const { staff } = useActiveStaff();
  const { data: owners = [] } = useActiveOwners();

  const candidates: MentionCandidate[] = useMemo(
    () => buildMentionCandidates(staff.map(s => s.name), owners),
    [staff, owners],
  );
  const filtered = useMemo(() => filterCandidates(query, candidates), [query, candidates]);

  const updateMentionState = (next: string, caret: number) => {
    let i = caret - 1;
    while (i >= 0 && /[A-Za-z0-9 ]/.test(next[i])) i--;
    if (i >= 0 && next[i] === '@') {
      const prev = i > 0 ? next[i - 1] : ' ';
      if (/[A-Za-z0-9]/.test(prev)) { setOpenAt(null); return; }
      const q = next.slice(i + 1, caret);
      if (q.length > 30) { setOpenAt(null); return; }
      setOpenAt(i);
      setQuery(q);
      setHighlight(0);
    } else {
      setOpenAt(null);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const next = e.target.value;
    if (!isControlled) setInternal(next);
    onChange?.(next);
    requestAnimationFrame(() => {
      const caret = ref.current?.selectionStart ?? next.length;
      updateMentionState(next, caret);
    });
  };

  const insertCandidate = (c: MentionCandidate) => {
    if (openAt === null) return;
    const before = text.slice(0, openAt);
    const after = text.slice((ref.current?.selectionStart ?? text.length));
    const inserted = '@' + c.token + ' ';
    const next = before + inserted + after;
    if (!isControlled) setInternal(next);
    onChange?.(next);
    setOpenAt(null);
    setQuery('');
    requestAnimationFrame(() => {
      const pos = (before + inserted).length;
      ref.current?.focus();
      ref.current?.setSelectionRange(pos, pos);
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (openAt !== null && filtered.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => (h + 1) % filtered.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => (h - 1 + filtered.length) % filtered.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertCandidate(filtered[highlight]);
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); setOpenAt(null); return; }
    }
    onKeyDown?.(e);
  };

  const Field: any = variant === 'input' ? Input : Textarea;

  // Auto-grow textarea to fit content so the user never scrolls inside a tiny box.
  useLayoutEffect(() => {
    if (variant !== 'textarea') return;
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [text, variant, resetKey]);

  return (
    <div className="relative">
      <Field
        ref={ref as any}
        value={text}
        onChange={handleChange}
        onBlur={(e: any) => { setTimeout(() => setOpenAt(null), 150); onBlur?.(e); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(variant === 'textarea' && 'resize-none overflow-hidden', className)}
        disabled={disabled}
        autoFocus={autoFocus}
      />

      {openAt !== null && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-w-sm rounded-md border bg-popover shadow-lg">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground border-b">
            Tag a person or role
          </div>
          {filtered.map((c, i) => (
            <button
              key={c.token + '|' + c.resolvedName}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insertCandidate(c); }}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                'w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2',
                i === highlight && 'bg-accent',
              )}
            >
              <span className="font-medium text-[#E8540A]">@{c.token}</span>
              {c.lane && <span className="text-xs text-muted-foreground">→ {c.resolvedName}</span>}
              {!c.lane && <span className="text-[10px] uppercase text-muted-foreground">name</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
