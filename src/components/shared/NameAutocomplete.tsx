import { useState, useRef, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Suggestion {
  name: string;
  source: 'Member' | 'Lead' | 'IG Lead';
}

interface NameAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  autoFocus?: boolean;
}

export function NameAutocomplete({
  value,
  onChange,
  placeholder = 'Name',
  className,
  disabled,
  id,
  autoFocus,
}: NameAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(async (term: string) => {
    if (term.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const pattern = `%${term}%`;

    const [membersRes, leadsRes, igRes] = await Promise.all([
      supabase
        .from('intros_booked')
        .select('member_name')
        .ilike('member_name', pattern)
        .is('deleted_at', null)
        .limit(20),
      supabase
        .from('leads')
        .select('first_name, last_name')
        .or(`first_name.ilike.${pattern},last_name.ilike.${pattern}`)
        .limit(20),
      supabase
        .from('ig_leads')
        .select('first_name, last_name')
        .or(`first_name.ilike.${pattern},last_name.ilike.${pattern}`)
        .limit(20),
    ]);

    const seen = new Set<string>();
    const results: Suggestion[] = [];

    const addUnique = (name: string, source: Suggestion['source']) => {
      const key = name.toLowerCase().trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      results.push({ name: name.trim(), source });
    };

    membersRes.data?.forEach((r: any) => addUnique(r.member_name, 'Member'));
    leadsRes.data?.forEach((r: any) => addUnique(`${r.first_name} ${r.last_name}`.trim(), 'Lead'));
    igRes.data?.forEach((r: any) => addUnique(`${r.first_name}${r.last_name ? ' ' + r.last_name : ''}`.trim(), 'IG Lead'));

    setSuggestions(results);
    setOpen(results.length > 0);
    setLoading(false);
  }, []);

  const handleChange = useCallback((newValue: string) => {
    onChange(newValue);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(newValue), 300);
  }, [onChange, search]);

  const handleSelect = useCallback((name: string) => {
    onChange(name);
    setOpen(false);
    setSuggestions([]);
    inputRef.current?.focus();
  }, [onChange]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const badgeColor = (source: Suggestion['source']) => {
    switch (source) {
      case 'Member': return 'bg-primary/10 text-primary border-primary/20';
      case 'Lead': return 'bg-blue-500/10 text-blue-700 border-blue-200';
      case 'IG Lead': return 'bg-purple-500/10 text-purple-700 border-purple-200';
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Input
          ref={inputRef}
          id={id}
          value={value}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={placeholder}
          className={className}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
        />
      </PopoverTrigger>
      {open && suggestions.length > 0 && (
        <PopoverContent
          className="p-1 w-[var(--radix-popover-trigger-width)] max-h-48 overflow-y-auto"
          align="start"
          sideOffset={4}
          onOpenAutoFocus={e => e.preventDefault()}
        >
          {suggestions.map((s, i) => (
            <button
              key={`${s.name}-${i}`}
              type="button"
              className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
              onMouseDown={e => { e.preventDefault(); handleSelect(s.name); }}
            >
              <span>{s.name}</span>
              <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', badgeColor(s.source))}>
                {s.source}
              </Badge>
            </button>
          ))}
        </PopoverContent>
      )}
    </Popover>
  );
}
