import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { StatusToggle } from "@/components/StatusToggle";

export default function VehicleTypeEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    type_name: "",
    length_cm: "",
    breadth_cm: "",
    height_cm: "",
    weight_capacity_kg: "",
    volume_capacity_cbm: "",
    is_active: true,
  });

  useEffect(() => {
    fetchVehicleType();
  }, [id]);

  const fetchVehicleType = async () => {
    const { data } = await supabase.from("vehicle_types").select("*").eq("id", id).single();
    if (data) {
      setFormData({
        type_name: data.type_name || "",
        length_cm: data.length_cm?.toString() || "",
        breadth_cm: data.breadth_cm?.toString() || "",
        height_cm: data.height_cm?.toString() || "",
        weight_capacity_kg: data.weight_capacity_kg?.toString() || "",
        volume_capacity_cbm: data.volume_capacity_cbm?.toString() || "",
        is_active: data.is_active,
      });
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase.from("vehicle_types").update({
        type_name: formData.type_name,
        length_cm: formData.length_cm ? parseFloat(formData.length_cm) : null,
        breadth_cm: formData.breadth_cm ? parseFloat(formData.breadth_cm) : null,
        height_cm: formData.height_cm ? parseFloat(formData.height_cm) : null,
        weight_capacity_kg: formData.weight_capacity_kg ? parseFloat(formData.weight_capacity_kg) : null,
        volume_capacity_cbm: formData.volume_capacity_cbm ? parseFloat(formData.volume_capacity_cbm) : null,
        is_active: formData.is_active,
      }).eq("id", id);

      if (error) throw error;

      toast({ title: "Vehicle type updated successfully" });
      navigate("/vehicle-types");
    } catch (error: any) {
      toast({ title: "Error updating vehicle type", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Layout><LoadingSpinner /></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/vehicle-types")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-semibold">Edit Vehicle Type</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="type_name">Type Name *</Label>
                <Input
                  id="type_name"
                  value={formData.type_name}
                  onChange={(e) => setFormData({ ...formData, type_name: e.target.value })}
                  required
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dimensions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="length_cm">Length (cm)</Label>
                <Input
                  id="length_cm"
                  type="number"
                  step="0.01"
                  value={formData.length_cm}
                  onChange={(e) => setFormData({ ...formData, length_cm: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="breadth_cm">Breadth (cm)</Label>
                <Input
                  id="breadth_cm"
                  type="number"
                  step="0.01"
                  value={formData.breadth_cm}
                  onChange={(e) => setFormData({ ...formData, breadth_cm: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height_cm">Height (cm)</Label>
                <Input
                  id="height_cm"
                  type="number"
                  step="0.01"
                  value={formData.height_cm}
                  onChange={(e) => setFormData({ ...formData, height_cm: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Capacity</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="weight_capacity_kg">Weight Capacity (kg)</Label>
                <Input
                  id="weight_capacity_kg"
                  type="number"
                  step="0.01"
                  value={formData.weight_capacity_kg}
                  onChange={(e) => setFormData({ ...formData, weight_capacity_kg: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="volume_capacity_cbm">Volume Capacity (CBM)</Label>
                <Input
                  id="volume_capacity_cbm"
                  type="number"
                  step="0.01"
                  value={formData.volume_capacity_cbm}
                  onChange={(e) => setFormData({ ...formData, volume_capacity_cbm: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <StatusToggle isActive={formData.is_active} onToggle={(value) => setFormData({ ...formData, is_active: value })} />

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate("/vehicle-types")}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
