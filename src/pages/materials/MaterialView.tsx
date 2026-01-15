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

export default function MaterialView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [material, setMaterial] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMaterial();
  }, [id]);

  const fetchMaterial = async () => {
    const { data } = await supabase.from("materials").select("*").eq("id", id).single();
    setMaterial(data);
    setLoading(false);
  };

  if (loading) return <Layout><LoadingSpinner /></Layout>;
  if (!material) return <Layout><div>Material not found</div></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/materials")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">{material.name}</h1>
              <div className="flex gap-2 mt-1">
                <Badge variant={material.is_active ? "default" : "secondary"}>
                  {material.is_active ? "Active" : "Inactive"}
                </Badge>
                {material.is_bulk && <Badge variant="outline">Bulk</Badge>}
              </div>
            </div>
          </div>
          <Button onClick={() => navigate(`/materials/${id}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <DetailRow label="Name" value={material.name} />
            <DetailRow label="SKU Code" value={material.sku_code} />
            <DetailRow label="Packaging" value={material.packaging} />
            <DetailRow label="Units" value={material.units} />
            <div className="md:col-span-2">
              <DetailRow label="Description" value={material.description} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dimensions & Weight</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <DetailRow label="Length (cm)" value={material.length_cm} />
            <DetailRow label="Breadth (cm)" value={material.breadth_cm} />
            <DetailRow label="Height (cm)" value={material.height_cm} />
            <DetailRow label="Weight (kg)" value={material.weight_kg} />
            <DetailRow label="Volume (CBM)" value={material.volume_cbm} />
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
