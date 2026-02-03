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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { 
  DatePreset, 
  DateRange, 
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
      setTempStartDate(dateRange.start);
      setTempEndDate(dateRange.end);
      setIsCustomOpen(true);
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

  const presets: { preset: DatePreset; group: 'quick' | 'period' | 'year' | 'custom' }[] = [
    { preset: 'all_time', group: 'quick' },
    { preset: 'today', group: 'quick' },
    { preset: 'this_week', group: 'quick' },
    { preset: 'last_week', group: 'quick' },
    { preset: 'this_month', group: 'period' },
    { preset: 'last_month', group: 'period' },
    { preset: 'pay_period', group: 'period' },
    { preset: 'last_pay_period', group: 'period' },
    { preset: 'this_year', group: 'year' },
    { preset: 'last_year', group: 'year' },
    { preset: 'custom', group: 'custom' },
  ];

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
        <DropdownMenuContent align="start" className="w-48">
          {/* Quick */}
          {presets.filter(p => p.group === 'quick').map((p) => (
            <DropdownMenuItem
              key={p.preset}
              onClick={() => handlePresetSelect(p.preset)}
              className={cn(preset === p.preset && 'bg-accent')}
            >
              {getPresetLabel(p.preset)}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {/* Period */}
          {presets.filter(p => p.group === 'period').map((p) => (
            <DropdownMenuItem
              key={p.preset}
              onClick={() => handlePresetSelect(p.preset)}
              className={cn(preset === p.preset && 'bg-accent')}
            >
              {getPresetLabel(p.preset)}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {/* Year */}
          {presets.filter(p => p.group === 'year').map((p) => (
            <DropdownMenuItem
              key={p.preset}
              onClick={() => handlePresetSelect(p.preset)}
              className={cn(preset === p.preset && 'bg-accent')}
            >
              {getPresetLabel(p.preset)}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {/* Custom */}
          {presets.filter(p => p.group === 'custom').map((p) => (
            <DropdownMenuItem
              key={p.preset}
              onClick={() => handlePresetSelect(p.preset)}
              className={cn(preset === p.preset && 'bg-accent')}
            >
              {getPresetLabel(p.preset)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="text-sm text-muted-foreground">
        Viewing: <span className="font-medium text-foreground">
          {preset === 'all_time' ? 'All Time' : formatDateRange(dateRange)}
        </span>
      </div>

      {/* Custom Range Dialog - Using Dialog instead of nested Popovers to fix disappearing issue */}
      <Dialog open={isCustomOpen} onOpenChange={setIsCustomOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Date Range</DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col sm:flex-row gap-4 py-4">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-2 block">Start Date</label>
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

            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-2 block">End Date</label>
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

          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setIsCustomOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleApplyCustomRange}
              disabled={!tempStartDate || !tempEndDate}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
