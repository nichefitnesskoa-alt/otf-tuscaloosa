/**
 * Inline outcome drawer for intro cards on MyDay.
 * Routes through canonical applyIntroOutcomeUpdate. No duplicate logic.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { applyIntroOutcomeUpdate } from '@/lib/domain/outcomes/applyIntroOutcomeUpdate';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const OUTCOME_OPTIONS = [
  { value: 'Sold - Unlimited', label: '✅ Sold – Unlimited' },
  { value: 'Sold - Premier', label: '✅ Sold – Premier' },
  { value: 'Sold - Basic', label: '✅ Sold – Basic' },
  { value: "Didn't Buy", label: "❌ Didn't Buy" },
  { value: 'No-show', label: '👻 No-show' },
  { value: 'Not interested', label: '🚫 Not interested' },
  { value: 'Second Intro Scheduled', label: '🔄 2nd Intro Scheduled' },
];

const OBJECTION_OPTIONS = [
  'Price',
  'Time / Schedule',
  'Spouse / Family',
  'Thinking About It',
  'Already a Member',
  'Health / Injury',
  'Travel / Moving',
  'Other',
];

interface OutcomeDrawerProps {
  bookingId: string;
  memberName: string;
  classDate: string;
  leadSource?: string;
  existingRunId?: string | null;
  currentResult?: string | null;
  editedBy: string;
  onSaved: () => void;
  onCancel: () => void;
}

export function OutcomeDrawer({
  bookingId,
  memberName,
  classDate,
  leadSource,
  existingRunId,
  currentResult,
  editedBy,
  onSaved,
  onCancel,
}: OutcomeDrawerProps) {
  const [outcome, setOutcome] = useState(currentResult || '');
  const [objection, setObjection] = useState('');
  const [commission, setCommission] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const isSale = outcome.toLowerCase().includes('sold');
  const needsObjection = outcome === "Didn't Buy" || outcome === 'No-show';

  const handleSave = async () => {
    if (!outcome) { toast.error('Select an outcome'); return; }
    setSaving(true);
    try {
      const result = await applyIntroOutcomeUpdate({
        bookingId,
        memberName,
        classDate,
        newResult: outcome,
        previousResult: currentResult || null,
        membershipType: isSale ? outcome : undefined,
        commissionAmount: commission ? parseFloat(commission) : undefined,
        leadSource: leadSource || '',
        objection: needsObjection ? objection : null,
        editedBy,
        sourceComponent: 'MyDay-OutcomeDrawer',
        editReason: notes || undefined,
        runId: existingRunId || undefined,
      });
      if (result.success) {
        toast.success('Outcome saved');
        onSaved();
      } else {
        toast.error(result.error || 'Failed to save outcome');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t bg-muted/30 p-3 space-y-3 rounded-b-lg">
      <div className="space-y-1">
        <Label className="text-xs">Outcome</Label>
        <Select value={outcome} onValueChange={setOutcome}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select outcome…" />
          </SelectTrigger>
          <SelectContent>
            {OUTCOME_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {needsObjection && (
        <div className="space-y-1">
          <Label className="text-xs">Primary Objection</Label>
          <Select value={objection} onValueChange={setObjection}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select objection…" />
            </SelectTrigger>
            <SelectContent>
              {OBJECTION_OPTIONS.map(o => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isSale && (
        <div className="space-y-1">
          <Label className="text-xs">Commission ($)</Label>
          <Input
            type="number"
            value={commission}
            onChange={e => setCommission(e.target.value)}
            placeholder="0.00"
            className="h-8 text-sm"
          />
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs">Notes (optional)</Label>
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any additional notes…"
          className="text-sm min-h-[56px] resize-none"
        />
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 h-8"
          onClick={handleSave}
          disabled={saving || !outcome}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
          Save Outcome
        </Button>
        <Button size="sm" variant="ghost" className="h-8" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
