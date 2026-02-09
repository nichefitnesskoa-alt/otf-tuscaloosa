import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { AlertTriangle, Loader2, Plus, Calendar, MapPin, User } from 'lucide-react';
import { useDuplicateDetection, PotentialMatch } from '@/hooks/useDuplicateDetection';
import { format } from 'date-fns';

interface ClientNameAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectExisting: (client: PotentialMatch) => void;
  onCreateNew?: () => void;
  disabled?: boolean;
}

function getStatusBadgeVariant(status: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (!status) return 'secondary';
  const upperStatus = status.toUpperCase();
  
  if (upperStatus.includes('ACTIVE')) return 'default';
  if (upperStatus.includes('2ND INTRO')) return 'default';
  if (upperStatus.includes('NO-SHOW') || upperStatus.includes('NO SHOW')) return 'destructive';
  if (upperStatus.includes('NOT INTERESTED')) return 'secondary';
  return 'outline';
}

function getStatusDisplayText(status: string | null): string {
  if (!status) return 'Unknown';
  const upperStatus = status.toUpperCase();
  
  if (upperStatus.includes('ACTIVE')) return 'Active';
  if (upperStatus.includes('2ND INTRO')) return '2nd Intro';
  if (upperStatus.includes('NO-SHOW') || upperStatus.includes('NO SHOW')) return 'No-show';
  if (upperStatus.includes('NOT INTERESTED')) return 'Not interested';
  return status;
}

function shouldShowWarningIcon(status: string | null): boolean {
  if (!status) return false;
  const upperStatus = status.toUpperCase();
  return upperStatus.includes('NO-SHOW') || 
         upperStatus.includes('NO SHOW') || 
         upperStatus.includes('NOT INTERESTED');
}

export default function ClientNameAutocomplete({
  value,
  onChange,
  onSelectExisting,
  onCreateNew,
  disabled = false,
}: ClientNameAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const { checkForDuplicates, isChecking, matches, clearMatches } = useDuplicateDetection();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!value || value.trim().length < 2) {
      clearMatches();
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      await checkForDuplicates(value);
      setOpen(true);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, checkForDuplicates, clearMatches]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  const handleSelectClient = useCallback((client: PotentialMatch) => {
    setOpen(false);
    onSelectExisting(client);
  }, [onSelectExisting]);

  const handleCreateNew = useCallback(() => {
    setOpen(false);
    onCreateNew?.();
  }, [onCreateNew]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
    }
  }, []);

  const showDropdown = open && value.trim().length >= 2 && (matches.length > 0 || isChecking);

  return (
    <Popover open={showDropdown} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            ref={inputRef}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (value.trim().length >= 2 && matches.length > 0) {
                setOpen(true);
              }
            }}
            className="pr-8"
            placeholder="Full name"
            disabled={disabled}
            autoComplete="off"
          />
          {isChecking && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-0 z-50" 
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList>
            {isChecking && matches.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
                Searching...
              </div>
            ) : matches.length === 0 ? (
              <CommandEmpty>No existing clients found</CommandEmpty>
            ) : (
              <CommandGroup heading="Existing Clients">
                {matches.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={client.id}
                    onSelect={() => handleSelectClient(client)}
                    className="flex flex-col items-start gap-1 py-2.5 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span className="font-medium">{client.member_name}</span>
                      {shouldShowWarningIcon(client.booking_status) && (
                        <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                      )}
                      <Badge 
                        variant={getStatusBadgeVariant(client.booking_status)}
                        className="ml-auto text-xs py-0 px-1.5"
                      >
                        {getStatusDisplayText(client.booking_status)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(client.class_date), 'MMM d, yyyy')}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {client.lead_source}
                      </span>
                      {client.booked_by && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {client.booked_by}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            
            <CommandSeparator />
            
            <CommandGroup>
              <CommandItem
                onSelect={handleCreateNew}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create "{value}" as new client</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
