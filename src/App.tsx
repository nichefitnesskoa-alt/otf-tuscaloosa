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
import ShiftRecap from "./pages/ShiftRecap";
import MyShifts from "./pages/MyShifts";
import Recaps from "./pages/Recaps";
import Leads from "./pages/Leads";
import Meeting from "./pages/Meeting";
import Admin from "./pages/Admin";
import SettingsPage from "./pages/Settings";
import Pipeline from "./pages/Pipeline";
import Scripts from "./pages/Scripts";
import Questionnaire from "./pages/Questionnaire";
import SuccessStory from "./pages/SuccessStory";
import VipRegister from "./pages/VipRegister";
import CoachView from "./pages/CoachView";
import NotFound from "./pages/NotFound";
import { useParams } from "react-router-dom";

function QuestionnaireRedirect() {
  const { id } = useParams();
  return <Navigate to={`/q/${id}`} replace />;
}

const queryClient = new QueryClient();

function ProtectedRoute({ children, requireAdmin, blockCoach }: { children: React.ReactNode; requireAdmin?: boolean; blockCoach?: boolean }) {
  const { isAuthenticated, canAccessAdmin, user } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Coach role can only access /coach-view
  if (blockCoach && user?.role === 'Coach') {
    return <Navigate to="/coach-view" replace />;
  }

  if (requireAdmin && !canAccessAdmin) {
    return <Navigate to="/my-day" replace />;
  }
  
  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  const { isAuthenticated, user } = useAuth();
  const isCoach = user?.role === 'Coach';
  const defaultRoute = isCoach ? '/coach-view' : '/my-day';

  return (
    <Routes>
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to={defaultRoute} replace /> : <Login />} 
      />
      {/* DEPRECATED: functionality moved to MyDay */}
      <Route path="/shift-recap" element={<Navigate to="/my-day" replace />} />
      <Route
        path="/dashboard"
        element={<Navigate to="/my-shifts" replace />}
      />
      <Route
        path="/recaps"
        element={
          <ProtectedRoute blockCoach>
            <Recaps />
          </ProtectedRoute>
        }
      />
      <Route path="/leads" element={<Navigate to="/pipeline" replace />} />
      <Route
        path="/my-shifts"
        element={
          <ProtectedRoute blockCoach>
            <MyShifts />
          </ProtectedRoute>
        }
      />
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
          <ProtectedRoute blockCoach>
            <Pipeline />
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
      <Route path="/questionnaire/:id" element={<QuestionnaireRedirect />} />
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
      <Route path="/" element={<Navigate to={defaultRoute} replace />} />
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
