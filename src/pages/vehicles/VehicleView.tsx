import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DetailRow } from "@/components/DetailRow";
import { StatusToggle } from "@/components/StatusToggle";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Vehicle {
  id: string; vehicle_number: string; make: string | null; model: string | null; year: number | null;
  is_dedicated: boolean; location_code: string | null; integration_code: string | null; is_active: boolean;
  rc_number: string | null; rc_issue_date: string | null; rc_expiry_date: string | null;
  puc_number: string | null; puc_issue_date: string | null; puc_expiry_date: string | null;
  insurance_number: string | null; insurance_issue_date: string | null; insurance_expiry_date: string | null;
  fitness_number: string | null; fitness_issue_date: string | null; fitness_expiry_date: string | null;
  permit_number: string | null; permit_issue_date: string | null; permit_expiry_date: string | null;
  vehicle_type?: { type_name: string }; transporter?: { transporter_name: string }; tracking_asset?: { display_name: string };
}

export default function VehicleView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => { if (id) fetchVehicle(); }, [id]);

  const fetchVehicle = async () => {
    try {
      const { data, error } = await supabase.from("vehicles").select(`*, vehicle_type:vehicle_types(type_name), transporter:transporters(transporter_name), tracking_asset:tracking_assets(display_name)`).eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) { navigate("/vehicles"); return; }
      setVehicle(data);
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const handleStatusToggle = async (newStatus: boolean) => {
    if (!vehicle) return;
    try {
      const { error } = await supabase.from("vehicles").update({ is_active: newStatus }).eq("id", vehicle.id);
      if (error) throw error;
      setVehicle({ ...vehicle, is_active: newStatus });
      toast({ title: "Success", description: `Vehicle ${newStatus ? "activated" : "deactivated"}` });
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
  };

  const handleDelete = async () => {
    if (!vehicle) return;
    try {
      const { error } = await supabase.from("vehicles").delete().eq("id", vehicle.id);
      if (error) throw error;
      toast({ title: "Success", description: "Vehicle deleted" });
      navigate("/vehicles");
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-96"><LoadingSpinner /></div></Layout>;
  if (!vehicle) return null;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/vehicles")}><ArrowLeft className="h-5 w-5" /></Button>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-3xl font-bold">{vehicle.vehicle_number}</h1>
                <Badge variant={vehicle.is_active ? "default" : "secondary"}>{vehicle.is_active ? "Active" : "Inactive"}</Badge>
                {vehicle.is_dedicated && <Badge variant="outline">Dedicated</Badge>}
              </div>
              <p className="text-muted-foreground">Vehicle Details</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => navigate(`/vehicles/${id}/edit`)}><Edit className="h-4 w-4 mr-2" />Edit</Button>
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}><Trash2 className="h-4 w-4 mr-2" />Delete</Button>
          </div>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <DetailRow label="Vehicle Number" value={vehicle.vehicle_number} />
              <DetailRow label="Vehicle Type" value={vehicle.vehicle_type?.type_name} />
              <DetailRow label="Transporter" value={vehicle.transporter?.transporter_name} />
              <DetailRow label="Tracking Asset" value={vehicle.tracking_asset?.display_name} />
              <DetailRow label="Make" value={vehicle.make} />
              <DetailRow label="Model" value={vehicle.model} />
              <DetailRow label="Year" value={vehicle.year} />
              <DetailRow label="Location Code" value={vehicle.location_code} />
              <DetailRow label="Integration Code" value={vehicle.integration_code} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Compliance Documents</CardTitle></CardHeader>
            <CardContent>
              <Tabs defaultValue="rc">
                <TabsList className="grid w-full grid-cols-5"><TabsTrigger value="rc">RC</TabsTrigger><TabsTrigger value="puc">PUC</TabsTrigger><TabsTrigger value="insurance">Insurance</TabsTrigger><TabsTrigger value="fitness">Fitness</TabsTrigger><TabsTrigger value="permit">Permit</TabsTrigger></TabsList>
                <TabsContent value="rc" className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                  <DetailRow label="RC Number" value={vehicle.rc_number} />
                  <DetailRow label="Issue Date" value={vehicle.rc_issue_date} />
                  <DetailRow label="Expiry Date" value={vehicle.rc_expiry_date} />
                </TabsContent>
                <TabsContent value="puc" className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                  <DetailRow label="PUC Number" value={vehicle.puc_number} />
                  <DetailRow label="Issue Date" value={vehicle.puc_issue_date} />
                  <DetailRow label="Expiry Date" value={vehicle.puc_expiry_date} />
                </TabsContent>
                <TabsContent value="insurance" className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                  <DetailRow label="Insurance Number" value={vehicle.insurance_number} />
                  <DetailRow label="Issue Date" value={vehicle.insurance_issue_date} />
                  <DetailRow label="Expiry Date" value={vehicle.insurance_expiry_date} />
                </TabsContent>
                <TabsContent value="fitness" className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                  <DetailRow label="Fitness Number" value={vehicle.fitness_number} />
                  <DetailRow label="Issue Date" value={vehicle.fitness_issue_date} />
                  <DetailRow label="Expiry Date" value={vehicle.fitness_expiry_date} />
                </TabsContent>
                <TabsContent value="permit" className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                  <DetailRow label="Permit Number" value={vehicle.permit_number} />
                  <DetailRow label="Issue Date" value={vehicle.permit_issue_date} />
                  <DetailRow label="Expiry Date" value={vehicle.permit_expiry_date} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <StatusToggle isActive={vehicle.is_active} onToggle={handleStatusToggle} />
        </div>

        <ConfirmDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} title="Delete Vehicle" description={`Are you sure you want to delete "${vehicle.vehicle_number}"?`} onConfirm={handleDelete} confirmText="Delete" variant="destructive" />
      </div>
    </Layout>
  );
}
