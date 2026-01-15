import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusToggle } from "@/components/StatusToggle";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ArrowLeft, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AddressAutocomplete, LocationMapPreview, type PlaceData } from "@/components/location/LocationSearchMap";

export default function LocationEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<{ id: string; display_name: string }[]>([]);
  const [formData, setFormData] = useState({
    location_name: "", location_type: "node", address: "", city: "", state: "", pincode: "",
    district: "", zone: "", latitude: "", longitude: "",
    sim_radius_meters: "500", gps_radius_meters: "200",
    customer_id: "", integration_id: "", is_active: true
  });

  useEffect(() => { if (id) fetchData(); }, [id]);

  const fetchData = async () => {
    try {
      const [locRes, custRes] = await Promise.all([
        supabase.from("locations").select("*").eq("id", id).maybeSingle(),
        supabase.from("customers").select("id, display_name").eq("is_active", true)
      ]);
      if (locRes.error) throw locRes.error;
      if (!locRes.data) { navigate("/locations"); return; }
      const l = locRes.data;
      setFormData({
        location_name: l.location_name || "", location_type: l.location_type || "node",
        address: l.address || "", city: l.city || "", state: l.state || "", pincode: l.pincode || "",
        district: l.district || "", zone: l.zone || "",
        latitude: l.latitude?.toString() || "", longitude: l.longitude?.toString() || "",
        sim_radius_meters: l.sim_radius_meters !== null && l.sim_radius_meters !== undefined ? l.sim_radius_meters.toString() : "500",
        gps_radius_meters: l.gps_radius_meters !== null && l.gps_radius_meters !== undefined ? l.gps_radius_meters.toString() : "200",
        customer_id: l.customer_id || "", integration_id: l.integration_id || "",
        is_active: l.is_active
      });
      if (custRes.data) setCustomers(custRes.data);
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const handlePlaceSelect = (data: PlaceData) => {
    setFormData(prev => ({
      ...prev,
      address: data.address,
      city: data.city,
      district: data.district,
      state: data.state,
      pincode: data.pincode,
      zone: data.zone,
      latitude: data.latitude.toString(),
      longitude: data.longitude.toString(),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.location_name.trim()) { toast({ title: "Error", description: "Location name is required", variant: "destructive" }); return; }
    // Validate pincode if provided (6-digit Indian pincode)
    if (formData.pincode && !/^[1-9][0-9]{5}$/.test(formData.pincode)) {
      toast({ title: "Error", description: "Pincode must be a valid 6-digit number", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("locations").update({
        location_name: formData.location_name.trim(),
        location_type: formData.location_type as any,
        address: formData.address || null, city: formData.city || null, state: formData.state || null, pincode: formData.pincode || null,
        district: formData.district || null, zone: formData.zone || null,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        sim_radius_meters: formData.sim_radius_meters !== '' ? parseInt(formData.sim_radius_meters) : 500,
        gps_radius_meters: formData.gps_radius_meters !== '' ? parseInt(formData.gps_radius_meters) : 200,
        customer_id: formData.customer_id || null, integration_id: formData.integration_id || null,
        is_active: formData.is_active
      }).eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Location updated successfully" });
      navigate("/locations");
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-96"><LoadingSpinner /></div></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/locations/${id}`)}><ArrowLeft className="h-5 w-5" /></Button>
          <div><h1 className="text-3xl font-bold">Edit Location</h1><p className="text-muted-foreground">Update location details</p></div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6">
            <Card>
              <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Location Name *</Label><Input value={formData.location_name} onChange={(e) => setFormData({ ...formData, location_name: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Location Type</Label><Select value={formData.location_type} onValueChange={(v) => setFormData({ ...formData, location_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="node">Node</SelectItem><SelectItem value="consignee">Consignee</SelectItem><SelectItem value="plant">Plant</SelectItem><SelectItem value="warehouse">Warehouse</SelectItem><SelectItem value="distribution_center">Distribution Center</SelectItem><SelectItem value="hub">Hub</SelectItem><SelectItem value="branch">Branch</SelectItem><SelectItem value="headquarters">Headquarters</SelectItem><SelectItem value="regional_office">Regional Office</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Customer</Label><Select value={formData.customer_id} onValueChange={(v) => setFormData({ ...formData, customer_id: v })}><SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger><SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Integration ID</Label><Input value={formData.integration_id} onChange={(e) => setFormData({ ...formData, integration_id: e.target.value })} /></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Address Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Address (Search to auto-fill)</Label>
                  <AddressAutocomplete
                    defaultValue={formData.address}
                    onPlaceSelect={handlePlaceSelect}
                    placeholder="Type to search for an address..."
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>City</Label><Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} /></div>
                  <div className="space-y-2"><Label>District</Label><Input value={formData.district} onChange={(e) => setFormData({ ...formData, district: e.target.value })} /></div>
                  <div className="space-y-2"><Label>State</Label><Input value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Pincode</Label><Input value={formData.pincode} onChange={(e) => setFormData({ ...formData, pincode: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Zone</Label><Input value={formData.zone} onChange={(e) => setFormData({ ...formData, zone: e.target.value })} /></div>
                </div>
                <LocationMapPreview 
                  latitude={formData.latitude ? parseFloat(formData.latitude) : undefined}
                  longitude={formData.longitude ? parseFloat(formData.longitude) : undefined}
                  gpsRadius={formData.gps_radius_meters !== '' ? parseInt(formData.gps_radius_meters) : 200}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Geofencing</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2"><Label>Latitude</Label><Input type="number" step="any" value={formData.latitude} readOnly className="bg-muted" /></div>
                <div className="space-y-2"><Label>Longitude</Label><Input type="number" step="any" value={formData.longitude} readOnly className="bg-muted" /></div>
                <div className="space-y-2"><Label>GPS Radius (m)</Label><Input type="number" min="0" value={formData.gps_radius_meters} onChange={(e) => setFormData({ ...formData, gps_radius_meters: e.target.value })} /></div>
                <div className="space-y-2"><Label>SIM Radius (m)</Label><Input type="number" min="0" value={formData.sim_radius_meters} onChange={(e) => setFormData({ ...formData, sim_radius_meters: e.target.value })} /></div>
              </CardContent>
            </Card>

            <StatusToggle isActive={formData.is_active} onToggle={(v) => setFormData({ ...formData, is_active: v })} />

            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={() => navigate(`/locations/${id}`)}>Cancel</Button>
              <Button type="submit" disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? "Saving..." : "Save Changes"}</Button>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
}
