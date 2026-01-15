import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { DataTable } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface VehicleType {
  id: string;
  type_name: string;
  length_cm: number | null;
  breadth_cm: number | null;
  height_cm: number | null;
  weight_capacity_kg: number | null;
  volume_capacity_cbm: number | null;
  is_active: boolean;
}

export default function VehicleTypes() {
  const navigate = useNavigate();
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<VehicleType | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchVehicleTypes();
  }, []);

  const fetchVehicleTypes = async () => {
    try {
      const { data, error } = await supabase.from("vehicle_types").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setVehicleTypes(data || []);
    } catch (error: any) {
      toast({ title: "Error fetching vehicle types", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: "type_name", label: "Type Name" },
    { key: "length_cm", label: "Length (cm)" },
    { key: "breadth_cm", label: "Breadth (cm)" },
    { key: "height_cm", label: "Height (cm)" },
    { key: "weight_capacity_kg", label: "Weight Capacity (kg)" },
    { key: "volume_capacity_cbm", label: "Volume (CBM)" },
    { key: "is_active", label: "Status", render: (value: boolean) => (
      <Badge variant={value ? "default" : "destructive"}>{value ? "Active" : "Inactive"}</Badge>
    ) }
  ];

  const handleAdd = () => navigate("/vehicle-types/add");
  const handleEdit = (type: VehicleType) => navigate(`/vehicle-types/${type.id}/edit`);
  const handleView = (type: VehicleType) => navigate(`/vehicle-types/${type.id}`);

  const handleDeleteClick = (type: VehicleType) => {
    setTypeToDelete(type);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!typeToDelete) return;
    try {
      const { error } = await supabase.from("vehicle_types").delete().eq("id", typeToDelete.id);
      if (error) throw error;
      setVehicleTypes(vehicleTypes.filter(t => t.id !== typeToDelete.id));
      toast({ title: "Vehicle type deleted", description: `${typeToDelete.type_name} has been removed.` });
    } catch (error: any) {
      toast({ title: "Error deleting vehicle type", description: error.message, variant: "destructive" });
    }
    setTypeToDelete(null);
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><LoadingSpinner /></div></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <DataTable
          title="Vehicle Types"
          description="Manage vehicle type definitions and capacity"
          columns={columns}
          data={vehicleTypes}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
          onView={handleView}
          searchPlaceholder="Search vehicle types..."
        />

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Vehicle Type"
          description={`Are you sure you want to delete "${typeToDelete?.type_name}"? This action cannot be undone.`}
          confirmText="Delete"
          onConfirm={handleDeleteConfirm}
          variant="destructive"
        />
      </div>
    </Layout>
  );
}
