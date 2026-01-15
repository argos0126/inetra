import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { DataTable } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Plus, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { StatusToggle } from "@/components/StatusToggle";
import { usePermissions } from "@/contexts/PermissionContext";

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  permissions_count?: number;
  users_count?: number;
}

export default function Roles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isSuperAdmin, hasPermission, loading: permissionsLoading } = usePermissions();

  const canEditSystemRoles = isSuperAdmin || hasPermission('roles', 'manage');

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      // Fetch roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .order('is_system', { ascending: false })
        .order('name');

      if (rolesError) throw rolesError;

      // Fetch permissions count for each role
      const rolesWithCounts: Role[] = [];
      for (const role of rolesData || []) {
        const { count: permCount } = await supabase
          .from('role_permissions')
          .select('*', { count: 'exact', head: true })
          .eq('role_id', role.id);

        const { count: userCount } = await supabase
          .from('user_roles')
          .select('*', { count: 'exact', head: true })
          .eq('custom_role_id', role.id);

        rolesWithCounts.push({
          ...role,
          permissions_count: permCount || 0,
          users_count: userCount || 0,
        });
      }

      setRoles(rolesWithCounts);
    } catch (error: any) {
      console.error("Error fetching roles:", error);
      toast({
        title: "Error loading roles",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (role: Role, newStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('roles')
        .update({ is_active: newStatus })
        .eq('id', role.id);

      if (error) throw error;

      toast({
        title: newStatus ? "Role Activated" : "Role Deactivated",
        description: `${role.name} has been ${newStatus ? "activated" : "deactivated"}`,
      });

      fetchRoles();
    } catch (error: any) {
      console.error("Error updating role status:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const columns = [
    {
      key: "name",
      label: "Role Name",
      render: (value: string, row: Role) => (
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium">{value}</div>
            {row.description && (
              <div className="text-xs text-muted-foreground">{row.description}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "is_system",
      label: "Type",
      render: (value: boolean) => (
        <Badge variant={value ? "secondary" : "default"}>
          {value ? "System" : "Custom"}
        </Badge>
      ),
    },
    {
      key: "is_active",
      label: "Status",
      render: (value: boolean, row: Role) => (
        <StatusToggle
          isActive={value}
          onToggle={(newStatus) => handleStatusChange(row, newStatus)}
          disabled={row.is_system}
          label="Status"
        />
      ),
    },
    {
      key: "permissions_count",
      label: "Permissions",
      render: (value: number) => (
        <span className="text-sm">{value} permissions</span>
      ),
    },
    {
      key: "users_count",
      label: "Users",
      render: (value: number) => (
        <span className="text-sm">{value} users</span>
      ),
    },
    {
      key: "created_at",
      label: "Created",
      render: (value: string) => format(new Date(value), "MMM d, yyyy"),
    },
  ];

  if (loading || permissionsLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Roles & Permissions</h1>
            <p className="text-muted-foreground">Manage user roles and their permissions</p>
          </div>
          <Button onClick={() => navigate("/roles/add")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Role
          </Button>
        </div>

        <DataTable
          title=""
          columns={columns}
          data={roles}
          onView={(role) => navigate(`/roles/${role.id}`)}
          onEdit={(role) => (!role.is_system || canEditSystemRoles) && navigate(`/roles/${role.id}/edit`)}
          searchPlaceholder="Search roles..."
        />
      </div>
    </Layout>
  );
}
