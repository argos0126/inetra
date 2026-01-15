import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PermissionResource = 
  | 'shipments' | 'trips' | 'customers' | 'drivers' | 'vehicles'
  | 'transporters' | 'locations' | 'materials' | 'lanes'
  | 'tracking_assets' | 'alerts' | 'exceptions' | 'reports'
  | 'users' | 'roles' | 'settings' | 'consents';

export type PermissionAction = 'view' | 'create' | 'update' | 'delete' | 'manage';

interface Permission {
  resource: PermissionResource;
  action: PermissionAction;
  customer_id: string | null;
}

interface PermissionContextType {
  permissions: Permission[];
  loading: boolean;
  isSuperAdmin: boolean;
  hasPermission: (resource: PermissionResource, action: PermissionAction, customerId?: string) => boolean;
  refetchPermissions: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const fetchPermissions = async () => {
    if (!user) {
      setPermissions([]);
      setLoading(false);
      setIsSuperAdmin(false);
      return;
    }

    try {
      // Check if user is superadmin
      const { data: superAdminData } = await supabase
        .rpc('is_superadmin', { _user_id: user.id });
      
      setIsSuperAdmin(!!superAdminData);

      // If superadmin, they have all permissions
      if (superAdminData) {
        setPermissions([]);
        setLoading(false);
        return;
      }

      // Fetch user permissions from the function
      const { data, error } = await supabase
        .rpc('get_user_permissions', { _user_id: user.id });

      if (error) {
        console.error('Error fetching permissions:', error);
        setPermissions([]);
      } else {
        setPermissions(data || []);
      }
    } catch (error) {
      console.error('Error in fetchPermissions:', error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [user]);

  const hasPermission = (
    resource: PermissionResource, 
    action: PermissionAction, 
    customerId?: string
  ): boolean => {
    // Superadmins have all permissions
    if (isSuperAdmin) return true;

    // Check if user has the permission
    return permissions.some(p => 
      p.resource === resource && 
      p.action === action &&
      (p.customer_id === null || p.customer_id === customerId)
    );
  };

  return (
    <PermissionContext.Provider value={{ 
      permissions, 
      loading, 
      isSuperAdmin,
      hasPermission, 
      refetchPermissions: fetchPermissions 
    }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
}
