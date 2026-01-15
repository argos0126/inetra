import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { X, Plus } from "lucide-react";

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

interface Customer {
  id: string;
  display_name: string;
}

interface UserRole {
  id: string;
  role: string;
  custom_role_id: string | null;
  customer_id: string | null;
  custom_role?: Role;
  customer?: Customer;
}

interface UserRoleAssignmentProps {
  userId: string;
  readOnly?: boolean;
}

export function UserRoleAssignment({ userId, readOnly = false }: UserRoleAssignmentProps) {
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch user's current roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('id, role, custom_role_id, customer_id')
        .eq('user_id', userId);

      if (rolesError) throw rolesError;

      // Fetch custom role details for each user role
      const userRolesWithDetails: UserRole[] = [];
      for (const ur of rolesData || []) {
        let customRole: Role | undefined;
        let customer: Customer | undefined;

        if (ur.custom_role_id) {
          const { data: roleData } = await supabase
            .from('roles')
            .select('id, name, description, is_system')
            .eq('id', ur.custom_role_id)
            .single();
          customRole = roleData || undefined;
        }

        if (ur.customer_id) {
          const { data: customerData } = await supabase
            .from('customers')
            .select('id, display_name')
            .eq('id', ur.customer_id)
            .single();
          customer = customerData || undefined;
        }

        userRolesWithDetails.push({
          ...ur,
          custom_role: customRole,
          customer,
        });
      }

      setUserRoles(userRolesWithDetails);

      // Fetch all available roles
      const { data: allRoles, error: allRolesError } = await supabase
        .from('roles')
        .select('id, name, description, is_system')
        .order('name');

      if (allRolesError) throw allRolesError;
      setAvailableRoles(allRoles || []);

      // Fetch customers for scoping
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, display_name')
        .eq('is_active', true)
        .order('display_name');

      if (customersError) throw customersError;
      setCustomers(customersData || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load user roles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addRole = async () => {
    if (!selectedRole) return;

    setAdding(true);
    try {
      // Get the selected role to determine the base role type
      const role = availableRoles.find(r => r.id === selectedRole);
      if (!role) return;

      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'user', // Default base role
          custom_role_id: selectedRole,
          customer_id: selectedCustomer || null,
        });

      if (error) throw error;

      toast({
        title: "Role Added",
        description: `${role.name} has been assigned to this user`,
      });

      setSelectedRole("");
      setSelectedCustomer("");
      fetchData();
    } catch (error: any) {
      console.error('Error adding role:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add role",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const removeRole = async (userRoleId: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', userRoleId);

      if (error) throw error;

      toast({
        title: "Role Removed",
        description: "The role has been removed from this user",
      });

      fetchData();
    } catch (error: any) {
      console.error('Error removing role:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove role",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assigned Roles</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Roles */}
        <div className="space-y-2">
          {userRoles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No custom roles assigned</p>
          ) : (
            userRoles.map(ur => (
              <div key={ur.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Badge variant={ur.custom_role?.is_system ? "secondary" : "default"}>
                    {ur.custom_role?.name || ur.role}
                  </Badge>
                  {ur.customer && (
                    <span className="text-sm text-muted-foreground">
                      (Scoped to: {ur.customer.display_name})
                    </span>
                  )}
                </div>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRole(ur.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add Role Form */}
        {!readOnly && (
          <div className="flex items-end gap-2 pt-4 border-t">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">Role</label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map(role => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                      {role.is_system && " (System)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">Scope to Customer (Optional)</label>
              <Select 
                value={selectedCustomer || "__all__"} 
                onValueChange={(val) => setSelectedCustomer(val === "__all__" ? "" : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All customers</SelectItem>
                  {customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addRole} disabled={adding || !selectedRole}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
