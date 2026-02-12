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
import Admin from "./pages/Admin";
import Pipeline from "./pages/Pipeline";
import Scripts from "./pages/Scripts";
import Questionnaire from "./pages/Questionnaire";
import VipRegister from "./pages/VipRegister";
import NotFound from "./pages/NotFound";
import { useParams } from "react-router-dom";

function QuestionnaireRedirect() {
  const { id } = useParams();
  return <Navigate to={`/q/${id}`} replace />;
}

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/my-day" replace /> : <Login />} 
      />
      <Route
        path="/shift-recap"
        element={
          <ProtectedRoute>
            <ShiftRecap />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={<Navigate to="/my-shifts" replace />}
      />
      <Route
        path="/recaps"
        element={
          <ProtectedRoute>
            <Recaps />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads"
        element={
          <ProtectedRoute>
            <Leads />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-shifts"
        element={
          <ProtectedRoute>
            <MyShifts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/scripts"
        element={
          <ProtectedRoute>
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
        path="/admin"
        element={
          <ProtectedRoute>
            <Admin />
          </ProtectedRoute>
        }
      />
      <Route path="/q/:id" element={<Questionnaire />} />
      <Route path="/vip-register" element={<VipRegister />} />
      <Route path="/questionnaire/:id" element={<QuestionnaireRedirect />} />
      <Route
        path="/my-day"
        element={
          <ProtectedRoute>
            <MyDay />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/my-day" replace />} />
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
