import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusToggle } from "@/components/StatusToggle";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ArrowLeft, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { isValidEmail, isValidMobile, isValidGST, isValidPAN, checkUniqueCustomerCode, checkUniqueCustomerEmail, checkUniquePhone } from "@/utils/validationUtils";
import { AddressAutocomplete, type PlaceData } from "@/components/location/LocationSearchMap";
import { getDisplayErrorMessage, logError } from "@/utils/errorHandler";

export default function CustomerEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    display_name: "",
    company_name: "",
    email: "",
    phone: "",
    gst_number: "",
    pan_number: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    latitude: null as number | null,
    longitude: null as number | null,
    integration_code: "",
    is_active: true
  });

  useEffect(() => {
    if (id) fetchCustomer();
  }, [id]);

  const fetchCustomer = async () => {
    try {
      const { data, error } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) { navigate("/customers"); return; }
      setFormData({
        display_name: data.display_name || "",
        company_name: data.company_name || "",
        email: data.email || "",
        phone: data.phone || "",
        gst_number: data.gst_number || "",
        pan_number: data.pan_number || "",
        address: data.address || "",
        city: data.city || "",
        state: data.state || "",
        pincode: data.pincode || "",
        latitude: data.latitude,
        longitude: data.longitude,
        integration_code: data.integration_code || "",
        is_active: data.is_active
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const validateField = (field: string, value: string): string => {
    switch (field) {
      case "email":
        return value && !isValidEmail(value) ? "Invalid email format" : "";
      case "phone":
        return value && !isValidMobile(value) ? "Invalid mobile number (10 digits starting with 6-9)" : "";
      case "gst_number":
        return value && !isValidGST(value) ? "Invalid GST format (e.g., 22AAAAA0000A1Z5)" : "";
      case "pan_number":
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
    if (!formData.display_name.trim()) {
      toast({ title: "Error", description: "Display name is required", variant: "destructive" });
      return;
    }

    // Validate all fields
    const newErrors: Record<string, string> = {};
    ["email", "phone", "gst_number", "pan_number"].forEach(field => {
      const error = validateField(field, formData[field as keyof typeof formData] as string);
      if (error) newErrors[field] = error;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({ title: "Validation Error", description: "Please fix the highlighted errors", variant: "destructive" });
      return;
    }

    // Check unique fields (email, phone, integration code) - exclude current ID
    const [emailUnique, phoneUnique, codeUnique] = await Promise.all([
      formData.email ? checkUniqueCustomerEmail(formData.email, id) : Promise.resolve(true),
      formData.phone ? checkUniquePhone(formData.phone, 'customer', id) : Promise.resolve(true),
      formData.integration_code ? checkUniqueCustomerCode(formData.integration_code, id) : Promise.resolve(true)
    ]);

    const duplicateErrors: string[] = [];
    if (!emailUnique) duplicateErrors.push("Email already exists");
    if (!phoneUnique) duplicateErrors.push("Phone number already exists");
    if (!codeUnique) duplicateErrors.push("Integration code already exists");

    if (duplicateErrors.length > 0) {
      toast({ title: "Duplicate Entry", description: duplicateErrors.join(", "), variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("customers").update({
        display_name: formData.display_name.trim(),
        company_name: formData.company_name || null,
        email: formData.email || null,
        phone: formData.phone || null,
        gst_number: formData.gst_number?.toUpperCase() || null,
        pan_number: formData.pan_number?.toUpperCase() || null,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        pincode: formData.pincode || null,
        latitude: formData.latitude,
        longitude: formData.longitude,
        integration_code: formData.integration_code || null,
        is_active: formData.is_active
      }).eq("id", id);

      if (error) throw error;
      toast({ title: "Success", description: "Customer updated successfully" });
      navigate(`/customers/${id}`);
    } catch (error: any) {
      logError(error, "CustomerEdit.handleSubmit");
      toast({ title: "Error", description: getDisplayErrorMessage(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-96"><LoadingSpinner /></div></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/customers/${id}`)}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-3xl font-bold">Edit Customer</h1>
            <p className="text-muted-foreground">Update customer details</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6">
            <Card>
              <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="display_name">Display Name *</Label>
                  <Input id="display_name" value={formData.display_name} onChange={(e) => setFormData({ ...formData, display_name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input id="company_name" value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={formData.email} 
                    onChange={(e) => handleFieldChange("email", e.target.value)}
                    className={errors.email ? "border-destructive" : ""}
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input 
                    id="phone" 
                    value={formData.phone} 
                    onChange={(e) => handleFieldChange("phone", e.target.value)}
                    className={errors.phone ? "border-destructive" : ""}
                    placeholder="10-digit mobile number"
                  />
                  {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="integration_code">Integration Code</Label>
                  <Input 
                    id="integration_code" 
                    value={formData.integration_code} 
                    onChange={(e) => handleFieldChange("integration_code", e.target.value)}
                    className={errors.integration_code ? "border-destructive" : ""}
                  />
                  {errors.integration_code && <p className="text-sm text-destructive">{errors.integration_code}</p>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Address Details</CardTitle></CardHeader>
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
                  <Input id="city" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input id="pincode" value={formData.pincode} onChange={(e) => setFormData({ ...formData, pincode: e.target.value })} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Tax Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gst_number">GST Number</Label>
                  <Input 
                    id="gst_number" 
                    value={formData.gst_number} 
                    onChange={(e) => handleFieldChange("gst_number", e.target.value.toUpperCase())}
                    className={errors.gst_number ? "border-destructive" : ""}
                    placeholder="22AAAAA0000A1Z5"
                  />
                  {errors.gst_number && <p className="text-sm text-destructive">{errors.gst_number}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pan_number">PAN Number</Label>
                  <Input 
                    id="pan_number" 
                    value={formData.pan_number} 
                    onChange={(e) => handleFieldChange("pan_number", e.target.value.toUpperCase())}
                    className={errors.pan_number ? "border-destructive" : ""}
                    placeholder="ABCDE1234F"
                  />
                  {errors.pan_number && <p className="text-sm text-destructive">{errors.pan_number}</p>}
                </div>
              </CardContent>
            </Card>

            <StatusToggle isActive={formData.is_active} onToggle={(value) => setFormData({ ...formData, is_active: value })} />

            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={() => navigate(`/customers/${id}`)}>Cancel</Button>
              <Button type="submit" disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? "Saving..." : "Save Changes"}</Button>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
}