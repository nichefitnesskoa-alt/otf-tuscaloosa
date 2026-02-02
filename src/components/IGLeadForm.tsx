import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Instagram, Plus, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const INTEREST_LEVELS = [
  'Very interested - Reach back out after break',
  'Interested - Forgot to answer, reach out later',
  'Booked intro',
  'Not interested',
] as const;

type InterestLevel = typeof INTEREST_LEVELS[number];

interface IGLeadFormProps {
  onClose: () => void;
}

export function IGLeadForm({ onClose }: IGLeadFormProps) {
  const { user } = useAuth();
  const { addIGLead } = useData();
  
  const [formData, setFormData] = useState({
    instagram_handle: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    email: '',
    interest_level: '' as InterestLevel,
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.instagram_handle || !formData.first_name || !formData.interest_level) {
      toast.error('Please fill in all required fields');
      return;
    }

    const status = formData.interest_level === 'Booked intro' ? 'booked' : 
                   formData.interest_level === 'Not interested' ? 'not_booked' : 'not_booked';

    const result = await addIGLead({
      sa_name: user?.name || '',
      date_added: new Date().toISOString().split('T')[0],
      instagram_handle: formData.instagram_handle.replace('@', ''),
      first_name: formData.first_name,
      last_name: formData.last_name || null,
      phone_number: formData.phone_number || null,
      email: formData.email || null,
      interest_level: formData.interest_level,
      notes: formData.notes || null,
      status,
    });

    if (result) {
      toast.success('Lead added successfully! 🎉');
      onClose();
    } else {
      toast.error('Failed to add lead');
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Add IG Lead</h1>
          <p className="text-sm text-muted-foreground">Track a new Instagram lead</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Instagram className="w-4 h-4 text-primary" />
              Contact Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="instagram" className="text-sm">
                Instagram Handle <span className="text-destructive">*</span>
              </Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                <Input
                  id="instagram"
                  placeholder="username"
                  className="pl-8"
                  value={formData.instagram_handle}
                  onChange={(e) => setFormData({ ...formData, instagram_handle: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="firstName" className="text-sm">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="firstName"
                  placeholder="First name"
                  className="mt-1"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="lastName" className="text-sm">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Last name"
                  className="mt-1"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="phone" className="text-sm">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                className="mt-1"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                className="mt-1"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Interest Level</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm">
                Interest Level <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.interest_level}
                onValueChange={(value) => setFormData({ ...formData, interest_level: value as InterestLevel })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select interest level..." />
                </SelectTrigger>
                <SelectContent>
                  {INTEREST_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes" className="text-sm">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Add any additional notes..."
                className="mt-1 min-h-[80px]"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full h-12 text-base font-bold" size="lg">
          <Plus className="w-5 h-5 mr-2" />
          Add Lead
        </Button>
      </form>
    </div>
  );
}
