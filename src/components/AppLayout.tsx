import { ReactNode } from 'react';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { ErrorBoundary } from './errors/ErrorBoundary';
import { useAuth } from '@/context/AuthContext';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user } = useAuth();
  const isCoach = user?.role === 'Coach';

  if (isCoach) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <ErrorBoundary fallbackTitle="This page encountered an error">
            {children}
          </ErrorBoundary>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 pb-20 overflow-x-hidden overflow-y-auto">
        <ErrorBoundary fallbackTitle="This page encountered an error">
          {children}
        </ErrorBoundary>
      </main>
      <BottomNav />
    </div>
  );
}
