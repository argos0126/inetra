import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusToggle } from "@/components/StatusToggle";
import { ArrowLeft, Save, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AddressAutocomplete, type PlaceData } from "@/components/location/LocationSearchMap";
import { 
  isValidEmail, 
  isValidMobile, 
  isValidGST, 
  isValidPAN,
  checkUniqueTransporterCode,
  checkUniqueTransporterGSTIN,
  checkUniqueTransporterPAN,
  checkUniqueTransporterEmail,
  checkUniqueTransporterMobile
} from "@/utils/validationUtils";
import { getDisplayErrorMessage, logError } from "@/utils/errorHandler";

export default function TransporterAdd() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const createLoginAccount = true; // Always create login account
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    transporter_name: "",
    code: "",
    email: "",
    mobile: "",
    company: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    latitude: null as number | null,
    longitude: null as number | null,
    gstin: "",
    pan: "",
    is_active: true
  });

  const validateField = (field: string, value: string): string => {
    switch (field) {
      case "email":
        if (createLoginAccount && !value) return "Email is required for login account";
        return value && !isValidEmail(value) ? "Invalid email format" : "";
      case "mobile":
        return value && !isValidMobile(value) ? "Invalid mobile number (10 digits starting with 6-9)" : "";
      case "gstin":
        return value && !isValidGST(value) ? "Invalid GST format (e.g., 22AAAAA0000A1Z5)" : "";
      case "pan":
        return value && !isValidPAN(value) ? "Invalid PAN format (e.g., ABCDE1234F)" : "";
      default:
        return "";
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    const error = validateField(field, value);
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const handlePlaceSelect = (data: PlaceData) => {
    setFormData(prev => ({
      ...prev,
      address: data.address,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      latitude: data.latitude,
      longitude: data.longitude,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.transporter_name.trim()) {
      toast({ title: "Error", description: "Transporter name is required", variant: "destructive" });
      return;
    }

    // Validate email if creating login account
    if (createLoginAccount && !formData.email) {
      setErrors(prev => ({ ...prev, email: "Email is required for login account" }));
      toast({ title: "Validation Error", description: "Email is required to create a login account", variant: "destructive" });
      return;
    }

    // Validate fields
    const newErrors: Record<string, string> = {};
    ["email", "mobile", "gstin", "pan"].forEach(field => {
      const error = validateField(field, formData[field as keyof typeof formData] as string);
      if (error) newErrors[field] = error;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({ title: "Validation Error", description: "Please fix the highlighted errors", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Check for duplicates including email and mobile
      const [codeUnique, gstinUnique, panUnique, emailUnique, mobileUnique] = await Promise.all([
        formData.code.trim() ? checkUniqueTransporterCode(formData.code.trim()) : Promise.resolve(true),
        formData.gstin.trim() ? checkUniqueTransporterGSTIN(formData.gstin.trim()) : Promise.resolve(true),
        formData.pan.trim() ? checkUniqueTransporterPAN(formData.pan.trim()) : Promise.resolve(true),
        formData.email.trim() ? checkUniqueTransporterEmail(formData.email.trim()) : Promise.resolve(true),
        formData.mobile.trim() ? checkUniqueTransporterMobile(formData.mobile.trim()) : Promise.resolve(true)
      ]);

      const duplicateErrors: string[] = [];
      if (!codeUnique) duplicateErrors.push("Transporter code already exists");
      if (!gstinUnique) duplicateErrors.push("GSTIN already exists");
      if (!panUnique) duplicateErrors.push("PAN already exists");
      if (!emailUnique) duplicateErrors.push("Email already exists");
      if (!mobileUnique) duplicateErrors.push("Mobile number already exists");

      if (duplicateErrors.length > 0) {
        toast({ 
          title: "Duplicate Entry", 
          description: duplicateErrors.join(", "), 
          variant: "destructive" 
        });
        setLoading(false);
        return;
      }

      const { data: transporterData, error } = await supabase.from("transporters").insert({
        transporter_name: formData.transporter_name.trim(),
        code: formData.code || null,
        email: formData.email || null,
        mobile: formData.mobile || null,
        company: formData.company || null,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        pincode: formData.pincode || null,
        latitude: formData.latitude,
        longitude: formData.longitude,
        gstin: formData.gstin?.toUpperCase() || null,
        pan: formData.pan?.toUpperCase() || null,
        is_active: formData.is_active
      }).select().single();

      if (error) throw error;

      // Create login account if checkbox is checked
      if (createLoginAccount && formData.email && transporterData) {
        const { data: userResult, error: userError } = await supabase.functions.invoke("create-entity-user", {
          body: {
            email: formData.email,
            entityType: "transporter",
            entityId: transporterData.id,
            firstName: formData.transporter_name.split(" ")[0],
            lastName: formData.transporter_name.split(" ").slice(1).join(" ") || "",
            roleName: "Transporter Admin"
          }
        });

        if (userError) {
          logError(userError, "TransporterAdd - CreateUserAccount");
          toast({ 
            title: "Warning", 
            description: "Transporter created but login account creation failed. Please contact administrator.",
            variant: "destructive" 
          });
        } else {
          toast({ 
            title: "Success", 
            description: "Transporter created with login account (Transporter Admin role)" 
          });
          navigate("/transporters");
          return;
        }
      }

      toast({ title: "Success", description: "Transporter created successfully" });
      navigate("/transporters");
    } catch (error: any) {
      logError(error, "TransporterAdd");
      toast({ title: "Error", description: getDisplayErrorMessage(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/transporters")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Add Transporter</h1>
            <p className="text-muted-foreground">Create a new transporter record</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="transporter_name">Transporter Name *</Label>
                  <Input
                    id="transporter_name"
                    value={formData.transporter_name}
                    onChange={(e) => setFormData({ ...formData, transporter_name: e.target.value })}
                    placeholder="Enter transporter name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Enter code"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Enter company name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleFieldChange("email", e.target.value)}
                    className={errors.email ? "border-destructive" : ""}
                    placeholder="Enter email"
                    required={createLoginAccount}
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile">Mobile</Label>
                  <Input
                    id="mobile"
                    value={formData.mobile}
                    onChange={(e) => handleFieldChange("mobile", e.target.value)}
                    className={errors.mobile ? "border-destructive" : ""}
                    placeholder="Enter mobile number"
                  />
                  {errors.mobile && <p className="text-sm text-destructive">{errors.mobile}</p>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Address Details</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Address (Search to auto-fill)</Label>
                  <AddressAutocomplete
                    defaultValue={formData.address}
                    onPlaceSelect={handlePlaceSelect}
                    placeholder="Type to search for an address..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Enter city"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="Enter state"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    placeholder="Enter pincode"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tax Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gstin">GSTIN</Label>
                  <Input
                    id="gstin"
                    value={formData.gstin}
                    onChange={(e) => handleFieldChange("gstin", e.target.value.toUpperCase())}
                    className={errors.gstin ? "border-destructive" : ""}
                    placeholder="Enter GSTIN"
                  />
                  {errors.gstin && <p className="text-sm text-destructive">{errors.gstin}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pan">PAN</Label>
                  <Input
                    id="pan"
                    value={formData.pan}
                    onChange={(e) => handleFieldChange("pan", e.target.value.toUpperCase())}
                    className={errors.pan ? "border-destructive" : ""}
                    placeholder="Enter PAN"
                  />
                  {errors.pan && <p className="text-sm text-destructive">{errors.pan}</p>}
                </div>
              </CardContent>
            </Card>

            {/* Login Account Info Card */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  Login Account
                </CardTitle>
                <CardDescription>
                  A login account with <span className="font-semibold text-primary">Transporter Admin</span> role will be created for this transporter
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  A temporary password will be generated and a password reset email will be sent to the transporter's email address.
                </p>
              </CardContent>
            </Card>

            <StatusToggle
              isActive={formData.is_active}
              onToggle={(value) => setFormData({ ...formData, is_active: value })}
            />

            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={() => navigate("/transporters")}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                {loading ? "Saving..." : "Save Transporter"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
}