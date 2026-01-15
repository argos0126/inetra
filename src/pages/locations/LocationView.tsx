import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DetailRow } from "@/components/DetailRow";
import { StatusToggle } from "@/components/StatusToggle";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Location {
  id: string; location_name: string; location_type: string;
  address: string | null; city: string | null; state: string | null; pincode: string | null;
  district: string | null; zone: string | null;
  latitude: number | null; longitude: number | null;
  sim_radius_meters: number | null; gps_radius_meters: number | null;
  integration_id: string | null; is_active: boolean;
  customer?: { display_name: string };
}

const typeColors: Record<string, "default" | "secondary" | "outline"> = {
  node: "outline", consignee: "default", plant: "secondary", warehouse: "secondary", distribution_center: "default"
};

export default function LocationView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => { if (id) fetchLocation(); }, [id]);

  const fetchLocation = async () => {
    try {
      const { data, error } = await supabase.from("locations").select(`*, customer:customers(display_name)`).eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) { navigate("/locations"); return; }
      setLocation(data);
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const handleStatusToggle = async (newStatus: boolean) => {
    if (!location) return;
    try {
      const { error } = await supabase.from("locations").update({ is_active: newStatus }).eq("id", location.id);
      if (error) throw error;
      setLocation({ ...location, is_active: newStatus });
      toast({ title: "Success", description: `Location ${newStatus ? "activated" : "deactivated"}` });
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
  };

  const handleDelete = async () => {
    if (!location) return;
    try {
      const { error } = await supabase.from("locations").delete().eq("id", location.id);
      if (error) throw error;
      toast({ title: "Success", description: "Location deleted" });
      navigate("/locations");
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-96"><LoadingSpinner /></div></Layout>;
  if (!location) return null;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/locations")}><ArrowLeft className="h-5 w-5" /></Button>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-3xl font-bold">{location.location_name}</h1>
                <Badge variant={location.is_active ? "default" : "secondary"}>{location.is_active ? "Active" : "Inactive"}</Badge>
                <Badge variant={typeColors[location.location_type]}>{location.location_type.replace('_', ' ')}</Badge>
              </div>
              <p className="text-muted-foreground">Location Details</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => navigate(`/locations/${id}/edit`)}><Edit className="h-4 w-4 mr-2" />Edit</Button>
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}><Trash2 className="h-4 w-4 mr-2" />Delete</Button>
          </div>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <DetailRow label="Location Name" value={location.location_name} />
              <DetailRow label="Location Type" value={location.location_type.replace('_', ' ')} />
              <DetailRow label="Customer" value={location.customer?.display_name} />
              <DetailRow label="Integration ID" value={location.integration_id} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Address Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <DetailRow label="Address" value={location.address} className="md:col-span-2" />
              <DetailRow label="City" value={location.city} />
              <DetailRow label="District" value={location.district} />
              <DetailRow label="State" value={location.state} />
              <DetailRow label="Pincode" value={location.pincode} />
              <DetailRow label="Zone" value={location.zone} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Geofencing</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <DetailRow label="Latitude" value={location.latitude} />
              <DetailRow label="Longitude" value={location.longitude} />
              <DetailRow label="GPS Radius (m)" value={location.gps_radius_meters} />
              <DetailRow label="SIM Radius (m)" value={location.sim_radius_meters} />
            </CardContent>
          </Card>

          <StatusToggle isActive={location.is_active} onToggle={handleStatusToggle} />
        </div>

        <ConfirmDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} title="Delete Location" description={`Are you sure you want to delete "${location.location_name}"?`} onConfirm={handleDelete} confirmText="Delete" variant="destructive" />
      </div>
    </Layout>
  );
}
