import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Clock, MessageSquare, Send } from 'lucide-react';
import { ScriptTemplate, SCRIPT_CATEGORIES, useUpdateTemplate } from '@/hooks/useScriptTemplates';

interface TemplateCardProps {
  template: ScriptTemplate;
  isAdmin: boolean;
  onClick: () => void;
}

export function TemplateCard({ template, isAdmin, onClick }: TemplateCardProps) {
  const updateTemplate = useUpdateTemplate();
  const categoryLabel = SCRIPT_CATEGORIES.find(c => c.value === template.category)?.label || template.category;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const onToggleActive = (checked: boolean) => {
    updateTemplate.mutate({ id: template.id, is_active: checked });
  };

  return (
    <div
      onClick={onClick}
      className="rounded-lg border bg-card p-3 cursor-pointer hover:shadow-md transition-all space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{template.name}</p>
          <p className="text-xs text-muted-foreground">{categoryLabel}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0" onClick={handleToggle}>
          {isAdmin && (
            <Switch
              checked={template.is_active}
              onCheckedChange={onToggleActive}
              className="scale-75"
            />
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
          {template.channel === 'sms' ? (
            <><Send className="w-2.5 h-2.5 mr-0.5" /> SMS</>
          ) : (
            <><MessageSquare className="w-2.5 h-2.5 mr-0.5" /> DM</>
          )}
        </Badge>
        {template.sequence_order && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            Step {template.sequence_order}
          </Badge>
        )}
        {template.variant_label && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            {template.variant_label}
          </Badge>
        )}
        {!template.is_active && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
            Inactive
          </Badge>
        )}
      </div>

      {template.timing_note && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" /> {template.timing_note}
        </p>
      )}
    </div>
  );
}
