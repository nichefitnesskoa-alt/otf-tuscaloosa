import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';

const LEAD_SOURCES = [
  'Winback',
  'Upgrade',
  'Walk in',
  'Referral',
] as const;

const MEMBERSHIP_TYPES = [
  { label: 'Premier + OTBeat', commission: 15.00 },
  { label: 'Premier w/o OTBeat', commission: 7.50 },
  { label: 'Elite + OTBeat', commission: 12.00 },
  { label: 'Elite w/o OTBeat', commission: 6.00 },
  { label: 'Basic + OTBeat', commission: 9.00 },
  { label: 'Basic w/o OTBeat', commission: 3.00 },
] as const;

export interface SaleData {
  id: string;
  memberName: string;
  leadSource: string;
  membershipType: string;
  commissionAmount: number;
}

interface SaleEntryProps {
  sale: SaleData;
  index: number;
  onUpdate: (index: number, updates: Partial<SaleData>) => void;
  onRemove: (index: number) => void;
}

export default function SaleEntry({ sale, index, onUpdate, onRemove }: SaleEntryProps) {
  const handleMembershipChange = (value: string) => {
    const membership = MEMBERSHIP_TYPES.find(m => m.label === value);
    onUpdate(index, { 
      membershipType: value,
      commissionAmount: membership?.commission || 0
    });
  };

  return (
    <div className="p-3 bg-muted/50 rounded-lg space-y-3 relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6"
        onClick={() => onRemove(index)}
      >
        <Trash2 className="w-3.5 h-3.5 text-destructive" />
      </Button>

      <div>
        <Label className="text-xs">Member Name *</Label>
        <Input
          value={sale.memberName}
          onChange={(e) => onUpdate(index, { memberName: e.target.value })}
          className="mt-1"
          placeholder="Full name"
        />
      </div>

      <div>
        <Label className="text-xs">Lead Source *</Label>
        <Select
          value={sale.leadSource}
          onValueChange={(v) => onUpdate(index, { leadSource: v })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select source..." />
          </SelectTrigger>
          <SelectContent>
            {LEAD_SOURCES.map((source) => (
              <SelectItem key={source} value={source}>{source}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">Membership Type *</Label>
        <Select
          value={sale.membershipType}
          onValueChange={handleMembershipChange}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select membership..." />
          </SelectTrigger>
          <SelectContent>
            {MEMBERSHIP_TYPES.map((type) => (
              <SelectItem key={type.label} value={type.label}>
                {type.label} (${type.commission.toFixed(2)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {sale.commissionAmount > 0 && (
        <div className="p-2 bg-success/10 rounded text-center">
          <span className="text-sm font-medium text-success">
            Commission: ${sale.commissionAmount.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}
