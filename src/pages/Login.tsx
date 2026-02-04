import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ALL_STAFF, COACHES, SALES_ASSOCIATES } from '@/types';
import { Flame, Users, Dumbbell } from 'lucide-react';

export default function Login() {
  const [selectedName, setSelectedName] = useState<string>('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = () => {
    if (selectedName) {
      login(selectedName);
      navigate('/shift-recap');
    }
  };

  return (
    <div className="min-h-screen bg-foreground flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
          <Flame className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-black text-background tracking-tight">
          ORANGETHEORY
        </h1>
        <p className="text-background/60 text-sm mt-1">Shift Recap</p>
      </div>

      <Card className="w-full max-w-sm border-0 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl">Welcome Back</CardTitle>
          <CardDescription>Select your name to continue</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedName} onValueChange={setSelectedName}>
            <SelectTrigger className="h-12 text-base">
              <SelectValue placeholder="Choose your name..." />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-2">
                <Users className="w-3 h-3" /> Sales Associates
              </div>
              {SALES_ASSOCIATES.map((name) => (
                <SelectItem key={name} value={name} className="py-2.5">
                  {name} {name === 'Koa' && <span className="text-primary ml-1">(Admin)</span>}
                </SelectItem>
              ))}
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-2 mt-2">
                <Dumbbell className="w-3 h-3" /> Coaches
              </div>
              {COACHES.map((name) => (
                <SelectItem key={name} value={name} className="py-2.5">
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            onClick={handleLogin} 
            disabled={!selectedName}
            className="w-full h-12 text-base font-bold"
            size="lg"
          >
            Start Shift
          </Button>
        </CardContent>
      </Card>

      <p className="text-background/40 text-xs mt-8 text-center">
        More Life. More Energy. More Results.
      </p>
    </div>
  );
}
