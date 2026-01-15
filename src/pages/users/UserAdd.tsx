import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusToggle } from "@/components/StatusToggle";
import { ArrowLeft, Save, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { getDisplayErrorMessage, logError } from "@/utils/errorHandler";

const userSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  firstName: z.string().trim().min(1, { message: "First name is required" }).max(50),
  lastName: z.string().trim().min(1, { message: "Last name is required" }).max(50),
  role: z.enum(["superadmin", "admin", "user"], { message: "Please select a role" }),
});

interface ValidationErrors {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

export default function UserAdd() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    company: "",
    role: "user",
    customRoleId: "",
    is_active: true,
  });

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    const { data } = await supabase.from("roles").select("id, name, description").order("name");
    if (data) setRoles(data);
  };

  const validateField = (field: string, value: string) => {
    const newErrors = { ...errors };
    
    try {
      const fieldSchema: Record<string, z.ZodType> = {
        email: z.string().trim().email("Invalid email address"),
        password: z.string().min(6, "Password must be at least 6 characters"),
        firstName: z.string().trim().min(1, "First name is required"),
        lastName: z.string().trim().min(1, "Last name is required"),
        role: z.string().min(1, "Role is required"),
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
    
    // Validate all fields
    const validation = userSchema.safeParse({
      email: formData.email.trim(),
      password: formData.password,
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      role: formData.role,
    });
    
    if (!validation.success) {
      const newErrors: ValidationErrors = {};
      validation.error.errors.forEach(err => {
        const field = err.path[0] as keyof ValidationErrors;
        newErrors[field] = err.message;
      });
      setErrors(newErrors);
      setTouched({ email: true, password: true, firstName: true, lastName: true, role: true });
      toast({ title: "Validation Error", description: "Please fix the highlighted errors", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: formData.email.trim(),
          password: formData.password,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          role: formData.role,
          company: formData.company.trim() || null,
          customRoleId: formData.customRoleId || null,
          isActive: formData.is_active,
          sendEmail: true,
        },
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);

      let successMsg = `User created successfully`;
      if (data.linkedEntity) {
        successMsg += ` and linked to ${data.linkedEntity.type}: ${data.linkedEntity.name}`;
      }
      if (data.emailSent) {
        successMsg += `. Welcome email sent.`;
      }
      
      toast({ 
        title: "Success", 
        description: successMsg
      });
      navigate("/users");
    } catch (error: any) {
      logError(error, "UserAdd.handleSubmit");
      toast({ title: "Error", description: getDisplayErrorMessage(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/users")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Add User</h1>
            <p className="text-muted-foreground">Create a new user account</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  <CardTitle>User Information</CardTitle>
                </div>
                <CardDescription>Required fields are marked with *</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <Label>Email *</Label>
                  <Input 
                    type="email"
                    value={formData.email} 
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    onBlur={() => handleFieldBlur('email')}
                    className={errors.email && touched.email ? "border-destructive" : ""}
                    placeholder="Enter email address"
                  />
                  {errors.email && touched.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Password *</Label>
                  <Input 
                    type="password"
                    value={formData.password} 
                    onChange={(e) => handleFieldChange('password', e.target.value)}
                    onBlur={() => handleFieldBlur('password')}
                    className={errors.password && touched.password ? "border-destructive" : ""}
                    placeholder="Min 6 characters"
                  />
                  {errors.password && touched.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
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
                  <Label>Base Role *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
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
                </div>

                <div className="space-y-2">
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
                />
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => navigate("/users")}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                <Save className="mr-2 h-4 w-4" />
                {loading ? "Creating..." : "Create User"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
}