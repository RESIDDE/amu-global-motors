import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { canAccess, PageKey } from "@/lib/permissions";
import type { AppRole } from "@/lib/permissions";

interface RoleGuardProps {
  page: PageKey;
  children: React.ReactNode;
}

/**
 * Wraps a protected route. If the user's role doesn't have permission
 * for this page, redirects to /unauthorized.
 */
export function RoleGuard({ page, children }: RoleGuardProps) {
  const { role, isLoading } = useAuth();

  // Still resolving auth — let it through (AuthGuard already verified session)
  if (isLoading) return <>{children}</>;

  if (!canAccess(role as AppRole | null, page)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
