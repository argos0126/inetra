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

export default function VehicleTypeView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vehicleType, setVehicleType] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVehicleType();
  }, [id]);

  const fetchVehicleType = async () => {
    const { data } = await supabase.from("vehicle_types").select("*").eq("id", id).single();
    setVehicleType(data);
    setLoading(false);
  };

  if (loading) return <Layout><LoadingSpinner /></Layout>;
  if (!vehicleType) return <Layout><div>Vehicle type not found</div></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/vehicle-types")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">{vehicleType.type_name}</h1>
              <Badge variant={vehicleType.is_active ? "default" : "secondary"}>
                {vehicleType.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
          <Button onClick={() => navigate(`/vehicle-types/${id}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow label="Type Name" value={vehicleType.type_name} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dimensions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <DetailRow label="Length (cm)" value={vehicleType.length_cm} />
            <DetailRow label="Breadth (cm)" value={vehicleType.breadth_cm} />
            <DetailRow label="Height (cm)" value={vehicleType.height_cm} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Capacity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <DetailRow label="Weight Capacity (kg)" value={vehicleType.weight_capacity_kg} />
            <DetailRow label="Volume Capacity (CBM)" value={vehicleType.volume_capacity_cbm} />
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
