import { ReactNode } from "react";
import { usePermissions, PermissionResource, PermissionAction } from "@/contexts/PermissionContext";

interface PermissionGuardProps {
  resource: PermissionResource;
  action: PermissionAction;
  customerId?: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGuard({ 
  resource, 
  action, 
  customerId,
  children, 
  fallback = null 
}: PermissionGuardProps) {
  const { hasPermission, loading } = usePermissions();

  if (loading) {
    return null;
  }

  if (!hasPermission(resource, action, customerId)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
