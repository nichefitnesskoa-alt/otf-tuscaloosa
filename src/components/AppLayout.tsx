import { ReactNode } from 'react';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { ErrorBoundary } from './errors/ErrorBoundary';
import { useAuth } from '@/context/AuthContext';
import { OTF, Theme, brandFont } from '@/lib/otfBrand';
import { useSomlPendingReferralToast } from '@/hooks/useSomlPendingReferralToast';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user } = useAuth();
  const isCoach = user?.role === 'Coach';
  useSomlPendingReferralToast();

  const shellStyle = {
    backgroundColor: OTF.dark,
    color: OTF.bone,
    ...brandFont,
  };

  return (
    <div className="app-internal min-h-screen flex flex-col" style={shellStyle}>
      {!isCoach && <Header />}
      <main className="flex-1 pb-20 overflow-x-hidden overflow-y-auto">
        <ErrorBoundary fallbackTitle="This page encountered an error">
          {children}
        </ErrorBoundary>
      </main>
      <BottomNav />
    </div>
  );
}
