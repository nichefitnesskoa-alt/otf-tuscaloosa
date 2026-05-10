import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useActiveStaff } from '@/hooks/useActiveStaff';
import { useActiveOwners } from '@/hooks/useTheTable';
import { supabase } from '@/integrations/supabase/client';
import { LANE_SUGGESTIONS, LANE_CATEGORIES } from '@/lib/table/laneSuggestions';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

export function ManageOwnersDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { staff } = useActiveStaff();
  const { data: owners = [] } = useActiveOwners();
  const qc = useQueryClient();
  const [addingId, setAddingId] = useState('');

  const refresh = () => qc.invalidateQueries({ queryKey: ['table-owners'] });

  const addOwner = async () => {
    if (!addingId) return;
    const s = staff.find(x => x.id === addingId);
    if (!s) return;
    const { error } = await supabase.from('table_owners').insert({
      staff_id: s.id, display_name: s.name, is_active: true, created_by: 'admin',
    });
    if (error) { toast.error(error.message); return; }
    setAddingId('');
    refresh();
  };

  const updateOwner = async (id: string, patch: Partial<{ lane_name: string; category: string; is_active: boolean }>) => {
    await supabase.from('table_owners').update(patch).eq('id', id);
    refresh();
  };

  const removeOwner = async (id: string) => {
    await supabase.from('table_owners').update({ is_active: false }).eq('id', id);
    refresh();
  };

  const availableStaff = staff.filter(s => !owners.some(o => o.staff_id === s.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Manage Owners</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs font-medium mb-1 block">Add an Owner</label>
              <Select value={addingId} onValueChange={setAddingId}>
                <SelectTrigger><SelectValue placeholder="Pick a staff member" /></SelectTrigger>
                <SelectContent>
                  {availableStaff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addOwner} disabled={!addingId} className="bg-[#E8540A] hover:bg-[#E8540A]/90">
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>

          <div className="space-y-2">
            {owners.map(o => (
              <div key={o.id} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{o.display_name}</div>
                  <Button variant="ghost" size="sm" onClick={() => removeOwner(o.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Lane name</label>
                    <Input
                      defaultValue={o.lane_name ?? ''}
                      onBlur={(e) => updateOwner(o.id, { lane_name: e.target.value })}
                      placeholder="e.g. IG Owner"
                      list={`lanes-${o.id}`}
                    />
                    <datalist id={`lanes-${o.id}`}>
                      {LANE_SUGGESTIONS.map(s => <option key={s.lane} value={s.lane}>{s.description}</option>)}
                    </datalist>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Category</label>
                    <Select defaultValue={o.category ?? ''} onValueChange={(v) => updateOwner(o.id, { category: v })}>
                      <SelectTrigger><SelectValue placeholder="Pick category" /></SelectTrigger>
                      <SelectContent>
                        {LANE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
            {owners.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-4">No owners yet. Add one above.</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
