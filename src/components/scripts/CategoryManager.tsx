import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useScriptCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, ScriptCategory,
} from '@/hooks/useScriptCategories';
import { useScriptTemplates } from '@/hooks/useScriptTemplates';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Trash2, ChevronUp, ChevronDown, Plus } from 'lucide-react';

interface CategoryManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategoryManager({ open, onOpenChange }: CategoryManagerProps) {
  const { data: categories = [] } = useScriptCategories();
  const { data: templates = [] } = useScriptTemplates();
  const { user } = useAuth();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null);

  const deleteCat = categories.find(c => c.slug === deleteSlug);
  const deleteScriptCount = deleteSlug ? templates.filter(t => t.category === deleteSlug).length : 0;

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const slug = newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (categories.some(c => c.slug === slug)) {
      toast({ title: 'Category already exists', variant: 'destructive' });
      return;
    }
    const maxOrder = categories.reduce((max, c) => Math.max(max, c.sort_order), 0);
    try {
      await createCategory.mutateAsync({
        name: newName.trim(),
        slug,
        sort_order: maxOrder + 1,
        created_by: user?.name,
      });
      setNewName('');
      toast({ title: 'Category added' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleRename = async (cat: ScriptCategory) => {
    if (!editingName.trim() || editingName.trim() === cat.name) {
      setEditingId(null);
      return;
    }
    try {
      await updateCategory.mutateAsync({ id: cat.id, name: editingName.trim() });
      setEditingId(null);
      toast({ title: 'Category renamed' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleReorder = async (cat: ScriptCategory, direction: 'up' | 'down') => {
    const idx = categories.findIndex(c => c.id === cat.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= categories.length) return;
    const other = categories[swapIdx];
    try {
      await Promise.all([
        updateCategory.mutateAsync({ id: cat.id, sort_order: other.sort_order }),
        updateCategory.mutateAsync({ id: other.id, sort_order: cat.sort_order }),
      ]);
    } catch {
      toast({ title: 'Error reordering', variant: 'destructive' });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteSlug) return;
    try {
      await deleteCategory.mutateAsync(deleteSlug);
      toast({ title: 'Category deleted' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setDeleteSlug(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
          </DialogHeader>

          <div className="space-y-1">
            {categories.map((cat, idx) => {
              const scriptCount = templates.filter(t => t.category === cat.slug).length;
              const isEditing = editingId === cat.id;
              return (
                <div key={cat.id} className="flex items-center gap-1.5 py-1.5 px-2 rounded-md hover:bg-muted/50 group">
                  <div className="flex flex-col">
                    <button
                      disabled={idx === 0}
                      onClick={() => handleReorder(cat, 'up')}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      disabled={idx === categories.length - 1}
                      onClick={() => handleReorder(cat, 'down')}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>

                  {isEditing ? (
                    <div className="flex-1">
                      <Input
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        className="h-7 text-sm"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRename(cat);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        onBlur={() => handleRename(cat)}
                      />
                    </div>
                  ) : (
                    <button
                      className="flex-1 text-left text-sm font-medium truncate"
                      onClick={() => { setEditingId(cat.id); setEditingName(cat.name); }}
                    >
                      {cat.name}
                    </button>
                  )}

                  <span className="text-[10px] text-muted-foreground shrink-0">{scriptCount}</span>

                  <button
                    onClick={() => setDeleteSlug(cat.slug)}
                    className="text-muted-foreground hover:text-destructive p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="New category name..."
              className="h-8 text-sm"
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            />
            <Button size="sm" onClick={handleAdd} disabled={!newName.trim()}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteSlug} onOpenChange={o => { if (!o) setDeleteSlug(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteCat?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this category and all {deleteScriptCount} script{deleteScriptCount !== 1 ? 's' : ''} inside it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
