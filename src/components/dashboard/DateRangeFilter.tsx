import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { 
  DatePreset, 
  DateRange, 
  getDateRangeForPreset, 
  getPresetLabel,
  formatDateRange 
} from '@/lib/pay-period';

interface DateRangeFilterProps {
  preset: DatePreset;
  customRange: DateRange | undefined;
  onPresetChange: (preset: DatePreset) => void;
  onCustomRangeChange: (range: DateRange) => void;
  dateRange: DateRange;
}

export function DateRangeFilter({
  preset,
  customRange,
  onPresetChange,
  onCustomRangeChange,
  dateRange,
}: DateRangeFilterProps) {
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>(customRange?.start);
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>(customRange?.end);

  const handlePresetSelect = (newPreset: DatePreset) => {
    if (newPreset === 'custom') {
      setIsCustomOpen(true);
      setTempStartDate(dateRange.start);
      setTempEndDate(dateRange.end);
    } else {
      onPresetChange(newPreset);
    }
  };

  const handleApplyCustomRange = () => {
    if (tempStartDate && tempEndDate) {
      onCustomRangeChange({ start: tempStartDate, end: tempEndDate });
      onPresetChange('custom');
      setIsCustomOpen(false);
    }
  };

  const presets: DatePreset[] = ['today', 'this_week', 'pay_period', 'custom'];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            <CalendarIcon className="w-4 h-4 mr-2" />
            {getPresetLabel(preset)}
            <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {presets.map((p) => (
            <DropdownMenuItem
              key={p}
              onClick={() => handlePresetSelect(p)}
              className={cn(preset === p && 'bg-accent')}
            >
              {getPresetLabel(p)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="text-sm text-muted-foreground">
        Viewing: <span className="font-medium text-foreground">{formatDateRange(dateRange)}</span>
      </div>

      {/* Custom Range Popover */}
      <Popover open={isCustomOpen} onOpenChange={setIsCustomOpen}>
        <PopoverTrigger asChild>
          <span className="hidden" />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4" align="start">
          <div className="space-y-4">
            <div className="text-sm font-medium">Select Date Range</div>
            
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Start Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !tempStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {tempStartDate ? format(tempStartDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={tempStartDate}
                      onSelect={setTempStartDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">End Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !tempEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {tempEndDate ? format(tempEndDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={tempEndDate}
                      onSelect={setTempEndDate}
                      disabled={(date) => tempStartDate ? date < tempStartDate : false}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsCustomOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={handleApplyCustomRange}
                disabled={!tempStartDate || !tempEndDate}
                className="flex-1"
              >
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
