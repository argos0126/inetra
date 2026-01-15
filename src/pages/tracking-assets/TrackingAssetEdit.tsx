import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Save, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { StatusToggle } from "@/components/StatusToggle";

interface Transporter {
  id: string;
  transporter_name: string;
}

// Check if asset_id is already used by another active tracking asset
const checkUniqueAssetId = async (assetId: string, assetType: "gps" | "sim" | "whatsapp" | "driver_app", excludeId?: string): Promise<{ isValid: boolean; existingAsset?: string }> => {
  if (!assetId) return { isValid: true };
  
  const { data } = await supabase
    .from("tracking_assets")
    .select("id, display_name")
    .eq("asset_id", assetId)
    .eq("asset_type", assetType)
    .eq("is_active", true)
    .neq("id", excludeId || "00000000-0000-0000-0000-000000000000")
    .limit(1);
  
  if (data && data.length > 0) {
    return { isValid: false, existingAsset: data[0].display_name };
  }
  
  return { isValid: true };
};

export default function TrackingAssetEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    display_name: "",
    asset_type: "gps" as "gps" | "sim" | "whatsapp" | "driver_app",
    asset_id: "",
    transporter_id: "",
    api_url: "",
    api_token: "",
    response_json_mapping: "",
    is_active: true,
  });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    const [assetRes, transportersRes] = await Promise.all([
      supabase.from("tracking_assets").select("*").eq("id", id).single(),
      supabase.from("transporters").select("id, transporter_name").eq("is_active", true),
    ]);

    if (assetRes.data) {
      setFormData({
        display_name: assetRes.data.display_name || "",
        asset_type: assetRes.data.asset_type || "gps",
        asset_id: assetRes.data.asset_id || "",
        transporter_id: assetRes.data.transporter_id || "",
        api_url: assetRes.data.api_url || "",
        api_token: assetRes.data.api_token || "",
        response_json_mapping: assetRes.data.response_json_mapping ? JSON.stringify(assetRes.data.response_json_mapping, null, 2) : "",
        is_active: assetRes.data.is_active,
      });
    }
    if (transportersRes.data) setTransporters(transportersRes.data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Validate unique asset_id for the asset type
      if (formData.asset_id) {
        const uniqueCheck = await checkUniqueAssetId(formData.asset_id, formData.asset_type, id);
        if (!uniqueCheck.isValid) {
          setErrors(prev => ({ ...prev, asset_id: `This ${formData.asset_type.toUpperCase()} ID is already registered to: ${uniqueCheck.existingAsset}` }));
          toast({
            title: "Duplicate Asset ID", 
            description: `This ${formData.asset_type.toUpperCase()} ID is already in use by another active tracking asset`, 
            variant: "destructive" 
          });
          setSaving(false);
          return;
        }
      }

      let jsonMapping = null;
      if (formData.response_json_mapping) {
        try {
          jsonMapping = JSON.parse(formData.response_json_mapping);
        } catch {
          toast({ title: "Invalid JSON mapping", variant: "destructive" });
          setSaving(false);
          return;
        }
      }

      const { error } = await supabase.from("tracking_assets").update({
        display_name: formData.display_name,
        asset_type: formData.asset_type,
        asset_id: formData.asset_id || null,
        transporter_id: formData.transporter_id || null,
        api_url: formData.api_url || null,
        api_token: formData.api_token || null,
        response_json_mapping: jsonMapping,
        is_active: formData.is_active,
      }).eq("id", id);

      if (error) throw error;

      toast({ title: "Tracking asset updated successfully" });
      navigate("/tracking-assets");
    } catch (error: any) {
      toast({ title: "Error updating tracking asset", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Layout><LoadingSpinner /></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/tracking-assets")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-semibold">Edit Tracking Asset</h1>
        </div>

        <Alert className="border-blue-500/50 bg-blue-500/10">
          <AlertCircle className="h-4 w-4 text-blue-500" />
          <AlertDescription>
            Each GPS device ID or SIM number can only be mapped to one active vehicle at a time.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Asset Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="display_name">Display Name *</Label>
                <Input
                  id="display_name"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset_type">Asset Type *</Label>
                <Select value={formData.asset_type} onValueChange={(value: any) => setFormData({ ...formData, asset_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gps">GPS</SelectItem>
                    <SelectItem value="sim">SIM</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="driver_app">Driver App</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset_id">Asset ID</Label>
                <Input
                  id="asset_id"
                  value={formData.asset_id}
                  onChange={(e) => {
                    setFormData({ ...formData, asset_id: e.target.value });
                    setErrors(prev => ({ ...prev, asset_id: "" }));
                  }}
                  className={errors.asset_id ? "border-destructive" : ""}
                />
                {errors.asset_id && <p className="text-sm text-destructive">{errors.asset_id}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="transporter_id">Transporter</Label>
                <Select value={formData.transporter_id} onValueChange={(value) => setFormData({ ...formData, transporter_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select transporter" />
                  </SelectTrigger>
                  <SelectContent>
                    {transporters.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.transporter_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="api_url">API URL</Label>
                <Input
                  id="api_url"
                  value={formData.api_url}
                  onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api_token">API Token</Label>
                <Input
                  id="api_token"
                  type="password"
                  value={formData.api_token}
                  onChange={(e) => setFormData({ ...formData, api_token: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="response_json_mapping">Response JSON Mapping</Label>
                <Textarea
                  id="response_json_mapping"
                  value={formData.response_json_mapping}
                  onChange={(e) => setFormData({ ...formData, response_json_mapping: e.target.value })}
                  placeholder='{"latitude": "lat", "longitude": "lng"}'
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          <StatusToggle isActive={formData.is_active} onToggle={(value) => setFormData({ ...formData, is_active: value })} />

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate("/tracking-assets")}>Cancel</Button>
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