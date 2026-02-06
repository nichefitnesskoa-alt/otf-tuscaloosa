import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Flame, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/shift-recap');
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.message?.includes('Invalid login credentials')) {
        toast.error('Invalid email or password');
      } else if (error.message?.includes('Email not confirmed')) {
        toast.error('Please verify your email before signing in');
      } else {
        toast.error(error.message || 'Failed to sign in');
      }
    } finally {
      setIsLoading(false);
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
          <CardDescription>Sign in to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12"
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12"
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>

            <Button 
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full h-12 text-base font-bold"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-background/40 text-xs mt-8 text-center">
        More Life. More Energy. More Results.
      </p>
    </div>
  );
}
