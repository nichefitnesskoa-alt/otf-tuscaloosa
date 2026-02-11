import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MergeFieldReference } from './MergeFieldReference';
import { ScriptTemplate, SCRIPT_CATEGORIES, useCreateTemplate, useUpdateTemplate, useDeleteTemplate, useSharedStepUsage } from '@/hooks/useScriptTemplates';
import { toast } from '@/hooks/use-toast';
import { Trash2 } from 'lucide-react';

interface TemplateEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ScriptTemplate | null; // null = create mode
}

export function TemplateEditor({ open, onOpenChange, template }: TemplateEditorProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('booking_confirmation');
  const [channel, setChannel] = useState('sms');
  const [sequenceOrder, setSequenceOrder] = useState('');
  const [variantLabel, setVariantLabel] = useState('');
  const [timingNote, setTimingNote] = useState('');
  const [body, setBody] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSharedStep, setIsSharedStep] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const { data: sharedUsage } = useSharedStepUsage(template?.is_shared_step ? template.id : undefined);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setCategory(template.category);
      setChannel(template.channel);
      setSequenceOrder(template.sequence_order?.toString() || '');
      setVariantLabel(template.variant_label || '');
      setTimingNote(template.timing_note || '');
      setBody(template.body);
      setIsActive(template.is_active);
      setIsSharedStep(template.is_shared_step);
    } else {
      setName('');
      setCategory('booking_confirmation');
      setChannel('sms');
      setSequenceOrder('');
      setVariantLabel('');
      setTimingNote('');
      setBody('');
      setIsActive(true);
      setIsSharedStep(false);
    }
  }, [template, open]);

  const handleInsertField = (field: string) => {
    const el = bodyRef.current;
    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newBody = body.substring(0, start) + field + body.substring(end);
      setBody(newBody);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + field.length, start + field.length);
      }, 0);
    } else {
      setBody(body + field);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !body.trim()) {
      toast({ title: 'Name and message body are required', variant: 'destructive' });
      return;
    }

    const payload = {
      name: name.trim(),
      category,
      channel,
      sequence_order: sequenceOrder ? parseInt(sequenceOrder) : null,
      variant_label: variantLabel.trim() || null,
      timing_note: timingNote.trim() || null,
      body: body.trim(),
      is_active: isActive,
      is_shared_step: isSharedStep,
    };

    try {
      if (template) {
        await updateTemplate.mutateAsync({ id: template.id, ...payload });
        toast({ title: 'Template updated' });
      } else {
        await createTemplate.mutateAsync({ ...payload, shared_step_id: null });
        toast({ title: 'Template created' });
      }
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Error saving template', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!template) return;
    try {
      await deleteTemplate.mutateAsync(template.id);
      toast({ title: 'Template deleted' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Error deleting', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit Template' : 'New Template'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Template Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" placeholder="e.g. 1A: Booking Confirmation" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCRIPT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Channel</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="dm">DM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Sequence Order</Label>
              <Input type="number" min="1" value={sequenceOrder} onChange={(e) => setSequenceOrder(e.target.value)} className="mt-1" placeholder="e.g. 1" />
            </div>
            <div>
              <Label className="text-xs">Variant Label</Label>
              <Input value={variantLabel} onChange={(e) => setVariantLabel(e.target.value)} className="mt-1" placeholder="e.g. Price Objection" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Timing Note</Label>
            <Input value={timingNote} onChange={(e) => setTimingNote(e.target.value)} className="mt-1" placeholder="e.g. Send 24-48 hours later" />
          </div>

          <div>
            <Label className="text-xs">Message Body *</Label>
            <Textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-1 min-h-[120px] font-mono text-sm"
              placeholder="Type your message template here..."
            />
          </div>

          <MergeFieldReference onInsert={handleInsertField} />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label className="text-xs">Active</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isSharedStep} onCheckedChange={setIsSharedStep} />
              <Label className="text-xs">Shared Step</Label>
            </div>
          </div>

          {isSharedStep && sharedUsage && sharedUsage.length > 0 && (
            <div className="rounded-lg border border-warning bg-warning/10 p-3 text-xs">
              <p className="font-semibold text-warning-foreground">
                ⚠️ This step is shared across {sharedUsage.length} sequence(s). Changes will apply to all:
              </p>
              <ul className="list-disc list-inside mt-1 text-muted-foreground">
                {sharedUsage.map((s) => (
                  <li key={s.id}>{s.name}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} className="flex-1">Save</Button>
            {template && (
              <Button variant="destructive" size="icon" onClick={handleDelete}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
