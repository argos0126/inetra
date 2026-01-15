import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Edit, Shield, Users } from "lucide-react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RolePermissionMatrix } from "@/components/role/RolePermissionMatrix";
import { format } from "date-fns";
import { usePermissions } from "@/contexts/PermissionContext";

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

interface UserWithRole {
  id: string;
  user_id: string;
  customer_id: string | null;
  profile?: {
    first_name: string | null;
    last_name: string | null;
  };
  customer?: {
    display_name: string;
  };
}

export default function RoleView() {
  const { id } = useParams<{ id: string }>();
  const [role, setRole] = useState<Role | null>(null);
  const [usersWithRole, setUsersWithRole] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isSuperAdmin, hasPermission, loading: permissionsLoading } = usePermissions();

  const canEditSystemRoles = isSuperAdmin || hasPermission('roles', 'manage');

  useEffect(() => {
    if (id) fetchRole();
  }, [id]);

  const fetchRole = async () => {
    setLoading(true);
    try {
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('*')
        .eq('id', id)
        .single();

      if (roleError) throw roleError;
      setRole(roleData);

      // Fetch users with this role
      const { data: userRolesData, error: userRolesError } = await supabase
        .from('user_roles')
        .select('id, user_id, customer_id')
        .eq('custom_role_id', id);

      if (userRolesError) throw userRolesError;

      // Fetch profile and customer details for each user role
      const usersWithDetails: UserWithRole[] = [];
      for (const ur of userRolesData || []) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', ur.user_id)
          .single();

        let customer;
        if (ur.customer_id) {
          const { data: customerData } = await supabase
            .from('customers')
            .select('display_name')
            .eq('id', ur.customer_id)
            .single();
          customer = customerData || undefined;
        }

        usersWithDetails.push({
          ...ur,
          profile: profileData || undefined,
          customer,
        });
      }

      setUsersWithRole(usersWithDetails);
    } catch (error: any) {
      console.error("Error fetching role:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      navigate("/roles");
    } finally {
      setLoading(false);
    }
  };

  if (loading || permissionsLoading || !role) {
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/roles")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <h1 className="text-2xl font-bold">{role.name}</h1>
                <Badge variant={role.is_system ? "secondary" : "default"}>
                  {role.is_system ? "System" : "Custom"}
                </Badge>
              </div>
              {role.description && (
                <p className="text-muted-foreground">{role.description}</p>
              )}
            </div>
          </div>
          {(!role.is_system || canEditSystemRoles) && (
            <Button onClick={() => navigate(`/roles/${id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Role
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Role Info */}
          <Card>
            <CardHeader>
              <CardTitle>Role Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-sm text-muted-foreground">Created</span>
                <p className="font-medium">{format(new Date(role.created_at), "PPP")}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Last Updated</span>
                <p className="font-medium">{format(new Date(role.updated_at), "PPP")}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Users with this role</span>
                <p className="font-medium">{usersWithRole.length}</p>
              </div>
            </CardContent>
          </Card>

          {/* Users with this role */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Assigned Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              {usersWithRole.length === 0 ? (
                <p className="text-sm text-muted-foreground">No users assigned to this role</p>
              ) : (
                <div className="space-y-2">
                  {usersWithRole.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <span className="font-medium">
                          {user.profile?.first_name || user.profile?.last_name
                            ? `${user.profile.first_name || ''} ${user.profile.last_name || ''}`.trim()
                            : 'Unknown User'}
                        </span>
                        {user.customer && (
                          <span className="text-sm text-muted-foreground ml-2">
                            (Scoped to: {user.customer.display_name})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Permissions Matrix */}
        <RolePermissionMatrix roleId={role.id} isSystemRole={role.is_system} readOnly />
      </div>
    </Layout>
  );
}
