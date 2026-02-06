import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface LeadSourceData {
  source: string;
  booked: number;
  showed: number;
  sold: number;
  revenue: number;
}

interface LeadSourceChartProps {
  data: LeadSourceData[];
  className?: string;
}

const COLORS = [
  'hsl(27, 100%, 50%)',   // primary (OTF orange)
  'hsl(142, 76%, 36%)',   // success (green)
  'hsl(207, 90%, 54%)',   // info (blue)
  'hsl(45, 100%, 51%)',   // warning (yellow)
  'hsl(0, 84%, 60%)',     // destructive (red)
  'hsl(270, 70%, 50%)',   // purple
  'hsl(180, 70%, 45%)',   // teal
  'hsl(330, 70%, 50%)',   // pink
];

export function LeadSourceChart({ data, className }: LeadSourceChartProps) {
  // Prepare pie chart data for bookings distribution
  const pieData = data
    .filter(d => d.booked > 0)
    .map(d => ({
      name: d.source.length > 15 ? d.source.substring(0, 15) + '...' : d.source,
      fullName: d.source,
      value: d.booked,
      sold: d.sold,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Prepare bar chart data for conversion rates
  const barData = data
    .filter(d => d.booked > 0)
    .map(d => ({
      source: d.source.length > 12 ? d.source.substring(0, 12) + '...' : d.source,
      fullSource: d.source,
      showRate: d.booked > 0 ? (d.showed / d.booked) * 100 : 0,
      closeRate: d.showed > 0 ? (d.sold / d.showed) * 100 : 0,
      booked: d.booked,
      sold: d.sold,
    }))
    .sort((a, b) => b.booked - a.booked)
    .slice(0, 5);

  if (data.length === 0 || pieData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Lead Source Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No booking data yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Lead Source Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs defaultValue="distribution" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="distribution" className="text-xs">Distribution</TabsTrigger>
            <TabsTrigger value="conversion" className="text-xs">Conversion</TabsTrigger>
          </TabsList>
          
          <TabsContent value="distribution" className="mt-0">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number, name: string, entry: any) => [
                    `${value} booked, ${entry.payload.sold} sold`,
                    entry.payload.fullName
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Summary below chart */}
            <div className="mt-2 space-y-1">
              {pieData.slice(0, 4).map((item, idx) => (
                <div key={item.fullName} className="flex justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }} 
                    />
                    <span className="truncate max-w-[120px]">{item.fullName}</span>
                  </span>
                  <span className="text-muted-foreground">
                    {item.value} booked, <span className="text-success font-medium">{item.sold} sold</span>
                  </span>
                </div>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="conversion" className="mt-0">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="source" width={80} tick={{ fontSize: 10 }} />
                <Tooltip 
                  formatter={(value: number, name: string, entry: any) => {
                    if (name === 'Show Rate') {
                      return [`${value.toFixed(0)}%`, name];
                    }
                    return [`${value.toFixed(0)}% (${entry.payload.sold} sales)`, name];
                  }}
                />
                <Bar dataKey="showRate" name="Show Rate" fill="hsl(45, 100%, 51%)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="closeRate" name="Close Rate" fill="hsl(142, 76%, 36%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(45, 100%, 51%)' }} />
                <span>Show Rate</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(142, 76%, 36%)' }} />
                <span>Close Rate</span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
