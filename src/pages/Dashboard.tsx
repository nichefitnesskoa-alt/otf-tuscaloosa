import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MEMBERSHIP_TYPES } from '@/types';
import { DollarSign, TrendingUp, Users, Target, Calendar } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const { shiftRecaps, igLeads } = useData();

  // Calculate stats
  const userRecaps = user?.role === 'Admin' 
    ? shiftRecaps 
    : shiftRecaps.filter(r => r.staffName === user?.name);

  const userLeads = user?.role === 'Admin'
    ? igLeads
    : igLeads.filter(l => l.saName === user?.name);

  // Commission calculation
  const calculateCommission = () => {
    let total = 0;
    userRecaps.forEach(recap => {
      recap.introsRun.forEach(intro => {
        if (intro.isSelfGen) {
          const membershipType = MEMBERSHIP_TYPES.find(m => m.label === intro.result);
          if (membershipType) {
            total += membershipType.commission;
          }
        }
      });
      recap.salesOutsideIntro.forEach(sale => {
        const membershipType = MEMBERSHIP_TYPES.find(m => m.label === sale.membershipType);
        if (membershipType) {
          total += membershipType.commission;
        }
      });
    });
    return total;
  };

  const totalCommission = calculateCommission();
  const totalIntrosBooked = userRecaps.reduce((sum, r) => sum + r.introsBooked.length, 0);
  const totalIntrosRun = userRecaps.reduce((sum, r) => sum + r.introsRun.length, 0);
  const closedIntros = userRecaps.reduce((sum, r) => 
    sum + r.introsRun.filter(i => 
      MEMBERSHIP_TYPES.find(m => m.label === i.result)?.commission! > 0
    ).length, 0
  );
  const closingRate = totalIntrosRun > 0 ? Math.round((closedIntros / totalIntrosRun) * 100) : 0;

  const stats = [
    {
      label: 'Total Commission',
      value: `$${totalCommission.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      label: 'Intros Booked',
      value: totalIntrosBooked,
      icon: Calendar,
      color: 'text-info',
      bg: 'bg-info/10',
    },
    {
      label: 'Intros Run',
      value: totalIntrosRun,
      icon: Users,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Closing Rate',
      value: `${closingRate}%`,
      icon: Target,
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
  ];

  const leadsStats = {
    total: userLeads.length,
    notBooked: userLeads.filter(l => l.status === 'not_booked').length,
    booked: userLeads.filter(l => l.status === 'booked').length,
    closed: userLeads.filter(l => l.status === 'closed').length,
  };

  return (
    <div className="p-4 space-y-4">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {user?.role === 'Admin' ? 'All staff overview' : 'Your performance'}
        </p>
      </div>

      {/* Commission Card */}
      <Card className="bg-foreground text-background">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-70">Total Earned</p>
              <p className="text-4xl font-black text-success">
                ${totalCommission.toFixed(2)}
              </p>
              <p className="text-xs opacity-50 mt-1">Current pay period</p>
            </div>
            <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-success" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.slice(1).map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center mb-2`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* IG Leads Pipeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">IG Leads Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 text-center p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{leadsStats.notBooked}</p>
              <p className="text-xs text-muted-foreground">Not Booked</p>
            </div>
            <div className="text-muted-foreground">→</div>
            <div className="flex-1 text-center p-3 bg-success/10 rounded-lg">
              <p className="text-2xl font-bold text-success">{leadsStats.booked}</p>
              <p className="text-xs text-muted-foreground">Booked</p>
            </div>
            <div className="text-muted-foreground">→</div>
            <div className="flex-1 text-center p-3 bg-primary/10 rounded-lg">
              <p className="text-2xl font-bold text-primary">{leadsStats.closed}</p>
              <p className="text-xs text-muted-foreground">Closed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Recaps</CardTitle>
        </CardHeader>
        <CardContent>
          {userRecaps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recaps submitted yet
            </p>
          ) : (
            <div className="space-y-3">
              {userRecaps.slice(-5).reverse().map((recap) => (
                <div 
                  key={recap.id} 
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm">{recap.staffName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(recap.date).toLocaleDateString()} · {recap.shiftType}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {recap.introsRun.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {recap.introsRun.length} intros
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
