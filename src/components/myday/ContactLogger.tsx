/**
 * Compact contact logger: search a person, tap Texted/Called/VM.
 * Logs to followup_touches. No automated messaging.
 */
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, MessageSquare, Voicemail, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { logTouch } from '@/lib/touchLog';
import { useData } from '@/context/DataContext';

interface ContactLoggerProps {
  userName: string;
}

export function ContactLogger({ userName }: ContactLoggerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState('');
  const [notes, setNotes] = useState('');
  const { introsBooked } = useData();

  const options = useMemo(() => {
    if (!search || search.length < 2) return [];
    const lower = search.toLowerCase();
    return introsBooked
      .filter(b => !b.deleted_at && b.member_name.toLowerCase().includes(lower))
      .slice(0, 8)
      .map(b => ({ id: b.id, name: b.member_name, date: b.class_date }));
  }, [search, introsBooked]);

  const handleSelect = (id: string, name: string) => {
    setSelectedId(id);
    setSelectedName(name);
    setSearch(name);
    // clear options by collapsing the dropdown
  };

  const logAction = async (touchType: 'text_manual' | 'call' | 'dm_manual') => {
    if (!selectedId && !search) {
      toast.error('Select a person first');
      return;
    }
    const labelMap = { text_manual: 'Texted', call: 'Called', dm_manual: 'VM left' };
    await logTouch({
      createdBy: userName,
      touchType,
      bookingId: selectedId || null,
      channel: touchType === 'text_manual' ? 'sms' : touchType === 'call' ? 'call' : 'voicemail',
      notes: notes || null,
    });
    toast.success(`${labelMap[touchType]}: ${selectedName || search}`);
    setSelectedId(null);
    setSelectedName('');
    setSearch('');
    setNotes('');
  };

  return (
    <div className="rounded-lg border bg-card">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium"
        onClick={() => setOpen(v => !v)}
      >
        <span className="flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-muted-foreground" />
          Log a Contact
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {/* Person search */}
          <div className="relative">
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setSelectedId(null); setSelectedName(''); }}
              placeholder="Search name…"
              className="h-8 text-sm"
            />
            {options.length > 0 && !selectedId && (
              <div className="absolute z-50 top-9 left-0 right-0 bg-popover border rounded-md shadow-md overflow-hidden">
                {options.map(o => (
                  <button
                    key={o.id}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center justify-between"
                    onClick={() => handleSelect(o.id, o.name)}
                  >
                    <span>{o.name}</span>
                    <span className="text-[10px] text-muted-foreground">{o.date}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Optional notes */}
          <Input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="h-7 text-xs"
          />

          {/* Action buttons */}
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="h-7 flex-1 text-xs gap-1" onClick={() => logAction('text_manual')}>
              <MessageSquare className="w-3 h-3" /> Texted
            </Button>
            <Button size="sm" variant="outline" className="h-7 flex-1 text-xs gap-1" onClick={() => logAction('call')}>
              <Phone className="w-3 h-3" /> Called
            </Button>
            <Button size="sm" variant="outline" className="h-7 flex-1 text-xs gap-1" onClick={() => logAction('dm_manual')}>
              <Voicemail className="w-3 h-3" /> VM
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
