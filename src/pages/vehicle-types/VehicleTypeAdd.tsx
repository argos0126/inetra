import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { StatusToggle } from "@/components/StatusToggle";

export default function VehicleTypeAdd() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type_name: "",
    length_cm: "",
    breadth_cm: "",
    height_cm: "",
    weight_capacity_kg: "",
    volume_capacity_cbm: "",
    is_active: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from("vehicle_types").insert({
        type_name: formData.type_name,
        length_cm: formData.length_cm ? parseFloat(formData.length_cm) : null,
        breadth_cm: formData.breadth_cm ? parseFloat(formData.breadth_cm) : null,
        height_cm: formData.height_cm ? parseFloat(formData.height_cm) : null,
        weight_capacity_kg: formData.weight_capacity_kg ? parseFloat(formData.weight_capacity_kg) : null,
        volume_capacity_cbm: formData.volume_capacity_cbm ? parseFloat(formData.volume_capacity_cbm) : null,
        is_active: formData.is_active,
      });

      if (error) throw error;

      toast({ title: "Vehicle type created successfully" });
      navigate("/vehicle-types");
    } catch (error: any) {
      toast({ title: "Error creating vehicle type", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/vehicle-types")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-semibold">Add Vehicle Type</h1>
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
            <Button type="submit" disabled={loading}>
              <Save className="mr-2 h-4 w-4" />
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
