import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { SCRIPT_CATEGORIES } from '@/hooks/useScriptTemplates';

interface TemplateCategoryTabsProps {
  selected: string;
  onSelect: (category: string) => void;
}

export function TemplateCategoryTabs({ selected, onSelect }: TemplateCategoryTabsProps) {
  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-2 pb-2">
        <button
          onClick={() => onSelect('')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0',
            !selected
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          All
        </button>
        {SCRIPT_CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => onSelect(cat.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0',
              selected === cat.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
