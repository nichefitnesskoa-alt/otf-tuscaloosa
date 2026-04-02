import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, UserPlus, Pencil, UserMinus, UserCheck } from 'lucide-react';
import { format } from 'date-fns';

interface StaffMember {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_active?: string;
}

type StaffRole = 'SA' | 'Coach' | 'Both' | 'Admin';

export default function StaffManagement() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddEdit, setShowAddEdit] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState<StaffMember | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<StaffRole>('SA');
  const [saving, setSaving] = useState(false);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    const { data: staffData, error } = await supabase
      .from('staff')
      .select('*')
      .order('name');
    if (error) { toast.error('Failed to load staff'); setLoading(false); return; }

    // Get last active dates from shift_recaps and intros_run
    const [{ data: recaps }, { data: runs }] = await Promise.all([
      supabase.from('shift_recaps').select('staff_name, shift_date').order('shift_date', { ascending: false }),
      supabase.from('intros_run').select('sa_name, run_date, coach_name, created_at').order('created_at', { ascending: false }),
    ]);

    const lastActiveMap: Record<string, string> = {};
    for (const r of (recaps || [])) {
      if (r.staff_name && r.shift_date) {
        if (!lastActiveMap[r.staff_name] || r.shift_date > lastActiveMap[r.staff_name]) {
          lastActiveMap[r.staff_name] = r.shift_date;
        }
      }
    }
    for (const r of (runs || [])) {
      const date = r.run_date || r.created_at?.split('T')[0];
      if (date) {
        for (const name of [r.sa_name, r.coach_name]) {
          if (name) {
            if (!lastActiveMap[name] || date > lastActiveMap[name]) {
              lastActiveMap[name] = date;
            }
          }
        }
      }
    }

    const enriched: StaffMember[] = (staffData || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      is_active: s.is_active ?? true,
      created_at: s.created_at,
      last_active: lastActiveMap[s.name] || undefined,
    }));

    setStaff(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const openAdd = () => {
    setEditingStaff(null);
    setFirstName('');
    setLastName('');
    setRole('SA');
    setShowAddEdit(true);
  };

  const openEdit = (s: StaffMember) => {
    setEditingStaff(s);
    const parts = s.name.split(' ');
    setFirstName(parts[0] || '');
    setLastName(parts.slice(1).join(' ') || '');
    setRole(mapDbRoleToForm(s.role));
    setShowAddEdit(true);
  };

  const mapDbRoleToForm = (dbRole: string): StaffRole => {
    if (dbRole === 'Admin') return 'Admin';
    if (dbRole === 'Both') return 'Both';
    if (dbRole === 'Coach') return 'Coach';
    return 'SA';
  };

  const handleSave = async () => {
    if (!firstName.trim()) { toast.error('First name is required'); return; }
    setSaving(true);
    const fullName = lastName.trim() ? `${firstName.trim()} ${lastName.trim()}` : firstName.trim();

    try {
      if (editingStaff) {
        const { error } = await supabase
          .from('staff')
          .update({ name: fullName, role: role } as any)
          .eq('id', editingStaff.id);
        if (error) throw error;
        toast.success(`Updated ${fullName}`);
      } else {
        const { error } = await supabase
          .from('staff')
          .insert({ name: fullName, role: role, is_active: true } as any);
        if (error) throw error;
        toast.success(`Added ${fullName}`);
      }
      setShowAddEdit(false);
      fetchStaff();
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (s: StaffMember) => {
    try {
      const { error } = await supabase
        .from('staff')
        .update({ is_active: false } as any)
        .eq('id', s.id);
      if (error) throw error;
      toast.success(`${s.name} has been deactivated`);
      setShowDeactivateConfirm(null);
      fetchStaff();
    } catch (err: any) {
      toast.error(err?.message || 'Deactivation failed');
    }
  };

  const handleReactivate = async (s: StaffMember) => {
    try {
      const { error } = await supabase
        .from('staff')
        .update({ is_active: true } as any)
        .eq('id', s.id);
      if (error) throw error;
      toast.success(`${s.name} has been reactivated`);
      fetchStaff();
    } catch (err: any) {
      toast.error(err?.message || 'Reactivation failed');
    }
  };

  const activeStaff = staff.filter(s => s.is_active);
  const inactiveStaff = staff.filter(s => !s.is_active);

  const getRoleBadgeColor = (r: string) => {
    switch (r) {
      case 'Admin': return 'bg-primary text-primary-foreground';
      case 'Coach': return 'bg-green-600 text-white';
      case 'Both': return 'bg-blue-600 text-white';
      default: return 'bg-blue-500 text-white';
    }
  };

  const StaffTable = ({ members, showReactivate }: { members: StaffMember[]; showReactivate?: boolean }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Added</TableHead>
          <TableHead>Last Active</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
              No staff members
            </TableCell>
          </TableRow>
        ) : members.map(s => (
          <TableRow key={s.id}>
            <TableCell className="font-medium">{s.name}</TableCell>
            <TableCell>
              <Badge className={getRoleBadgeColor(s.role)}>{s.role}</Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {format(new Date(s.created_at), 'MMM d, yyyy')}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {s.last_active ? format(new Date(s.last_active), 'MMM d, yyyy') : 'Never'}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                {showReactivate ? (
                  <Button size="sm" variant="outline" onClick={() => handleReactivate(s)} className="gap-1">
                    <UserCheck className="w-3.5 h-3.5" />
                    Reactivate
                  </Button>
                ) : (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setShowDeactivateConfirm(s)}>
                      <UserMinus className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              Staff Management
            </CardTitle>
            <Button size="sm" onClick={openAdd} className="gap-1 bg-[#E8540A] hover:bg-[#d44a08] text-white">
              <UserPlus className="w-3.5 h-3.5" />
              Add Staff Member
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
          ) : (
            <Tabs defaultValue="active">
              <TabsList className="mb-3">
                <TabsTrigger value="active">Active Staff ({activeStaff.length})</TabsTrigger>
                <TabsTrigger value="inactive">Inactive Staff ({inactiveStaff.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="active">
                <StaffTable members={activeStaff} />
              </TabsContent>
              <TabsContent value="inactive">
                <StaffTable members={inactiveStaff} showReactivate />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddEdit} onOpenChange={setShowAddEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}</DialogTitle>
            <DialogDescription>
              {editingStaff ? 'Update staff member details.' : 'Add a new staff member to the system.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name *</Label>
                <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as StaffRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SA">SA</SelectItem>
                  <SelectItem value="Coach">Coach</SelectItem>
                  <SelectItem value="Both">Both</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEdit(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !firstName.trim()}>
              {saving ? 'Saving…' : editingStaff ? 'Save Changes' : 'Add Staff Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation */}
      <Dialog open={!!showDeactivateConfirm} onOpenChange={() => setShowDeactivateConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Staff Member</DialogTitle>
            <DialogDescription>
              This will remove {showDeactivateConfirm?.name} from the login screen. Their data is preserved. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeactivateConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => showDeactivateConfirm && handleDeactivate(showDeactivateConfirm)}>
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
