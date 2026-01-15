import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusToggle } from "@/components/StatusToggle";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ArrowLeft, Save, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const userSchema = z.object({
  firstName: z.string().trim().min(1, { message: "First name is required" }).max(50),
  lastName: z.string().trim().min(1, { message: "Last name is required" }).max(50),
});

interface ValidationErrors {
  firstName?: string;
  lastName?: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

export default function UserEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [originalRole, setOriginalRole] = useState<string>("user");
  const [superadminCount, setSuperadminCount] = useState<number>(0);
  const [originalIsActive, setOriginalIsActive] = useState<boolean>(true);
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    company: "",
    role: "user",
    customRoleId: "",
    is_active: true,
  });

  const isLastSuperadmin = originalRole === 'superadmin' && superadminCount <= 1;

  // Check if user has ongoing trips/shipments
  const checkOngoingWork = async (userIdToCheck: string): Promise<{ hasOngoing: boolean; message: string }> => {
    try {
      // Check if user is a driver with ongoing trips
      const { data: driver } = await supabase
        .from("drivers")
        .select("id")
        .eq("user_id", userIdToCheck)
        .maybeSingle();

      if (driver) {
        const { count: driverTrips } = await supabase
          .from("trips")
          .select("id", { count: "exact", head: true })
          .eq("driver_id", driver.id)
          .in("status", ["created", "ongoing"]);

        if (driverTrips && driverTrips > 0) {
          return { hasOngoing: true, message: `User has ${driverTrips} ongoing trip(s) as a driver` };
        }
      }

      // Check if user is linked to a customer with ongoing shipments/trips
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("user_id", userIdToCheck)
        .maybeSingle();

      if (customer) {
        const { count: customerTrips } = await supabase
          .from("trips")
          .select("id", { count: "exact", head: true })
          .eq("customer_id", customer.id)
          .in("status", ["created", "ongoing"]);

        if (customerTrips && customerTrips > 0) {
          return { hasOngoing: true, message: `User has ${customerTrips} ongoing trip(s) as a customer` };
        }

        const { count: customerShipments } = await supabase
          .from("shipments")
          .select("id", { count: "exact", head: true })
          .eq("customer_id", customer.id)
          .in("status", ["created", "confirmed", "mapped", "in_pickup", "in_transit", "out_for_delivery"]);

        if (customerShipments && customerShipments > 0) {
          return { hasOngoing: true, message: `User has ${customerShipments} ongoing shipment(s) as a customer` };
        }
      }

      // Check if user is linked to a transporter with ongoing trips
      const { data: transporter } = await supabase
        .from("transporters")
        .select("id")
        .eq("user_id", userIdToCheck)
        .maybeSingle();

      if (transporter) {
        const { count: transporterTrips } = await supabase
          .from("trips")
          .select("id", { count: "exact", head: true })
          .eq("transporter_id", transporter.id)
          .in("status", ["created", "ongoing"]);

        if (transporterTrips && transporterTrips > 0) {
          return { hasOngoing: true, message: `User has ${transporterTrips} ongoing trip(s) as a transporter` };
        }
      }

      return { hasOngoing: false, message: "" };
    } catch (error) {
      console.error("Error checking ongoing work:", error);
      return { hasOngoing: false, message: "" };
    }
  };

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [profileRes, rolesRes, superadminCountRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).single(),
        supabase.from("roles").select("id, name, description").order("name"),
        supabase.from("user_roles").select("id", { count: 'exact' }).eq("role", "superadmin")
      ]);

      if (profileRes.error) throw profileRes.error;
      if (!profileRes.data) {
        navigate("/users");
        return;
      }

      const profile = profileRes.data;
      setUserId(profile.user_id);
      setSuperadminCount(superadminCountRes.count || 0);

      // Fetch user email via edge function
      const { data: emailData } = await supabase.functions.invoke("get-user-email", {
        body: { userId: profile.user_id }
      });
      if (emailData?.email) {
        setEmail(emailData.email);
      }

      // Fetch user role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role, custom_role_id")
        .eq("user_id", profile.user_id)
        .single();

      const currentRole = roleData?.role || "user";
      setOriginalRole(currentRole);
      setOriginalIsActive(profile.is_active ?? true);

      setFormData({
        firstName: profile.first_name || "",
        lastName: profile.last_name || "",
        company: profile.company || "",
        role: currentRole,
        customRoleId: roleData?.custom_role_id || "",
        is_active: profile.is_active ?? true,
      });

      if (rolesRes.data) setRoles(rolesRes.data);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      navigate("/users");
    } finally {
      setLoading(false);
    }
  };

  const validateField = (field: string, value: string) => {
    const newErrors = { ...errors };
    
    try {
      const fieldSchema: Record<string, z.ZodType> = {
        firstName: z.string().trim().min(1, "First name is required"),
        lastName: z.string().trim().min(1, "Last name is required"),
      };
      
      if (fieldSchema[field]) {
        fieldSchema[field].parse(value);
        delete newErrors[field as keyof ValidationErrors];
      }
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors[field as keyof ValidationErrors] = e.errors[0].message;
      }
    }
    
    setErrors(newErrors);
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (touched[field]) {
      validateField(field, value);
    }
  };

  const handleFieldBlur = (field: string) => {
    setTouched({ ...touched, [field]: true });
    validateField(field, formData[field as keyof typeof formData] as string);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent demoting the last superadmin
    if (isLastSuperadmin && formData.role !== 'superadmin') {
      toast({ 
        title: "Action Not Allowed", 
        description: "Cannot demote the last superadmin. Promote another user to superadmin first.", 
        variant: "destructive" 
      });
      return;
    }

    // Prevent deactivating the last superadmin
    if (isLastSuperadmin && !formData.is_active) {
      toast({ 
        title: "Action Not Allowed", 
        description: "Cannot deactivate the last superadmin.", 
        variant: "destructive" 
      });
      return;
    }

    // Check for ongoing work when deactivating
    if (originalIsActive && !formData.is_active && userId) {
      const { hasOngoing, message } = await checkOngoingWork(userId);
      if (hasOngoing) {
        toast({ 
          title: "Action Not Allowed", 
          description: `Cannot deactivate user. ${message}. Complete or reassign them first.`, 
          variant: "destructive" 
        });
        return;
      }
    }
    
    // Validate all fields
    const validation = userSchema.safeParse({
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
    });
    
    if (!validation.success) {
      const newErrors: ValidationErrors = {};
      validation.error.errors.forEach(err => {
        const field = err.path[0] as keyof ValidationErrors;
        newErrors[field] = err.message;
      });
      setErrors(newErrors);
      setTouched({ firstName: true, lastName: true });
      toast({ title: "Validation Error", description: "Please fix the highlighted errors", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          company: formData.company.trim() || null,
          is_active: formData.is_active,
        })
        .eq("id", id);

      if (profileError) throw profileError;

      // Update user role if userId is available
      if (userId) {
        // Delete existing roles for this user first
        const { error: deleteError } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId);

        if (deleteError) throw deleteError;

        // Insert the new role
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: userId,
            role: formData.role as any,
            custom_role_id: formData.customRoleId || null,
          });

        if (roleError) throw roleError;
      }

      toast({ title: "Success", description: "User updated successfully" });
      navigate(`/users/${id}`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/users/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Edit User</h1>
            <p className="text-muted-foreground">Update user details</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  <CardTitle>User Information</CardTitle>
                </div>
                <CardDescription>Required fields are marked with *</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input 
                    value={email} 
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Company</Label>
                  <Input 
                    value={formData.company} 
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Enter company name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input 
                    value={formData.firstName} 
                    onChange={(e) => handleFieldChange('firstName', e.target.value)}
                    onBlur={() => handleFieldBlur('firstName')}
                    className={errors.firstName && touched.firstName ? "border-destructive" : ""}
                    placeholder="Enter first name"
                  />
                  {errors.firstName && touched.firstName && (
                    <p className="text-sm text-destructive">{errors.firstName}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label>Last Name *</Label>
                  <Input 
                    value={formData.lastName} 
                    onChange={(e) => handleFieldChange('lastName', e.target.value)}
                    onBlur={() => handleFieldBlur('lastName')}
                    className={errors.lastName && touched.lastName ? "border-destructive" : ""}
                    placeholder="Enter last name"
                  />
                  {errors.lastName && touched.lastName && (
                    <p className="text-sm text-destructive">{errors.lastName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Base Role *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                    disabled={isLastSuperadmin}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="superadmin">Super Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  {isLastSuperadmin && (
                    <p className="text-sm text-muted-foreground">
                      Cannot change role - this is the only superadmin
                    </p>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Custom Role (Optional)</Label>
                  <Select
                    value={formData.customRoleId}
                    onValueChange={(value) => setFormData({ ...formData, customRoleId: value === "__none__" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select custom role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {roles.map(role => (
                        <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusToggle
                  isActive={formData.is_active}
                  onToggle={(active) => setFormData({ ...formData, is_active: active })}
                  label="Account Status"
                  disabled={isLastSuperadmin && formData.is_active}
                />
                {isLastSuperadmin && formData.is_active && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Cannot deactivate - this is the only superadmin
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => navigate(`/users/${id}`)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
}