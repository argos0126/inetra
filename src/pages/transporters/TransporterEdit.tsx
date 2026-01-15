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
import { AddressAutocomplete, type PlaceData } from "@/components/location/LocationSearchMap";
import { 
  checkUniqueTransporterCode,
  checkUniqueTransporterGSTIN,
  checkUniqueTransporterPAN,
  checkUniqueTransporterEmail,
  checkUniqueTransporterMobile
} from "@/utils/validationUtils";
import { getDisplayErrorMessage, logError } from "@/utils/errorHandler";

export default function TransporterEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  useEffect(() => {
    if (id) fetchTransporter();
  }, [id]);

  const fetchTransporter = async () => {
    try {
      const { data, error } = await supabase
        .from("transporters")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast({ title: "Error", description: "Transporter not found", variant: "destructive" });
        navigate("/transporters");
        return;
      }
      setFormData({
        transporter_name: data.transporter_name || "",
        code: data.code || "",
        email: data.email || "",
        mobile: data.mobile || "",
        company: data.company || "",
        address: data.address || "",
        city: data.city || "",
        state: data.state || "",
        pincode: data.pincode || "",
        latitude: data.latitude,
        longitude: data.longitude,
        gstin: data.gstin || "",
        pan: data.pan || "",
        is_active: data.is_active
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
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

    setSaving(true);
    try {
      // Check for duplicates (excluding current transporter) including email and mobile
      const [codeUnique, gstinUnique, panUnique, emailUnique, mobileUnique] = await Promise.all([
        formData.code.trim() ? checkUniqueTransporterCode(formData.code.trim(), id) : Promise.resolve(true),
        formData.gstin.trim() ? checkUniqueTransporterGSTIN(formData.gstin.trim(), id) : Promise.resolve(true),
        formData.pan.trim() ? checkUniqueTransporterPAN(formData.pan.trim(), id) : Promise.resolve(true),
        formData.email.trim() ? checkUniqueTransporterEmail(formData.email.trim(), id) : Promise.resolve(true),
        formData.mobile.trim() ? checkUniqueTransporterMobile(formData.mobile.trim(), id) : Promise.resolve(true)
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
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("transporters")
        .update({
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
        })
        .eq("id", id);

      if (error) throw error;

      toast({ title: "Success", description: "Transporter updated successfully" });
      navigate(`/transporters/${id}`);
    } catch (error: any) {
      logError(error, "TransporterEdit");
      toast({ title: "Error", description: getDisplayErrorMessage(error), variant: "destructive" });
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
          <Button variant="ghost" size="icon" onClick={() => navigate(`/transporters/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Edit Transporter</h1>
            <p className="text-muted-foreground">Update transporter details</p>
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
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Enter email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile">Mobile</Label>
                  <Input
                    id="mobile"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    placeholder="Enter mobile number"
                  />
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
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                    placeholder="Enter GSTIN"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pan">PAN</Label>
                  <Input
                    id="pan"
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value })}
                    placeholder="Enter PAN"
                  />
                </div>
              </CardContent>
            </Card>

            <StatusToggle
              isActive={formData.is_active}
              onToggle={(value) => setFormData({ ...formData, is_active: value })}
            />

            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={() => navigate(`/transporters/${id}`)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
}
