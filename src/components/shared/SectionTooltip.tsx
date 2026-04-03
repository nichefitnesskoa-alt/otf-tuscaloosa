import { Info } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface SectionTooltipProps {
  text: string;
}

export function SectionTooltip({ text }: SectionTooltipProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label="Section info"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="text-xs max-w-[220px] p-3 bg-foreground text-background rounded-md border-0 shadow-lg"
      >
        {text}
      </PopoverContent>
    </Popover>
  );
}
