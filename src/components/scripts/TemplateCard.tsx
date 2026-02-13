import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Clock, MessageSquare, Send, Trash2 } from 'lucide-react';
import { ScriptTemplate, SCRIPT_CATEGORIES, useUpdateTemplate, useDeleteTemplate } from '@/hooks/useScriptTemplates';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';

interface TemplateCardProps {
  template: ScriptTemplate;
  isAdmin: boolean;
  onClick: () => void;
}

export function TemplateCard({ template, isAdmin, onClick }: TemplateCardProps) {
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const categoryLabel = SCRIPT_CATEGORIES.find(c => c.value === template.category)?.label || template.category;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const onToggleActive = (checked: boolean) => {
    updateTemplate.mutate({ id: template.id, is_active: checked });
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteTemplate.mutateAsync(template.id);
      toast({ title: 'Template deleted' });
    } catch (err: any) {
      toast({ title: 'Error deleting', description: err.message, variant: 'destructive' });
    }
    setConfirmOpen(false);
  };

  return (
    <>
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
            <>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={handleDeleteClick}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
              <Switch
                checked={template.is_active}
                onCheckedChange={onToggleActive}
                className="scale-75"
              />
            </>
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

    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Template</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{template.name}"? This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
