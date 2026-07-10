/**
 * BusinessPartnerCombobox — pick an existing business partner or type a new
 * one to add. Used on the log-a-lead form when source = "Business Partnership
 * Referral". Persists new partners to public.business_partners.
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Partner { id: string; name: string; contact_name: string | null; contact_info: string | null }

interface Props {
  value: string;
  onChange: (name: string) => void;
  /** Called when the picked partner has a stored contact — lets the form
   *  auto-fill the referring-contact field. */
  onContactResolved?: (contact: string | null) => void;
}

export function BusinessPartnerCombobox({ value, onChange, onContactResolved }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('business_partners' as any)
      .select('id, name, contact_name, contact_info')
      .eq('is_active', true)
      .order('name');
    if (!error) setPartners((data || []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter(p => p.name.toLowerCase().includes(q));
  }, [partners, search]);

  const showAddOption =
    search.trim().length >= 2 &&
    !partners.some(p => p.name.toLowerCase() === search.trim().toLowerCase());

  const pick = (p: Partner) => {
    onChange(p.name);
    onContactResolved?.(p.contact_info || null);
    setOpen(false);
    setSearch('');
  };

  const addNew = async () => {
    const name = search.trim();
    if (!name || !user?.name) return;
    setAdding(true);
    try {
      const { data, error } = await supabase
        .from('business_partners' as any)
        .insert({ name, created_by: user.name })
        .select('id, name, contact_name, contact_info')
        .single();
      if (error) throw error;
      const row = data as any as Partner;
      setPartners(prev => [...prev, row].sort((a, b) => a.name.localeCompare(b.name)));
      pick(row);
      toast.success(`Added "${name}" to your partners`);
    } catch (e: any) {
      toast.error(e?.message || 'Could not add partner');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full h-10 justify-between font-normal"
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>
            {value || 'Pick a business partner…'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or type a new business…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading ? (
              <div className="py-4 text-center text-xs text-muted-foreground">Loading…</div>
            ) : (
              <>
                <CommandEmpty>No partners match.</CommandEmpty>
                <CommandGroup>
                  {filtered.map(p => (
                    <CommandItem key={p.id} value={p.name} onSelect={() => pick(p)}>
                      <Check className={cn('mr-2 h-4 w-4', value === p.name ? 'opacity-100' : 'opacity-0')} />
                      <span className="flex-1">{p.name}</span>
                      {p.contact_info && (
                        <span className="text-[10px] text-muted-foreground truncate ml-2 max-w-[40%]">
                          {p.contact_info}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                  {showAddOption && (
                    <CommandItem
                      value={`__add_${search}`}
                      onSelect={addNew}
                      disabled={adding}
                      className="text-primary"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {adding ? 'Adding…' : `Add "${search.trim()}" as a new partner`}
                    </CommandItem>
                  )}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
