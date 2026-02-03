import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { User, Users } from 'lucide-react';
import { ALL_STAFF } from '@/types';

interface EmployeeFilterProps {
  selectedEmployee: string | null;
  onEmployeeChange: (employee: string | null) => void;
  isAdmin: boolean;
}

export function EmployeeFilter({ selectedEmployee, onEmployeeChange, isAdmin }: EmployeeFilterProps) {
  if (!isAdmin) return null;

  return (
    <div className="flex items-center gap-2">
      <Select 
        value={selectedEmployee || 'all'} 
        onValueChange={(v) => onEmployeeChange(v === 'all' ? null : v)}
      >
        <SelectTrigger className="w-40">
          <div className="flex items-center gap-2">
            {selectedEmployee ? (
              <User className="w-4 h-4" />
            ) : (
              <Users className="w-4 h-4" />
            )}
            <SelectValue placeholder="View as..." />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              All Staff
            </span>
          </SelectItem>
          {ALL_STAFF.map(staff => (
            <SelectItem key={staff} value={staff}>
              <span className="flex items-center gap-2">
                <User className="w-4 h-4" />
                {staff}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
