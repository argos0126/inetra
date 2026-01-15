import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/LoadingSpinner";

const RESOURCES = [
  { key: 'shipments', label: 'Shipments' },
  { key: 'trips', label: 'Trips' },
  { key: 'customers', label: 'Customers' },
  { key: 'drivers', label: 'Drivers' },
  { key: 'vehicles', label: 'Vehicles' },
  { key: 'transporters', label: 'Transporters' },
  { key: 'locations', label: 'Locations' },
  { key: 'materials', label: 'Materials' },
  { key: 'lanes', label: 'Lanes' },
  { key: 'tracking_assets', label: 'Tracking Assets' },
  { key: 'alerts', label: 'Alerts' },
  { key: 'exceptions', label: 'Exceptions' },
  { key: 'reports', label: 'Reports' },
  { key: 'users', label: 'Users' },
  { key: 'roles', label: 'Roles' },
  { key: 'settings', label: 'Settings' },
] as const;

const ACTIONS = [
  { key: 'view', label: 'View' },
  { key: 'create', label: 'Create' },
  { key: 'update', label: 'Update' },
  { key: 'delete', label: 'Delete' },
  { key: 'manage', label: 'Manage' },
] as const;

type ResourceKey = typeof RESOURCES[number]['key'];
type ActionKey = typeof ACTIONS[number]['key'];

interface RolePermission {
  id: string;
  resource: ResourceKey;
  action: ActionKey;
}

interface RolePermissionMatrixProps {
  roleId: string;
  isSystemRole?: boolean;
  readOnly?: boolean;
}

export function RolePermissionMatrix({ roleId, isSystemRole = false, readOnly = false }: RolePermissionMatrixProps) {
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPermissions();
  }, [roleId]);

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('id, resource, action')
        .eq('role_id', roleId);

      if (error) throw error;
      setPermissions(data as RolePermission[] || []);
    } catch (error: any) {
      console.error('Error fetching permissions:', error);
      toast({
        title: "Error",
        description: "Failed to load permissions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (resource: ResourceKey, action: ActionKey): boolean => {
    return permissions.some(p => p.resource === resource && p.action === action);
  };

  const togglePermission = async (resource: ResourceKey, action: ActionKey) => {
    if (readOnly || isSystemRole) return;

    const existing = permissions.find(p => p.resource === resource && p.action === action);

    try {
      if (existing) {
        // Remove permission
        const { error } = await supabase
          .from('role_permissions')
          .delete()
          .eq('id', existing.id);

        if (error) throw error;
        setPermissions(prev => prev.filter(p => p.id !== existing.id));
      } else {
        // Add permission
        const { data, error } = await supabase
          .from('role_permissions')
          .insert({ role_id: roleId, resource, action })
          .select()
          .single();

        if (error) throw error;
        setPermissions(prev => [...prev, data as RolePermission]);
      }
    } catch (error: any) {
      console.error('Error toggling permission:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update permission",
        variant: "destructive",
      });
    }
  };

  const selectAllForResource = async (resource: ResourceKey) => {
    if (readOnly || isSystemRole) return;
    setSaving(true);

    try {
      const existingForResource = permissions.filter(p => p.resource === resource);
      const missingActions = ACTIONS.filter(a => !existingForResource.some(p => p.action === a.key));

      if (missingActions.length > 0) {
        const { data, error } = await supabase
          .from('role_permissions')
          .insert(missingActions.map(a => ({ role_id: roleId, resource, action: a.key })))
          .select();

        if (error) throw error;
        setPermissions(prev => [...prev, ...(data as RolePermission[])]);
      }
    } catch (error: any) {
      console.error('Error selecting all:', error);
      toast({
        title: "Error",
        description: "Failed to update permissions",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const clearAllForResource = async (resource: ResourceKey) => {
    if (readOnly || isSystemRole) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId)
        .eq('resource', resource);

      if (error) throw error;
      setPermissions(prev => prev.filter(p => p.resource !== resource));
    } catch (error: any) {
      console.error('Error clearing permissions:', error);
      toast({
        title: "Error",
        description: "Failed to clear permissions",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const selectAllView = async () => {
    if (readOnly || isSystemRole) return;
    setSaving(true);

    try {
      const missingViews = RESOURCES.filter(r => !permissions.some(p => p.resource === r.key && p.action === 'view'));
      
      if (missingViews.length > 0) {
        const { data, error } = await supabase
          .from('role_permissions')
          .insert(missingViews.map(r => ({ role_id: roleId, resource: r.key, action: 'view' as ActionKey })))
          .select();

        if (error) throw error;
        setPermissions(prev => [...prev, ...(data as RolePermission[])]);
      }
    } catch (error: any) {
      console.error('Error selecting all view:', error);
      toast({
        title: "Error",
        description: "Failed to update permissions",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Permissions Matrix</CardTitle>
        {!readOnly && !isSystemRole && (
          <Button variant="outline" size="sm" onClick={selectAllView} disabled={saving}>
            Select All View
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isSystemRole && (
          <div className="text-sm text-muted-foreground mb-4 p-3 bg-muted rounded-lg">
            System roles cannot be modified. Create a custom role to customize permissions.
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 font-medium">Resource</th>
                {ACTIONS.map(action => (
                  <th key={action.key} className="text-center p-3 font-medium min-w-[80px]">
                    {action.label}
                  </th>
                ))}
                {!readOnly && !isSystemRole && (
                  <th className="text-center p-3 font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {RESOURCES.map(resource => (
                <tr key={resource.key} className="border-b hover:bg-muted/50">
                  <td className="p-3 font-medium">{resource.label}</td>
                  {ACTIONS.map(action => (
                    <td key={action.key} className="text-center p-3">
                      <Checkbox
                        checked={hasPermission(resource.key, action.key)}
                        onCheckedChange={() => togglePermission(resource.key, action.key)}
                        disabled={readOnly || isSystemRole || saving}
                      />
                    </td>
                  ))}
                  {!readOnly && !isSystemRole && (
                    <td className="text-center p-3 space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => selectAllForResource(resource.key)}
                        disabled={saving}
                        className="text-xs"
                      >
                        All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => clearAllForResource(resource.key)}
                        disabled={saving}
                        className="text-xs"
                      >
                        None
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
