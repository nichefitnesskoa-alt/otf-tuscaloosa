import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IGLeadForm } from '@/components/IGLeadForm';
import { LeadStatus } from '@/types';
import { Plus, Instagram, Phone, Mail, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusConfig: Record<LeadStatus, { label: string; icon: string; className: string }> = {
  not_booked: { label: 'Not Booked', icon: '🟡', className: 'bg-warning/20 text-warning-foreground border-warning/30' },
  booked: { label: 'Booked', icon: '🟢', className: 'bg-success/20 text-success-foreground border-success/30' },
  no_show: { label: 'No Show', icon: '🔴', className: 'bg-destructive/20 text-destructive-foreground border-destructive/30' },
  closed: { label: 'Closed', icon: '💰', className: 'bg-primary/20 text-primary border-primary/30' },
};

const filterOptions: { value: LeadStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'not_booked', label: 'Not Booked' },
  { value: 'booked', label: 'Booked' },
  { value: 'closed', label: 'Closed' },
];

export default function IGLeads() {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<LeadStatus | 'all'>('all');
  const { user } = useAuth();
  const { igLeads } = useData();

  // Filter leads for current SA (Admin sees all)
  const userLeads = user?.role === 'Admin' 
    ? igLeads 
    : igLeads.filter(lead => lead.saName === user?.name);

  const filteredLeads = filter === 'all' 
    ? userLeads 
    : userLeads.filter(lead => lead.status === filter);

  if (showForm) {
    return <IGLeadForm onClose={() => setShowForm(false)} />;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">IG Leads</h1>
          <p className="text-sm text-muted-foreground">
            {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm">
          <Plus className="w-4 h-4 mr-1" />
          Add Lead
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        {filterOptions.map((option) => (
          <Button
            key={option.value}
            variant={filter === option.value ? 'default' : 'outline'}
            size="sm"
            className="flex-shrink-0"
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Leads List */}
      <div className="space-y-3">
        {filteredLeads.length === 0 ? (
          <Card className="p-8 text-center">
            <Instagram className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold mb-1">No leads yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start tracking your Instagram leads
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Add Your First Lead
            </Button>
          </Card>
        ) : (
          filteredLeads.map((lead) => {
            const status = statusConfig[lead.status];
            return (
              <Card key={lead.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold truncate">
                        {lead.firstName} {lead.lastName}
                      </span>
                      <Badge variant="outline" className={cn('text-xs', status.className)}>
                        {status.icon} {status.label}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-1 text-primary text-sm mb-2">
                      <Instagram className="w-3.5 h-3.5" />
                      @{lead.instagramHandle}
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {lead.phoneNumber && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {lead.phoneNumber}
                        </span>
                      )}
                      {lead.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {lead.email}
                        </span>
                      )}
                    </div>

                    {lead.notes && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {lead.notes}
                      </p>
                    )}
                  </div>

                  <div className="text-right text-xs text-muted-foreground flex-shrink-0">
                    {new Date(lead.dateAdded).toLocaleDateString()}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
