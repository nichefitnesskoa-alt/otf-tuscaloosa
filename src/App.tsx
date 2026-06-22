import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import MyDay from "./pages/MyDay";
import Leads from "./pages/Leads";
import Meeting from "./pages/Meeting";
import Admin from "./pages/Admin";
import SettingsPage from "./pages/Settings";
import Pipeline from "./pages/Pipeline";
import Wig from "./pages/Wig";
import Scripts from "./pages/Scripts";
import Questionnaire from "./pages/Questionnaire";
import SuccessStory from "./pages/SuccessStory";
import VipRegister from "./pages/VipRegister";
import VipAvailability from "./pages/VipAvailability";
import VipMemberRegister from "./pages/VipMemberRegister";
import VipConfirmed from "./pages/VipConfirmed";
import VipRoster from "./pages/VipRoster";
import Vips from "./pages/Vips";
import CoachView from "./pages/CoachView";
import Recaps from "./pages/Recaps";
import CoachMyIntros from "./pages/CoachMyIntros";
import CoachScorecards from "./pages/CoachScorecards";
import CoachDetail from "./pages/CoachDetail";
import SaDetail from "./pages/SaDetail";
import TheTable from "./pages/TheTable";
import TheTableHistory from "./pages/TheTableHistory";
import Apply from "./pages/Apply";
import NotFound from "./pages/NotFound";
import GiveawayEntryPage from "./features/giveaway/GiveawayEntryPage";
import GiveawayAdminPage from "./features/giveaway/GiveawayAdminPage";
import GiveawayPreviewPage from "./features/giveaway/GiveawayPreviewPage";
import PartnerDeckPage from "./features/giveaway/PartnerDeckPage";
import PartnerDeckAdminPage from "./features/giveaway/PartnerDeckAdminPage";
import PartnerDeckShareResolver from "./features/giveaway/PartnerDeckShareResolver";
import PartnerViewPage from "./features/giveaway/PartnerViewPage";
import BingoPage from "./features/bingo/BingoPage";
import BingoAdminPage from "./features/bingo/BingoAdminPage";
import BingoSharePage from "./features/bingo/BingoSharePage";
import { useParams } from "react-router-dom";

function QuestionnaireRedirect() {
  const { id } = useParams();
  return <Navigate to={`/q/${id}`} replace />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
});

// Register with the global invalidation bus so notifyDataChanged() can
// invalidate React Query keys alongside DataContext refreshes.
import { registerQueryClient } from '@/lib/data/invalidation';
registerQueryClient(queryClient);

function ProtectedRoute({ children, requireAdmin, blockCoach }: { children: React.ReactNode; requireAdmin?: boolean; blockCoach?: boolean }) {
  const { isAuthenticated, canAccessAdmin, user } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Coach role can only access /coach-view; bounce them to WIG (the default).
  if (blockCoach && user?.role === 'Coach') {
    return <Navigate to="/wig" replace />;
  }

  if (requireAdmin && !canAccessAdmin) {
    return <Navigate to="/my-day" replace />;
  }
  
  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  const { isAuthenticated, user } = useAuth();
  // WIG is the front door for everyone — the studio scoreboard.
  const defaultRoute = '/wig';

  return (
    <Routes>
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to={defaultRoute} replace /> : <Login />} 
      />
      {/* DEPRECATED redirects — folded into other surfaces */}
      <Route path="/shift-recap" element={<Navigate to="/my-day" replace />} />
      <Route path="/dashboard" element={<Navigate to="/my-day" replace />} />
      <Route path="/my-shifts" element={<Navigate to="/my-day" replace />} />
      <Route
        path="/recaps"
        element={
          <ProtectedRoute>
            <Recaps />
          </ProtectedRoute>
        }
      />
      <Route path="/reports" element={<Navigate to="/admin" replace />} />
      <Route path="/leads" element={<Navigate to="/pipeline" replace />} />
      <Route
        path="/scripts"
        element={
          <ProtectedRoute blockCoach>
            <Scripts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pipeline"
        element={
          <ProtectedRoute>
            <Pipeline />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wig"
        element={
          <ProtectedRoute>
            <Wig />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireAdmin>
            <Admin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute blockCoach>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/meeting"
        element={
          <ProtectedRoute blockCoach>
            <Meeting />
          </ProtectedRoute>
        }
      />
      <Route path="/q/:id" element={<Questionnaire />} />
      <Route path="/story/:id" element={<SuccessStory />} />
      <Route path="/vip-register" element={<VipRegister />} />
      <Route path="/vip-availability" element={<VipAvailability />} />
      <Route path="/vip/:slug/register" element={<VipMemberRegister />} />
      <Route path="/vip/:slug/confirmed" element={<VipConfirmed />} />
      <Route path="/vip/:slug/roster" element={<VipRoster />} />
      <Route path="/apply" element={<Apply />} />
      <Route path="/apply/:token" element={<Apply />} />
      <Route path="/join-the-team" element={<Apply />} />
      <Route path="/giveaway/:studioSlug" element={<GiveawayEntryPage />} />
      <Route path="/giveaway/:studioSlug/e/:entrySlug" element={<GiveawayEntryPage />} />
      <Route path="/admin/:studioSlug" element={<GiveawayAdminPage />} />
      <Route path="/admin/:studioSlug/preview" element={<GiveawayPreviewPage />} />
      <Route path="/admin/:studioSlug/partner-deck" element={<PartnerDeckAdminPage />} />
      <Route path="/admin/:studioSlug/partner-view" element={<PartnerViewPage />} />
      <Route path="/partner-deck/:studioSlug" element={<PartnerDeckPage />} />
      <Route path="/questionnaire/:id" element={<QuestionnaireRedirect />} />
      <Route path="/bingo" element={<BingoPage />} />
      <Route path="/bingo/s/:slug" element={<BingoSharePage />} />
      <Route path="/bingo-admin" element={<ProtectedRoute><BingoAdminPage /></ProtectedRoute>} />
      <Route
        path="/my-day"
        element={
          <ProtectedRoute blockCoach>
            <MyDay />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coach-view"
        element={
          <ProtectedRoute>
            <CoachView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-intros"
        element={
          <ProtectedRoute>
            <CoachMyIntros />
          </ProtectedRoute>
        }
      />
      <Route
        path="/scorecards"
        element={
          <ProtectedRoute>
            <CoachScorecards />
          </ProtectedRoute>
        }
      />
      <Route
        path="/scorecards/me"
        element={
          <ProtectedRoute>
            <CoachScorecards />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coaches/:coachName"
        element={
          <ProtectedRoute>
            <CoachDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sas/:saName"
        element={
          <ProtectedRoute>
            <SaDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vips"
        element={
          <ProtectedRoute>
            <Vips />
          </ProtectedRoute>
        }
      />
      <Route path="/the-table" element={<ProtectedRoute><TheTable /></ProtectedRoute>} />
      <Route path="/the-table/history" element={<ProtectedRoute><TheTableHistory /></ProtectedRoute>} />
      <Route path="/the-table/:meetingId" element={<ProtectedRoute><TheTable /></ProtectedRoute>} />
      <Route path="/" element={<Navigate to={defaultRoute} replace />} />
      <Route path="/:shareSlug" element={<PartnerDeckShareResolver />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DataProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </DataProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}


export default App;
