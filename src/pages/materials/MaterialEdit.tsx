import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { StatusToggle } from "@/components/StatusToggle";

const PACKAGING_OPTIONS = [
  "Box", "Bag", "Drum", "Carton", "Pallet", "Loose", "Bundle", 
  "Container", "Crate", "Sack", "Bottle", "Can", "Pouch", "Other"
];

const UNIT_OPTIONS = [
  { value: "pcs", label: "Pieces (pcs)" },
  { value: "kg", label: "Kilograms (kg)" },
  { value: "gm", label: "Grams (gm)" },
  { value: "ltrs", label: "Liters (ltrs)" },
  { value: "ml", label: "Milliliters (ml)" },
  { value: "ton", label: "Metric Tons (ton)" },
  { value: "nos", label: "Numbers (nos)" },
  { value: "mt", label: "Meters (mt)" },
  { value: "ft", label: "Feet (ft)" },
  { value: "sqft", label: "Square Feet (sq.ft)" },
  { value: "cbm", label: "Cubic Meters (cbm)" },
  { value: "units", label: "Units" },
];

export default function MaterialEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    sku_code: "",
    description: "",
    packaging: "",
    units: "",
    length_cm: "",
    breadth_cm: "",
    height_cm: "",
    weight_kg: "",
    volume_cbm: "",
    is_bulk: false,
    is_active: true,
  });

  useEffect(() => {
    fetchMaterial();
  }, [id]);

  const fetchMaterial = async () => {
    const { data } = await supabase.from("materials").select("*").eq("id", id).single();
    if (data) {
      setFormData({
        name: data.name || "",
        sku_code: data.sku_code || "",
        description: data.description || "",
        packaging: data.packaging || "",
        units: data.units || "",
        length_cm: data.length_cm?.toString() || "",
        breadth_cm: data.breadth_cm?.toString() || "",
        height_cm: data.height_cm?.toString() || "",
        weight_kg: data.weight_kg?.toString() || "",
        volume_cbm: data.volume_cbm?.toString() || "",
        is_bulk: data.is_bulk,
        is_active: data.is_active,
      });
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase.from("materials").update({
        name: formData.name,
        sku_code: formData.sku_code || null,
        description: formData.description || null,
        packaging: formData.packaging || null,
        units: formData.units || null,
        length_cm: formData.length_cm ? parseFloat(formData.length_cm) : null,
        breadth_cm: formData.breadth_cm ? parseFloat(formData.breadth_cm) : null,
        height_cm: formData.height_cm ? parseFloat(formData.height_cm) : null,
        weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : null,
        volume_cbm: formData.volume_cbm ? parseFloat(formData.volume_cbm) : null,
        is_bulk: formData.is_bulk,
        is_active: formData.is_active,
      }).eq("id", id);

      if (error) throw error;

      toast({ title: "Material updated successfully" });
      navigate("/materials");
    } catch (error: any) {
      toast({ title: "Error updating material", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Layout><LoadingSpinner /></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/materials")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-semibold">Edit Material</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku_code">SKU Code</Label>
                <Input
                  id="sku_code"
                  value={formData.sku_code}
                  onChange={(e) => setFormData({ ...formData, sku_code: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="packaging">Packaging</Label>
                <Select
                  value={formData.packaging}
                  onValueChange={(value) => setFormData({ ...formData, packaging: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select packaging type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PACKAGING_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Type of container or wrapping used</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="units">Units</Label>
                <Select
                  value={formData.units}
                  onValueChange={(value) => setFormData({ ...formData, units: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit of measure" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_bulk"
                  checked={formData.is_bulk}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_bulk: checked })}
                />
                <Label htmlFor="is_bulk">Bulk Material</Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dimensions & Weight</CardTitle>
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
              <div className="space-y-2">
                <Label htmlFor="weight_kg">Weight (kg)</Label>
                <Input
                  id="weight_kg"
                  type="number"
                  step="0.01"
                  value={formData.weight_kg}
                  onChange={(e) => setFormData({ ...formData, weight_kg: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="volume_cbm">Volume (CBM)</Label>
                <Input
                  id="volume_cbm"
                  type="number"
                  step="0.0001"
                  value={formData.volume_cbm}
                  onChange={(e) => setFormData({ ...formData, volume_cbm: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <StatusToggle isActive={formData.is_active} onToggle={(value) => setFormData({ ...formData, is_active: value })} />

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate("/materials")}>Cancel</Button>
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
