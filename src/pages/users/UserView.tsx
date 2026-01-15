import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, User, Building2, Calendar, Edit, KeyRound, Mail } from "lucide-react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { StatusToggle } from "@/components/StatusToggle";
import { UserRoleAssignment } from "@/components/role/UserRoleAssignment";
import { ResetPasswordDialog } from "@/components/user/ResetPasswordDialog";
import { format } from "date-fns";

interface UserProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  is_active: boolean;
  created_at: string;
}

interface UserRole {
  role: string;
}

const roleLabels: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  user: "User",
};

const roleColors: Record<string, string> = {
  superadmin: "bg-red-600",
  admin: "bg-blue-600",
  user: "bg-green-600",
};

export default function UserView() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [baseRole, setBaseRole] = useState<string>("user");
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [resetPasswordDialog, setResetPasswordDialog] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) fetchUser();
  }, [id]);

  const fetchUser = async () => {
    setLoading(true);
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch user email via edge function
      const { data: emailData } = await supabase.functions.invoke("get-user-email", {
        body: { userId: profileData.user_id }
      });
      if (emailData?.email) {
        setEmail(emailData.email);
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', profileData.user_id)
        .single();

      if (roleData) {
        setBaseRole(roleData.role);
      }
    } catch (error: any) {
      console.error("Error fetching user:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      navigate("/users");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async (active: boolean) => {
    if (!profile) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: active })
        .eq('id', profile.id);

      if (error) throw error;

      setProfile({ ...profile, is_active: active });
      toast({
        title: "Status Updated",
        description: `User is now ${active ? 'active' : 'inactive'}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleResetPassword = async (newPassword: string) => {
    if (!profile) return;
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-user-password", {
        body: { userId: profile.user_id, newPassword }
      });
      
      if (error) throw error;

      toast({
        title: "Password Reset",
        description: `Password has been reset successfully`,
      });
      setResetPasswordDialog(false);
    } catch (error: any) {
      toast({
        title: "Reset Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  };

  if (loading || !profile) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  const displayName = profile.first_name || profile.last_name
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : 'Unnamed User';

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/users")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5" />
                <h1 className="text-2xl font-bold">{displayName}</h1>
                <Badge className={roleColors[baseRole] || "bg-gray-600"}>
                  {roleLabels[baseRole] || baseRole}
                </Badge>
                <Badge variant={profile.is_active ? "default" : "secondary"}>
                  {profile.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-muted-foreground">User ID: {profile.user_id.slice(0, 8)}...</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setResetPasswordDialog(true)}>
              <KeyRound className="h-4 w-4 mr-2" />
              Reset Password
            </Button>
            <Button onClick={() => navigate(`/users/${id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>User Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-sm text-muted-foreground">Name</span>
                  <p className="font-medium">{displayName}</p>
                </div>
              </div>
              {email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-sm text-muted-foreground">Email</span>
                    <p className="font-medium">{email}</p>
                  </div>
                </div>
              )}
              {profile.company && (
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-sm text-muted-foreground">Company</span>
                    <p className="font-medium">{profile.company}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-sm text-muted-foreground">Member Since</span>
                  <p className="font-medium">{format(new Date(profile.created_at), "PPP")}</p>
                </div>
              </div>
              <div className="pt-4 border-t">
                <StatusToggle
                  isActive={profile.is_active}
                  onToggle={handleStatusToggle}
                  label="Account Status"
                  disabled={updating}
                />
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2">
            <UserRoleAssignment userId={profile.user_id} />
          </div>
        </div>
      </div>

      <ResetPasswordDialog
        open={resetPasswordDialog}
        onOpenChange={setResetPasswordDialog}
        userName={displayName}
        onConfirm={handleResetPassword}
        isLoading={resetting}
      />
    </Layout>
  );
}
