import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Users, Calendar, Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const { shiftRecaps, introsRun, sales, isLoading } = useData();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Calculate stats based on role
  const isAdmin = user?.role === 'Admin';
  const userRecaps = isAdmin ? shiftRecaps : shiftRecaps.filter(r => r.staff_name === user?.name);
  const userIntros = isAdmin ? introsRun : introsRun.filter(r => r.intro_owner === user?.name || r.sa_name === user?.name);
  const userSales = isAdmin ? sales : sales.filter(s => s.intro_owner === user?.name);

  // Calculate total commission
  const introCommission = userIntros.reduce((sum, r) => sum + (r.commission_amount || 0), 0);
  const saleCommission = userSales.reduce((sum, s) => sum + (s.commission_amount || 0), 0);
  const totalCommission = introCommission + saleCommission;

  // Total outreach activity
  const totalActivity = userRecaps.reduce((sum, r) => 
    sum + (r.calls_made || 0) + (r.texts_sent || 0) + (r.emails_sent || 0) + (r.dms_sent || 0), 0
  );

  return (
    <div className="p-4 space-y-4">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? 'All staff overview' : 'Your performance'}
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
              <p className="text-xs opacity-50 mt-1">All time</p>
            </div>
            <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-success" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Calendar className="w-5 h-5 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold">{userRecaps.length}</p>
            <p className="text-xs text-muted-foreground">Shifts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="w-5 h-5 text-success mx-auto mb-2" />
            <p className="text-2xl font-bold">{userIntros.length}</p>
            <p className="text-xs text-muted-foreground">Intros</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="w-5 h-5 text-warning mx-auto mb-2" />
            <p className="text-2xl font-bold">{userSales.length}</p>
            <p className="text-xs text-muted-foreground">Sales</p>
          </CardContent>
        </Card>
      </div>

      {/* Outreach Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Total Outreach</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-primary">{totalActivity}</p>
          <p className="text-xs text-muted-foreground">Calls + Texts + DMs + Emails</p>
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
              {userRecaps.slice(0, 5).map((recap) => (
                <div 
                  key={recap.id} 
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm">{recap.staff_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(recap.shift_date).toLocaleDateString()} · {recap.shift_type}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {(recap.calls_made || 0) + (recap.texts_sent || 0)} contacts
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
