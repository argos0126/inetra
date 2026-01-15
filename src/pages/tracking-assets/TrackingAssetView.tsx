import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, MapPin, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { DetailRow } from "@/components/DetailRow";
import { LocationTracker } from "@/components/tracking/LocationTracker";

export default function TrackingAssetView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAsset();
  }, [id]);

  const fetchAsset = async () => {
    const { data } = await supabase
      .from("tracking_assets")
      .select("*, transporters(transporter_name)")
      .eq("id", id)
      .single();
    setAsset(data);
    setLoading(false);
  };

  if (loading) return <Layout><LoadingSpinner /></Layout>;
  if (!asset) return <Layout><div>Tracking asset not found</div></Layout>;

  const canTrack = asset.is_active && asset.asset_id;
  const trackingType = asset.asset_type === "sim" ? "sim" : "gps";

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/tracking-assets")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">{asset.display_name}</h1>
              <div className="flex gap-2 mt-1">
                <Badge variant={asset.is_active ? "default" : "secondary"}>
                  {asset.is_active ? "Active" : "Inactive"}
                </Badge>
                <Badge variant="outline">
                  {asset.asset_type?.toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>
          <Button onClick={() => navigate(`/tracking-assets/${id}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Asset Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <DetailRow label="Display Name" value={asset.display_name} />
              <DetailRow label="Asset Type" value={asset.asset_type?.toUpperCase()} />
              <DetailRow label="Asset ID" value={asset.asset_id} />
              <DetailRow label="Transporter" value={asset.transporters?.transporter_name} />
              <DetailRow label="Last Validated" value={asset.last_validated_at ? new Date(asset.last_validated_at).toLocaleString() : null} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <DetailRow label="API URL" value={asset.api_url} />
              <DetailRow label="API Token" value={asset.api_token ? "••••••••" : "Using environment secret"} />
              <div>
                <DetailRow 
                  label="Response JSON Mapping" 
                  value={asset.response_json_mapping ? JSON.stringify(asset.response_json_mapping, null, 2) : null} 
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Location Tracking */}
        {canTrack && (
          <LocationTracker
            trackingType={trackingType}
            msisdn={trackingType === "sim" ? asset.asset_id : undefined}
            vehicleNumber={trackingType === "gps" ? asset.asset_id : undefined}
            trackingAssetId={asset.id}
          />
        )}

        {!canTrack && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>
                {!asset.is_active 
                  ? "Asset is inactive. Activate to enable tracking."
                  : "No Asset ID configured. Add an Asset ID to enable tracking."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
