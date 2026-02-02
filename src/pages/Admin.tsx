import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MEMBERSHIP_TYPES, ALL_STAFF } from '@/types';
import { Settings, Users, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export default function Admin() {
  const { user } = useAuth();
  const { shiftRecaps, igLeads } = useData();

  // Only admin can access
  if (user?.role !== 'Admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // Calculate stats per staff member
  const staffStats = ALL_STAFF.map(name => {
    const recaps = shiftRecaps.filter(r => r.staffName === name);
    const leads = igLeads.filter(l => l.saName === name);
    
    let commission = 0;
    let introsRun = 0;
    let closed = 0;

    recaps.forEach(recap => {
      recap.introsRun.forEach(intro => {
        introsRun++;
        const membershipType = MEMBERSHIP_TYPES.find(m => m.label === intro.result);
        if (membershipType && membershipType.commission > 0) {
          closed++;
          if (intro.isSelfGen) {
            commission += membershipType.commission;
          }
        }
      });
    });

    return {
      name,
      totalRecaps: recaps.length,
      totalLeads: leads.length,
      introsRun,
      closed,
      closingRate: introsRun > 0 ? Math.round((closed / introsRun) * 100) : 0,
      commission,
    };
  }).filter(s => s.totalRecaps > 0 || s.totalLeads > 0);

  // Pending claims (simulated for now)
  const pendingClaims: any[] = [];

  return (
    <div className="p-4 space-y-4">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Admin Panel
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage commissions and claims
        </p>
      </div>

      {/* Team Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Team Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {staffStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No activity yet
            </p>
          ) : (
            <div className="space-y-3">
              {staffStats.map((staff) => (
                <div 
                  key={staff.name}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{staff.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span>{staff.totalRecaps} recaps</span>
                      <span>{staff.totalLeads} leads</span>
                      <span>{staff.closingRate}% close</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-success">
                      ${staff.commission.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {staff.closed}/{staff.introsRun} closed
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Claims */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-warning" />
            Pending Claims
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingClaims.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle className="w-12 h-12 text-success mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">
                No pending claims
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingClaims.map((claim, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 bg-warning/10 rounded-lg border border-warning/30"
                >
                  <div>
                    <p className="font-medium">{claim.memberName}</p>
                    <p className="text-xs text-muted-foreground">
                      Claimed by {claim.claimedBy}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-8">
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      Reject
                    </Button>
                    <Button size="sm" className="h-8">
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integration Settings Placeholder */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <p className="font-medium">MindBody API</p>
              <p className="text-xs text-muted-foreground">Auto-sync bookings</p>
            </div>
            <Badge variant="secondary">Not Connected</Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <p className="font-medium">Google Sheets</p>
              <p className="text-xs text-muted-foreground">Sync form data</p>
            </div>
            <Badge variant="secondary">Not Connected</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
