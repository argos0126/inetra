import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { DataTable } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ShipmentStatusWorkflow } from "@/components/shipment/ShipmentStatusWorkflow";
import { ShipmentBulkImport } from "@/components/shipment/ShipmentBulkImport";
import { GeofenceMonitor } from "@/components/shipment/GeofenceMonitor";
import { Database } from "@/integrations/supabase/types";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type ShipmentStatus = Database["public"]["Enums"]["shipment_status"];

interface Shipment {
  id: string;
  shipment_code: string;
  lr_number: string | null;
  waybill_number: string | null;
  order_id: string | null;
  status: ShipmentStatus;
  weight_kg: number | null;
  volume_cbm: number | null;
  quantity: number | null;
  shipment_type: string | null;
  customer: { display_name: string } | null;
  pickup_location: { location_name: string } | null;
  drop_location: { location_name: string } | null;
  trip: { trip_code: string } | null;
}

const statusColors: Record<ShipmentStatus, string> = {
  created: "bg-gray-500 text-white",
  confirmed: "bg-blue-500 text-white",
  mapped: "bg-purple-500 text-white",
  in_pickup: "bg-orange-500 text-white",
  in_transit: "bg-indigo-500 text-white",
  out_for_delivery: "bg-cyan-500 text-white",
  delivered: "bg-green-500 text-white",
  ndr: "bg-red-500 text-white",
  returned: "bg-rose-500 text-white",
  success: "bg-emerald-600 text-white",
};

const statusLabels: Record<ShipmentStatus, string> = {
  created: "Created",
  confirmed: "Confirmed",
  mapped: "Mapped",
  in_pickup: "In Pickup",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  ndr: "NDR",
  returned: "Returned",
  success: "Success",
};

export default function Shipments() {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shipmentToDelete, setShipmentToDelete] = useState<Shipment | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchShipments();
  }, []);

  const fetchShipments = async () => {
    try {
      const { data, error } = await supabase
        .from("shipments")
        .select(`
          *,
          customer:customers(display_name),
          pickup_location:locations!shipments_pickup_location_id_fkey(location_name),
          drop_location:locations!shipments_drop_location_id_fkey(location_name),
          trip:trips(trip_code)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setShipments(data || []);
    } catch (error: any) {
      toast({ title: "Error fetching shipments", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (shipmentId: string, newStatus: ShipmentStatus) => {
    try {
      const { error } = await supabase
        .from("shipments")
        .update({ status: newStatus })
        .eq("id", shipmentId);
      if (error) throw error;
      
      setShipments(prev => 
        prev.map(s => s.id === shipmentId ? { ...s, status: newStatus } : s)
      );
      setSelectedShipment(null);
      toast({ title: "Status updated", description: `Shipment status changed to ${statusLabels[newStatus]}` });
    } catch (error: any) {
      toast({ title: "Error updating status", description: error.message, variant: "destructive" });
    }
  };

  const columns = [
    { key: "shipment_code", label: "Shipment Code" },
    { key: "lr_number", label: "LR Number", render: (value: string | null) => value || "-" },
    { key: "customer", label: "Customer", render: (value: { display_name: string } | null) => value?.display_name || "-" },
    { key: "pickup_location", label: "Pickup", render: (value: { location_name: string } | null) => value?.location_name || "-" },
    { key: "drop_location", label: "Drop", render: (value: { location_name: string } | null) => value?.location_name || "-" },
    { key: "trip", label: "Trip", render: (value: { trip_code: string } | null) => value?.trip_code || "-" },
    { key: "weight_kg", label: "Weight (kg)", render: (value: number | null) => value?.toFixed(2) || "-" },
    { key: "status", label: "Status", render: (value: ShipmentStatus) => (
      <Badge className={statusColors[value]}>{statusLabels[value]}</Badge>
    ) },
  ];

  const handleAdd = () => navigate("/shipments/add");
  const handleEdit = (shipment: Shipment) => navigate(`/shipments/${shipment.id}/edit`);
  const handleView = (shipment: Shipment) => setSelectedShipment(shipment);

  const handleDeleteClick = (shipment: Shipment) => {
    if (shipment.status !== "created") {
      toast({ title: "Cannot delete", description: "Only shipments in 'Created' status can be deleted.", variant: "destructive" });
      return;
    }
    setShipmentToDelete(shipment);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!shipmentToDelete) return;
    try {
      const { error } = await supabase.from("shipments").delete().eq("id", shipmentToDelete.id);
      if (error) throw error;
      setShipments(shipments.filter(s => s.id !== shipmentToDelete.id));
      toast({ title: "Shipment deleted", description: `${shipmentToDelete.shipment_code} has been removed.` });
    } catch (error: any) {
      toast({ title: "Error deleting shipment", description: error.message, variant: "destructive" });
    }
    setShipmentToDelete(null);
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><LoadingSpinner /></div></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Geofence Monitor */}
        <GeofenceMonitor 
          autoRefresh={true}
          refreshInterval={120}
          onEvent={fetchShipments}
        />

        <DataTable
          title="Shipments"
          description="Manage all shipments and their status workflow"
          columns={columns}
          data={shipments}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
          onView={handleView}
          searchPlaceholder="Search shipments..."
          headerActions={<ShipmentBulkImport onImportComplete={fetchShipments} />}
        />

        {selectedShipment && (
          <ShipmentStatusWorkflow
            shipment={selectedShipment}
            onStatusChange={handleStatusChange}
            onClose={() => setSelectedShipment(null)}
          />
        )}

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Shipment"
          description={`Are you sure you want to delete shipment "${shipmentToDelete?.shipment_code}"? This action cannot be undone.`}
          confirmText="Delete"
          onConfirm={handleDeleteConfirm}
          variant="destructive"
        />
      </div>
    </Layout>
  );
}
