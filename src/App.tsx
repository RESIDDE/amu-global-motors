import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { RoleGuard } from "@/components/RoleGuard";
import { useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Settings from "./pages/Settings";
import Unauthorized from "./pages/Unauthorized";
import VehiclesList from "./pages/VehiclesList";
import VehicleForm from "./pages/VehicleForm";
import VehicleDetail from "./pages/VehicleDetail";
import Customers from "./pages/Customers";
import Sales from "./pages/Sales";
import Invoices from "./pages/Invoices";
import Inquiries from "./pages/Inquiries";
import Inspections from "./pages/Inspections";
import RepairsMaintenance from "./pages/RepairsMaintenance";
import AuthorityToSell from "./pages/AuthorityToSell";
import SignRepair from "./pages/SignRepair";
import SignCustomer from "./pages/SignCustomer";
import SignInspection from "./pages/SignInspection";
import SignSale from "./pages/SignSale";
import NotFound from "./pages/NotFound";
import CustomerPortal from "./pages/CustomerPortal";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/** Blocks protected routes — shows spinner then redirects to /auth if no session. */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

/** Shows a spinner / Auth page while session resolves; redirects to dashboard if already signed in. */
function GuestGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <>{children}</>;          // Show auth page instantly
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Root → always land on sign-in */}
      <Route path="/" element={<Navigate to="/auth" replace />} />

      {/* Public pages */}
      <Route path="/auth"                element={<GuestGuard><Auth /></GuestGuard>} />
      <Route path="/portal"              element={<CustomerPortal />} />
      <Route path="/sign/repair/:id"     element={<SignRepair />} />
      <Route path="/sign/customer/:id"   element={<SignCustomer />} />
      <Route path="/sign/inspection/:id" element={<SignInspection />} />
      <Route path="/sign/sale/:id"       element={<SignSale />} />

      {/* Protected pages — inside AuthGuard + AppLayout */}
      <Route path="/*" element={
        <AuthGuard>
          <AppLayout>
            <Routes>
              <Route path="/dashboard"         element={<RoleGuard page="dashboard"><Index /></RoleGuard>} />
              <Route path="/vehicles"          element={<RoleGuard page="vehicles"><VehiclesList /></RoleGuard>} />
              <Route path="/vehicles/new"      element={<RoleGuard page="vehicles"><VehicleForm /></RoleGuard>} />
              <Route path="/vehicles/:id"      element={<RoleGuard page="vehicles"><VehicleDetail /></RoleGuard>} />
              <Route path="/vehicles/:id/edit" element={<RoleGuard page="vehicles"><VehicleForm /></RoleGuard>} />
              <Route path="/customers"         element={<RoleGuard page="customers"><Customers /></RoleGuard>} />
              <Route path="/sales"             element={<RoleGuard page="sales"><Sales /></RoleGuard>} />
              <Route path="/invoices"          element={<RoleGuard page="invoices"><Invoices /></RoleGuard>} />
              <Route path="/inquiries"         element={<RoleGuard page="inquiries"><Inquiries /></RoleGuard>} />
              <Route path="/inspections"       element={<RoleGuard page="inspections"><Inspections /></RoleGuard>} />
              <Route path="/repairs"           element={<RoleGuard page="repairs"><RepairsMaintenance /></RoleGuard>} />
              <Route path="/authority-to-sell" element={<RoleGuard page="authority-to-sell"><AuthorityToSell /></RoleGuard>} />
              {/* Settings — only super_admin can see; RoleGuard handled internally */}
              <Route path="/settings"          element={<Settings />} />
              <Route path="/unauthorized"      element={<Unauthorized />} />
              <Route path="*"                  element={<NotFound />} />
            </Routes>
          </AppLayout>
        </AuthGuard>
      } />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
