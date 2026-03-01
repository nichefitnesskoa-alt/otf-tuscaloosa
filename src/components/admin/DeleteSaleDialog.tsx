import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DeleteSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase: {
    id: string;
    member_name: string;
    source: 'intro_run' | 'outside_intro';
  } | null;
  onDeleted: () => void;
}

export default function DeleteSaleDialog({ open, onOpenChange, purchase, onDeleted }: DeleteSaleDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!purchase) return;
    setDeleting(true);
    try {
      if (purchase.source === 'intro_run') {
        // Soft-delete: zero commission and mark as Deleted
        const { error } = await supabase
          .from('intros_run')
          .update({ commission_amount: 0, result: 'Deleted', result_canon: 'DELETED' })
          .eq('id', purchase.id);
        if (error) throw error;
      } else {
        // Hard-delete outside sales
        const { error } = await supabase
          .from('sales_outside_intro')
          .delete()
          .eq('id', purchase.id);
        if (error) throw error;
      }

      toast.success(`Sale for ${purchase.member_name} removed`);
      onOpenChange(false);
      onDeleted();
    } catch (err) {
      console.error('Error deleting sale:', err);
      toast.error('Failed to delete sale');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Sale</AlertDialogTitle>
          <AlertDialogDescription>
            {purchase?.source === 'intro_run'
              ? `This will zero out the commission and mark "${purchase?.member_name}"'s sale as deleted. The intro run record will be preserved.`
              : `This will permanently delete the outside sale for "${purchase?.member_name}". This cannot be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
