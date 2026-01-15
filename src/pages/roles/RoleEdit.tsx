import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Shield } from "lucide-react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RolePermissionMatrix } from "@/components/role/RolePermissionMatrix";
import { StatusToggle } from "@/components/StatusToggle";
import { usePermissions } from "@/contexts/PermissionContext";

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
}

export default function RoleEdit() {
  const { id } = useParams<{ id: string }>();
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isSuperAdmin, loading: permissionsLoading } = usePermissions();

  useEffect(() => {
    if (id && !permissionsLoading) fetchRole();
  }, [id, permissionsLoading]);

  const fetchRole = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data.is_system && !isSuperAdmin) {
        toast({
          title: "Cannot Edit",
          description: "System roles cannot be edited",
          variant: "destructive",
        });
        navigate(`/roles/${id}`);
        return;
      }

      setRole(data);
      setName(data.name);
      setDescription(data.description || "");
      setIsActive(data.is_active ?? true);
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: "Validation Error",
        description: "Role name is required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('roles')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          is_active: isActive,
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Role Updated",
        description: `${name} has been updated`,
      });
      navigate("/roles");
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/roles")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <h1 className="text-2xl font-bold">Edit Role: {role.name}</h1>
              <Badge>Custom</Badge>
            </div>
            <p className="text-muted-foreground">Configure role details and permissions</p>
          </div>
        </div>

        {/* Role Details */}
        <Card>
          <CardHeader>
            <CardTitle>Role Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Role Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Operations Manager"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="pt-2">
                    <StatusToggle
                      isActive={isActive}
                      onToggle={setIsActive}
                      label="Role Status"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this role can do..."
                  rows={2}
                />
              </div>

              <Button type="submit" disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Details"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Permissions Matrix */}
        <RolePermissionMatrix roleId={role.id} isSystemRole={!isSuperAdmin && !!role.is_system} />
      </div>
    </Layout>
  );
}
