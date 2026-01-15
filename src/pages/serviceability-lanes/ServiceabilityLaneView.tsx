import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { DetailRow } from "@/components/DetailRow";

export default function ServiceabilityLaneView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lane, setLane] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLane();
  }, [id]);

  const fetchLane = async () => {
    const { data } = await supabase
      .from("serviceability_lanes")
      .select(`
        *,
        origin:locations!serviceability_lanes_origin_location_id_fkey(location_name),
        destination:locations!serviceability_lanes_destination_location_id_fkey(location_name),
        transporters(transporter_name),
        vehicle_types(type_name)
      `)
      .eq("id", id)
      .single();
    setLane(data);
    setLoading(false);
  };

  if (loading) return <Layout><LoadingSpinner /></Layout>;
  if (!lane) return <Layout><div>Serviceability lane not found</div></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/serviceability-lanes")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">{lane.lane_code}</h1>
              <div className="flex gap-2 mt-1">
                <Badge variant={lane.is_active ? "default" : "secondary"}>
                  {lane.is_active ? "Active" : "Inactive"}
                </Badge>
                <Badge variant="outline">{lane.freight_type?.toUpperCase()}</Badge>
                <Badge variant="outline">{lane.serviceability_mode}</Badge>
              </div>
            </div>
          </div>
          <Button onClick={() => navigate(`/serviceability-lanes/${id}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lane Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <DetailRow label="Lane Code" value={lane.lane_code} />
            <DetailRow label="Origin" value={lane.origin?.location_name} />
            <DetailRow label="Destination" value={lane.destination?.location_name} />
            <DetailRow label="Transporter" value={lane.transporters?.transporter_name} />
            <DetailRow label="Vehicle Type" value={lane.vehicle_types?.type_name} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service Configuration</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <DetailRow label="Freight Type" value={lane.freight_type?.toUpperCase()} />
            <DetailRow label="Mode" value={lane.serviceability_mode} />
            <DetailRow label="Distance (km)" value={lane.distance_km} />
            <DetailRow label="Standard TAT (hours)" value={lane.standard_tat_hours} />
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
