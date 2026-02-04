import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ClipboardList, Trash2, Edit, RefreshCw, Search, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ShiftRecap {
  id: string;
  staff_name: string;
  shift_date: string;
  shift_type: string;
  calls_made: number | null;
  texts_sent: number | null;
  emails_sent: number | null;
  dms_sent: number | null;
  created_at: string;
}

export default function ShiftRecapsEditor() {
  const [recaps, setRecaps] = useState<ShiftRecap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedRecap, setSelectedRecap] = useState<ShiftRecap | null>(null);
  const [editValues, setEditValues] = useState({
    calls_made: 0,
    texts_sent: 0,
    emails_sent: 0,
    dms_sent: 0,
  });
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recapToDelete, setRecapToDelete] = useState<ShiftRecap | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchRecaps = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('shift_recaps')
        .select('id, staff_name, shift_date, shift_type, calls_made, texts_sent, emails_sent, dms_sent, created_at')
        .order('shift_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setRecaps(data || []);
    } catch (error) {
      console.error('Error fetching shift recaps:', error);
      toast.error('Failed to load shift recaps');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecaps();
  }, []);

  const filteredRecaps = recaps.filter((recap) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      recap.staff_name.toLowerCase().includes(searchLower) ||
      recap.shift_date.includes(searchTerm) ||
      recap.shift_type.toLowerCase().includes(searchLower)
    );
  });

  const handleOpenEdit = (recap: ShiftRecap) => {
    setSelectedRecap(recap);
    setEditValues({
      calls_made: recap.calls_made || 0,
      texts_sent: recap.texts_sent || 0,
      emails_sent: recap.emails_sent || 0,
      dms_sent: recap.dms_sent || 0,
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedRecap) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('shift_recaps')
        .update({
          calls_made: editValues.calls_made,
          texts_sent: editValues.texts_sent,
          emails_sent: editValues.emails_sent,
          dms_sent: editValues.dms_sent,
          last_edited_at: new Date().toISOString(),
          last_edited_by: 'Admin',
          edit_reason: 'Edited via Admin Panel',
        })
        .eq('id', selectedRecap.id);

      if (error) throw error;
      
      toast.success('Shift recap updated');
      setEditDialogOpen(false);
      setSelectedRecap(null);
      await fetchRecaps();
    } catch (error) {
      console.error('Error updating shift recap:', error);
      toast.error('Failed to update shift recap');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenDelete = (recap: ShiftRecap) => {
    setRecapToDelete(recap);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!recapToDelete) return;
    
    setIsDeleting(true);
    try {
      // First, unlink any intros_booked that reference this shift
      await supabase
        .from('intros_booked')
        .update({ shift_recap_id: null })
        .eq('shift_recap_id', recapToDelete.id);

      // Unlink any intros_run that reference this shift
      await supabase
        .from('intros_run')
        .update({ shift_recap_id: null })
        .eq('shift_recap_id', recapToDelete.id);

      // Unlink any sales that reference this shift
      await supabase
        .from('sales_outside_intro')
        .update({ shift_recap_id: null })
        .eq('shift_recap_id', recapToDelete.id);

      // Now delete the shift recap
      const { error } = await supabase
        .from('shift_recaps')
        .delete()
        .eq('id', recapToDelete.id);

      if (error) throw error;
      
      toast.success('Shift recap deleted');
      setDeleteDialogOpen(false);
      setRecapToDelete(null);
      await fetchRecaps();
    } catch (error) {
      console.error('Error deleting shift recap:', error);
      toast.error('Failed to delete shift recap');
    } finally {
      setIsDeleting(false);
    }
  };

  const getTotalContacts = (recap: ShiftRecap) => {
    return (recap.calls_made || 0) + (recap.texts_sent || 0) + (recap.emails_sent || 0) + (recap.dms_sent || 0);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Shift Recaps Editor
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchRecaps} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, date, or shift type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Table */}
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
          ) : filteredRecaps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No shift recaps found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Staff</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Shift</TableHead>
                    <TableHead className="text-xs text-center">Calls</TableHead>
                    <TableHead className="text-xs text-center">Texts</TableHead>
                    <TableHead className="text-xs text-center">DMs</TableHead>
                    <TableHead className="text-xs text-center">Emails</TableHead>
                    <TableHead className="text-xs text-center">Total</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecaps.map((recap) => (
                    <TableRow key={recap.id}>
                      <TableCell className="font-medium text-sm py-2">
                        {recap.staff_name}
                      </TableCell>
                      <TableCell className="text-sm py-2">
                        {format(new Date(recap.shift_date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-sm py-2">
                        <Badge variant="outline" className="text-xs">
                          {recap.shift_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm py-2">
                        {recap.calls_made || 0}
                      </TableCell>
                      <TableCell className="text-center text-sm py-2">
                        {recap.texts_sent || 0}
                      </TableCell>
                      <TableCell className="text-center text-sm py-2">
                        {recap.dms_sent || 0}
                      </TableCell>
                      <TableCell className="text-center text-sm py-2">
                        {recap.emails_sent || 0}
                      </TableCell>
                      <TableCell className="text-center text-sm py-2 font-medium">
                        {getTotalContacts(recap)}
                      </TableCell>
                      <TableCell className="text-right py-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleOpenEdit(recap)}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleOpenDelete(recap)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Showing {filteredRecaps.length} of {recaps.length} recaps (max 100)
          </p>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Shift Recap</DialogTitle>
            <DialogDescription>
              {selectedRecap && (
                <>
                  {selectedRecap.staff_name} - {format(new Date(selectedRecap.shift_date), 'MMM d, yyyy')} ({selectedRecap.shift_type})
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div>
              <Label className="text-sm">Calls Made</Label>
              <Input
                type="number"
                min={0}
                value={editValues.calls_made}
                onChange={(e) => setEditValues(prev => ({ ...prev, calls_made: parseInt(e.target.value) || 0 }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm">Texts Sent</Label>
              <Input
                type="number"
                min={0}
                value={editValues.texts_sent}
                onChange={(e) => setEditValues(prev => ({ ...prev, texts_sent: parseInt(e.target.value) || 0 }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm">DMs Sent</Label>
              <Input
                type="number"
                min={0}
                value={editValues.dms_sent}
                onChange={(e) => setEditValues(prev => ({ ...prev, dms_sent: parseInt(e.target.value) || 0 }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm">Emails Sent</Label>
              <Input
                type="number"
                min={0}
                value={editValues.emails_sent}
                onChange={(e) => setEditValues(prev => ({ ...prev, emails_sent: parseInt(e.target.value) || 0 }))}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete Shift Recap
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this shift recap?
            </DialogDescription>
          </DialogHeader>

          {recapToDelete && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="font-medium">{recapToDelete.staff_name}</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(recapToDelete.shift_date), 'MMMM d, yyyy')} - {recapToDelete.shift_type}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Contacts: {getTotalContacts(recapToDelete)} (Calls: {recapToDelete.calls_made || 0}, Texts: {recapToDelete.texts_sent || 0}, DMs: {recapToDelete.dms_sent || 0}, Emails: {recapToDelete.emails_sent || 0})
              </p>
            </div>
          )}

          <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
            <p className="text-sm text-warning">
              <strong>Note:</strong> Linked intro bookings, intro runs, and sales will be unlinked but NOT deleted.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmDelete} 
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
