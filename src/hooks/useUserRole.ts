import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionContext";

export type DashboardType = 
  | 'admin'
  | 'operations'
  | 'dispatcher'
  | 'control-tower'
  | 'fleet'
  | 'driver-coordinator'
  | 'transporter'
  | 'shipper-admin'
  | 'shipper-user'
  | 'support'
  | 'billing'
  | 'route-planner'
  | 'data-entry'
  | 'viewer';

interface UserRoleInfo {
  roleName: string | null;
  dashboardType: DashboardType;
  isLoading: boolean;
}

export function useUserRole(): UserRoleInfo {
  const { user } = useAuth();
  const { isSuperAdmin, hasPermission, loading: permissionsLoading } = usePermissions();

  const { data: roleData, isLoading: roleLoading } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          role,
          custom_role_id,
          roles:custom_role_id(name)
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user role:', error);
        return null;
      }

      return data;
    },
    enabled: !!user
  });

  const getRoleName = (): string | null => {
    if (isSuperAdmin) return 'Super Admin';
    if (roleData?.roles?.name) return roleData.roles.name;
    if (roleData?.role) return roleData.role;
    return null;
  };

  const getDashboardType = (): DashboardType => {
    // SuperAdmin or Admin always gets admin dashboard
    if (isSuperAdmin) return 'admin';
    
    const roleName = roleData?.roles?.name?.toLowerCase() || roleData?.role?.toLowerCase() || '';

    // Map role names to dashboard types
    if (roleName.includes('super admin') || roleName.includes('admin')) return 'admin';
    if (roleName.includes('operations manager')) return 'operations';
    if (roleName.includes('dispatcher')) return 'dispatcher';
    if (roleName.includes('control tower')) return 'control-tower';
    if (roleName.includes('fleet manager')) return 'fleet';
    if (roleName.includes('driver coordinator')) return 'driver-coordinator';
    if (roleName.includes('transporter admin')) return 'transporter';
    if (roleName.includes('shipper admin')) return 'shipper-admin';
    if (roleName.includes('shipper user')) return 'shipper-user';
    if (roleName.includes('customer support')) return 'support';
    if (roleName.includes('billing manager')) return 'billing';
    if (roleName.includes('route planner')) return 'route-planner';
    if (roleName.includes('data entry')) return 'data-entry';
    if (roleName.includes('viewer')) return 'viewer';

    // Fallback: determine by permissions
    if (hasPermission('users', 'manage')) return 'admin';
    if (hasPermission('alerts', 'manage') || hasPermission('exceptions', 'manage')) return 'control-tower';
    if (hasPermission('vehicles', 'manage')) return 'fleet';
    if (hasPermission('drivers', 'manage')) return 'driver-coordinator';
    if (hasPermission('lanes', 'manage')) return 'route-planner';
    if (hasPermission('shipments', 'manage')) return 'operations';
    if (hasPermission('shipments', 'create')) return 'dispatcher';
    
    return 'viewer';
  };

  return {
    roleName: getRoleName(),
    dashboardType: getDashboardType(),
    isLoading: roleLoading || permissionsLoading
  };
}
