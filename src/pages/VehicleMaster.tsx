import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { DataTable } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { VehicleBulkImport } from "@/components/vehicle/VehicleBulkImport";

interface VehicleType {
  id: string;
  type_name: string;
}

interface Transporter {
  id: string;
  transporter_name: string;
}

interface TrackingAsset {
  id: string;
  display_name: string;
}

interface Vehicle {
  id: string;
  vehicle_number: string;
  make: string | null;
  model: string | null;
  is_dedicated: boolean;
  is_active: boolean;
  vehicle_type?: VehicleType;
  transporter?: Transporter;
  tracking_asset?: TrackingAsset;
}

export default function VehicleMaster() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const channel = supabase
      .channel('vehicles-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => fetchVehicles())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase.from("vehicles").select(`
        *,
        vehicle_type:vehicle_types(id, type_name),
        transporter:transporters(id, transporter_name),
        tracking_asset:tracking_assets(id, display_name)
      `).order("created_at", { ascending: false });
      if (error) throw error;
      setVehicles(data || []);
    } catch (error: any) {
      toast({ title: "Error fetching vehicles", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: "vehicle_number", label: "Vehicle No." },
    { key: "vehicle_type", label: "Type", render: (value: VehicleType) => value?.type_name || "-" },
    { key: "make", label: "Make" },
    { key: "model", label: "Model" },
    { key: "transporter", label: "Transporter", render: (value: Transporter) => value?.transporter_name || "-" },
    { key: "tracking_asset", label: "Tracking", render: (value: TrackingAsset) => value?.display_name || "-" },
    { key: "is_dedicated", label: "Dedicated", render: (value: boolean) => (
      <Badge variant={value ? "default" : "outline"}>{value ? "Yes" : "No"}</Badge>
    ) },
    { key: "is_active", label: "Status", render: (value: boolean) => (
      <Badge variant={value ? "default" : "destructive"}>{value ? "Active" : "Inactive"}</Badge>
    ) }
  ];

  const handleAdd = () => navigate("/vehicles/add");
  const handleEdit = (vehicle: Vehicle) => navigate(`/vehicles/${vehicle.id}/edit`);
  const handleView = (vehicle: Vehicle) => navigate(`/vehicles/${vehicle.id}`);

  const handleDeleteClick = (vehicle: Vehicle) => {
    setVehicleToDelete(vehicle);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!vehicleToDelete) return;
    
    try {
      const { error } = await supabase.from("vehicles").delete().eq("id", vehicleToDelete.id);
      if (error) throw error;
      setVehicles(vehicles.filter(v => v.id !== vehicleToDelete.id));
      toast({ title: "Vehicle deleted", description: `${vehicleToDelete.vehicle_number} has been removed.` });
    } catch (error: any) {
      toast({ title: "Error deleting vehicle", description: error.message, variant: "destructive" });
    } finally {
      setDeleteDialogOpen(false);
      setVehicleToDelete(null);
    }
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><LoadingSpinner /></div></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <DataTable
          title="Vehicle Fleet"
          description="Manage your fleet vehicles and their assignments"
          columns={columns}
          data={vehicles}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
          onView={handleView}
          searchPlaceholder="Search vehicles..."
          headerActions={<VehicleBulkImport onImportComplete={fetchVehicles} />}
        />

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Vehicle"
          description={`Are you sure you want to delete vehicle "${vehicleToDelete?.vehicle_number}"? This action cannot be undone.`}
          onConfirm={handleDeleteConfirm}
          confirmText="Delete"
          cancelText="Cancel"
        />
      </div>
    </Layout>
  );
}
