import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { DataTable } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Location {
  id: string;
  location_name: string;
}

interface Transporter {
  id: string;
  transporter_name: string;
}

interface ServiceabilityLane {
  id: string;
  lane_code: string;
  freight_type: string;
  serviceability_mode: string;
  standard_tat_hours: number | null;
  distance_km: number | null;
  is_active: boolean;
  origin_location?: Location;
  destination_location?: Location;
  transporter?: Transporter;
  // Flattened fields for search
  origin_name?: string;
  destination_name?: string;
  transporter_name?: string;
  status_text?: string;
  tat_display?: string;
}

export default function ServiceabilityLanes() {
  const navigate = useNavigate();
  const [lanes, setLanes] = useState<ServiceabilityLane[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [laneToDelete, setLaneToDelete] = useState<ServiceabilityLane | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchLanes();
  }, []);

  // Format TAT for display
  const formatTat = (hours: number | null): string => {
    if (hours === null || hours === undefined) return '-';
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const fetchLanes = async () => {
    try {
      const { data, error } = await supabase.from("serviceability_lanes").select(`
        *,
        origin_location:locations!serviceability_lanes_origin_location_id_fkey(id, location_name),
        destination_location:locations!serviceability_lanes_destination_location_id_fkey(id, location_name),
        transporter:transporters(id, transporter_name)
      `).order("created_at", { ascending: false });
      if (error) throw error;
      
      // Flatten nested fields for better search
      const flattenedData = (data || []).map(lane => ({
        ...lane,
        origin_name: lane.origin_location?.location_name || '',
        destination_name: lane.destination_location?.location_name || '',
        transporter_name: lane.transporter?.transporter_name || '',
        status_text: lane.is_active ? 'active' : 'inactive',
        tat_display: formatTat(lane.standard_tat_hours),
      }));
      
      setLanes(flattenedData);
    } catch (error: any) {
      toast({ title: "Error fetching lanes", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: "lane_code", label: "Lane Code" },
    { key: "origin_name", label: "Origin" },
    { key: "destination_name", label: "Destination" },
    { key: "freight_type", label: "Freight", render: (value: string) => (
      <Badge variant="secondary">{value?.toUpperCase()}</Badge>
    ) },
    { key: "serviceability_mode", label: "Mode", render: (value: string) => (
      <Badge variant="outline">{value}</Badge>
    ) },
    { key: "transporter_name", label: "Transporter", render: (value: string) => value || "-" },
    { key: "tat_display", label: "TAT" },
    { key: "distance_km", label: "Distance (km)" },
    { key: "status_text", label: "Status", render: (_: string, row: ServiceabilityLane) => (
      <Badge variant={row.is_active ? "default" : "destructive"}>{row.is_active ? "Active" : "Inactive"}</Badge>
    ) }
  ];

  const handleAdd = () => navigate("/serviceability-lanes/add");
  const handleEdit = (lane: ServiceabilityLane) => navigate(`/serviceability-lanes/${lane.id}/edit`);
  const handleView = (lane: ServiceabilityLane) => navigate(`/serviceability-lanes/${lane.id}`);

  const handleDeleteClick = (lane: ServiceabilityLane) => {
    setLaneToDelete(lane);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!laneToDelete) return;
    try {
      const { error } = await supabase.from("serviceability_lanes").delete().eq("id", laneToDelete.id);
      if (error) throw error;
      setLanes(lanes.filter(l => l.id !== laneToDelete.id));
      toast({ title: "Lane deleted", description: `${laneToDelete.lane_code} has been removed.` });
    } catch (error: any) {
      toast({ title: "Error deleting lane", description: error.message, variant: "destructive" });
    }
    setLaneToDelete(null);
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><LoadingSpinner /></div></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <DataTable
          title="Serviceability Lanes"
          description="Manage origin-destination lane configurations"
          columns={columns}
          data={lanes}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
          onView={handleView}
          searchPlaceholder="Search lanes..."
        />

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Lane"
          description={`Are you sure you want to delete lane "${laneToDelete?.lane_code}"? This action cannot be undone.`}
          confirmText="Delete"
          onConfirm={handleDeleteConfirm}
          variant="destructive"
        />
      </div>
    </Layout>
  );
}
