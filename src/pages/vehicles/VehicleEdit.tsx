import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusToggle } from "@/components/StatusToggle";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ValidationAlert } from "@/components/ValidationAlert";
import { ArrowLeft, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  isValidVehicleNumber, 
  checkUniqueVehicleNumber, 
  checkTrackingAssetNotMappedToActiveVehicle,
  validateVehicleCompliance 
} from "@/utils/validationUtils";

export default function VehicleEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [complianceWarnings, setComplianceWarnings] = useState<string[]>([]);
  const [complianceErrors, setComplianceErrors] = useState<string[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<{ id: string; type_name: string }[]>([]);
  const [transporters, setTransporters] = useState<{ id: string; transporter_name: string }[]>([]);
  const [trackingAssets, setTrackingAssets] = useState<{ id: string; display_name: string }[]>([]);
  const [formData, setFormData] = useState({
    vehicle_number: "", vehicle_type_id: "", transporter_id: "", tracking_asset_id: "",
    make: "", model: "", year: new Date().getFullYear(), is_dedicated: false,
    location_code: "", integration_code: "",
    rc_number: "", rc_issue_date: "", rc_expiry_date: "",
    puc_number: "", puc_issue_date: "", puc_expiry_date: "",
    insurance_number: "", insurance_issue_date: "", insurance_expiry_date: "",
    fitness_number: "", fitness_issue_date: "", fitness_expiry_date: "",
    permit_number: "", permit_issue_date: "", permit_expiry_date: "",
    is_active: true
  });

  useEffect(() => { if (id) fetchData(); }, [id]);

  // Check compliance whenever dates change
  useEffect(() => {
    const compliance = validateVehicleCompliance({
      insurance_expiry_date: formData.insurance_expiry_date,
      fitness_expiry_date: formData.fitness_expiry_date,
      permit_expiry_date: formData.permit_expiry_date,
      puc_expiry_date: formData.puc_expiry_date,
      rc_expiry_date: formData.rc_expiry_date
    });
    setComplianceWarnings(compliance.warnings);
    setComplianceErrors(compliance.errors);
  }, [formData.insurance_expiry_date, formData.fitness_expiry_date, formData.permit_expiry_date, formData.puc_expiry_date, formData.rc_expiry_date]);

  const fetchData = async () => {
    try {
      const [vehicleRes, vtRes, trRes, taRes] = await Promise.all([
        supabase.from("vehicles").select("*").eq("id", id).maybeSingle(),
        supabase.from("vehicle_types").select("id, type_name").eq("is_active", true),
        supabase.from("transporters").select("id, transporter_name").eq("is_active", true),
        // Only GPS assets for vehicles - SIM tracking applies to drivers
        supabase.from("tracking_assets").select("id, display_name").eq("is_active", true).eq("asset_type", "gps")
      ]);
      if (vehicleRes.error) throw vehicleRes.error;
      if (!vehicleRes.data) { navigate("/vehicles"); return; }
      const v = vehicleRes.data;
      setFormData({
        vehicle_number: v.vehicle_number || "", vehicle_type_id: v.vehicle_type_id || "", transporter_id: v.transporter_id || "", tracking_asset_id: v.tracking_asset_id || "",
        make: v.make || "", model: v.model || "", year: v.year || new Date().getFullYear(), is_dedicated: v.is_dedicated,
        location_code: v.location_code || "", integration_code: v.integration_code || "",
        rc_number: v.rc_number || "", rc_issue_date: v.rc_issue_date || "", rc_expiry_date: v.rc_expiry_date || "",
        puc_number: v.puc_number || "", puc_issue_date: v.puc_issue_date || "", puc_expiry_date: v.puc_expiry_date || "",
        insurance_number: v.insurance_number || "", insurance_issue_date: v.insurance_issue_date || "", insurance_expiry_date: v.insurance_expiry_date || "",
        fitness_number: v.fitness_number || "", fitness_issue_date: v.fitness_issue_date || "", fitness_expiry_date: v.fitness_expiry_date || "",
        permit_number: v.permit_number || "", permit_issue_date: v.permit_issue_date || "", permit_expiry_date: v.permit_expiry_date || "",
        is_active: v.is_active
      });
      if (vtRes.data) setVehicleTypes(vtRes.data);
      if (trRes.data) setTransporters(trRes.data);
      if (taRes.data) setTrackingAssets(taRes.data);
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const handleVehicleNumberChange = (value: string) => {
    const formatted = value.replace(/\s/g, '').toUpperCase();
    setFormData({ ...formData, vehicle_number: formatted });
    if (formatted && !isValidVehicleNumber(formatted)) {
      setErrors(prev => ({ ...prev, vehicle_number: "Invalid vehicle number format (e.g., MH12AB1234)" }));
    } else {
      setErrors(prev => ({ ...prev, vehicle_number: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicle_number.trim()) { toast({ title: "Error", description: "Vehicle number is required", variant: "destructive" }); return; }

    if (!formData.vehicle_type_id) {
      setErrors(prev => ({ ...prev, vehicle_type_id: "Vehicle type is required" }));
      toast({ title: "Error", description: "Please select a vehicle type", variant: "destructive" });
      return;
    }

    // Validate vehicle number format
    if (!isValidVehicleNumber(formData.vehicle_number)) {
      setErrors(prev => ({ ...prev, vehicle_number: "Invalid vehicle number format" }));
      toast({ title: "Validation Error", description: "Invalid vehicle number format", variant: "destructive" });
      return;
    }

    // Check unique vehicle number (excluding current)
    const isUnique = await checkUniqueVehicleNumber(formData.vehicle_number, id);
    if (!isUnique) {
      setErrors(prev => ({ ...prev, vehicle_number: "This vehicle number is already registered" }));
      toast({ title: "Duplicate Vehicle", description: "This vehicle number already exists", variant: "destructive" });
      return;
    }

    // Check tracking asset not mapped to another active vehicle
    if (formData.tracking_asset_id) {
      const assetCheck = await checkTrackingAssetNotMappedToActiveVehicle(formData.tracking_asset_id, id);
      if (!assetCheck.isValid) {
        toast({ 
          title: "Tracking Asset Already Mapped", 
          description: `This tracking asset is already assigned to vehicle ${assetCheck.mappedVehicle}`, 
          variant: "destructive" 
        });
        return;
      }
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("vehicles").update({
        vehicle_number: formData.vehicle_number.trim(),
        vehicle_type_id: formData.vehicle_type_id || null, transporter_id: formData.transporter_id || null, tracking_asset_id: formData.tracking_asset_id || null,
        make: formData.make || null, model: formData.model || null, year: formData.year || null,
        is_dedicated: formData.is_dedicated, location_code: formData.location_code || null, integration_code: formData.integration_code || null,
        rc_number: formData.rc_number || null, rc_issue_date: formData.rc_issue_date || null, rc_expiry_date: formData.rc_expiry_date || null,
        puc_number: formData.puc_number || null, puc_issue_date: formData.puc_issue_date || null, puc_expiry_date: formData.puc_expiry_date || null,
        insurance_number: formData.insurance_number || null, insurance_issue_date: formData.insurance_issue_date || null, insurance_expiry_date: formData.insurance_expiry_date || null,
        fitness_number: formData.fitness_number || null, fitness_issue_date: formData.fitness_issue_date || null, fitness_expiry_date: formData.fitness_expiry_date || null,
        permit_number: formData.permit_number || null, permit_issue_date: formData.permit_issue_date || null, permit_expiry_date: formData.permit_expiry_date || null,
        is_active: formData.is_active
      }).eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Vehicle updated successfully" });
      navigate(`/vehicles/${id}`);
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-96"><LoadingSpinner /></div></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/vehicles/${id}`)}><ArrowLeft className="h-5 w-5" /></Button>
          <div><h1 className="text-3xl font-bold">Edit Vehicle</h1><p className="text-muted-foreground">Update vehicle details</p></div>
        </div>

        <ValidationAlert errors={complianceErrors} warnings={complianceWarnings} />

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6">
            <Card>
              <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Vehicle Number *</Label>
                  <Input 
                    value={formData.vehicle_number} 
                    onChange={(e) => handleVehicleNumberChange(e.target.value)} 
                    placeholder="MH12AB1234"
                    className={errors.vehicle_number ? "border-destructive" : ""}
                    required 
                  />
                  {errors.vehicle_number && <p className="text-sm text-destructive">{errors.vehicle_number}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Vehicle Type *</Label>
                  <Select value={formData.vehicle_type_id} onValueChange={(v) => setFormData({ ...formData, vehicle_type_id: v })} required>
                    <SelectTrigger className={!formData.vehicle_type_id && errors.vehicle_type_id ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>{vehicleTypes.map(vt => <SelectItem key={vt.id} value={vt.id}>{vt.type_name}</SelectItem>)}</SelectContent>
                  </Select>
                  {errors.vehicle_type_id && <p className="text-sm text-destructive">{errors.vehicle_type_id}</p>}
                </div>
                <div className="space-y-2"><Label>Transporter</Label><Select value={formData.transporter_id} onValueChange={(v) => setFormData({ ...formData, transporter_id: v })}><SelectTrigger><SelectValue placeholder="Select transporter" /></SelectTrigger><SelectContent>{transporters.map(t => <SelectItem key={t.id} value={t.id}>{t.transporter_name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Tracking Asset</Label><Select value={formData.tracking_asset_id} onValueChange={(v) => setFormData({ ...formData, tracking_asset_id: v })}><SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger><SelectContent>{trackingAssets.map(ta => <SelectItem key={ta.id} value={ta.id}>{ta.display_name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Make</Label><Input value={formData.make} onChange={(e) => setFormData({ ...formData, make: e.target.value })} /></div>
                <div className="space-y-2"><Label>Model</Label><Input value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} /></div>
                <div className="space-y-2"><Label>Year</Label><Input type="number" value={formData.year} onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || 0 })} /></div>
                <div className="space-y-2"><Label>Location Code</Label><Input value={formData.location_code} onChange={(e) => setFormData({ ...formData, location_code: e.target.value })} /></div>
                <div className="space-y-2"><Label>Integration Code</Label><Input value={formData.integration_code} onChange={(e) => setFormData({ ...formData, integration_code: e.target.value })} /></div>
                <div className="flex items-center space-x-2 pt-6"><Checkbox checked={formData.is_dedicated} onCheckedChange={(c) => setFormData({ ...formData, is_dedicated: !!c })} /><Label>Dedicated Vehicle</Label></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Compliance Documents</CardTitle></CardHeader>
              <CardContent>
                <Tabs defaultValue="rc">
                  <TabsList className="grid w-full grid-cols-5"><TabsTrigger value="rc">RC</TabsTrigger><TabsTrigger value="puc">PUC</TabsTrigger><TabsTrigger value="insurance">Insurance</TabsTrigger><TabsTrigger value="fitness">Fitness</TabsTrigger><TabsTrigger value="permit">Permit</TabsTrigger></TabsList>
                  <TabsContent value="rc" className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="space-y-2"><Label>RC Number</Label><Input value={formData.rc_number} onChange={(e) => setFormData({ ...formData, rc_number: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Issue Date</Label><Input type="date" value={formData.rc_issue_date} onChange={(e) => setFormData({ ...formData, rc_issue_date: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Expiry Date</Label><Input type="date" value={formData.rc_expiry_date} onChange={(e) => setFormData({ ...formData, rc_expiry_date: e.target.value })} /></div>
                  </TabsContent>
                  <TabsContent value="puc" className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="space-y-2"><Label>PUC Number</Label><Input value={formData.puc_number} onChange={(e) => setFormData({ ...formData, puc_number: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Issue Date</Label><Input type="date" value={formData.puc_issue_date} onChange={(e) => setFormData({ ...formData, puc_issue_date: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Expiry Date</Label><Input type="date" value={formData.puc_expiry_date} onChange={(e) => setFormData({ ...formData, puc_expiry_date: e.target.value })} /></div>
                  </TabsContent>
                  <TabsContent value="insurance" className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="space-y-2"><Label>Insurance Number</Label><Input value={formData.insurance_number} onChange={(e) => setFormData({ ...formData, insurance_number: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Issue Date</Label><Input type="date" value={formData.insurance_issue_date} onChange={(e) => setFormData({ ...formData, insurance_issue_date: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Expiry Date</Label><Input type="date" value={formData.insurance_expiry_date} onChange={(e) => setFormData({ ...formData, insurance_expiry_date: e.target.value })} /></div>
                  </TabsContent>
                  <TabsContent value="fitness" className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="space-y-2"><Label>Fitness Number</Label><Input value={formData.fitness_number} onChange={(e) => setFormData({ ...formData, fitness_number: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Issue Date</Label><Input type="date" value={formData.fitness_issue_date} onChange={(e) => setFormData({ ...formData, fitness_issue_date: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Expiry Date</Label><Input type="date" value={formData.fitness_expiry_date} onChange={(e) => setFormData({ ...formData, fitness_expiry_date: e.target.value })} /></div>
                  </TabsContent>
                  <TabsContent value="permit" className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="space-y-2"><Label>Permit Number</Label><Input value={formData.permit_number} onChange={(e) => setFormData({ ...formData, permit_number: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Issue Date</Label><Input type="date" value={formData.permit_issue_date} onChange={(e) => setFormData({ ...formData, permit_issue_date: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Expiry Date</Label><Input type="date" value={formData.permit_expiry_date} onChange={(e) => setFormData({ ...formData, permit_expiry_date: e.target.value })} /></div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <StatusToggle isActive={formData.is_active} onToggle={(v) => setFormData({ ...formData, is_active: v })} />

            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={() => navigate(`/vehicles/${id}`)}>Cancel</Button>
              <Button type="submit" disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? "Saving..." : "Save Changes"}</Button>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
}