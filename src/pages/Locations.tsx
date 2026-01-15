import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { DataTable } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Customer {
  id: string;
  display_name: string;
}

interface Location {
  id: string;
  location_name: string;
  location_type: string;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  customer?: Customer;
}

const locationTypeColors: Record<string, "default" | "secondary" | "outline"> = {
  node: "outline",
  consignee: "default",
  plant: "secondary",
  warehouse: "secondary",
  distribution_center: "default",
  hub: "default",
  branch: "secondary",
  headquarters: "default",
  regional_office: "secondary"
};

export default function Locations() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<Location | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const channel = supabase
      .channel('locations-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, () => fetchLocations())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase.from("locations").select(`
        *,
        customer:customers(id, display_name)
      `).order("created_at", { ascending: false });
      if (error) throw error;
      setLocations(data || []);
    } catch (error: any) {
      toast({ title: "Error fetching locations", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: "location_name", label: "Location Name" },
    { key: "location_type", label: "Type", render: (value: string) => (
      <Badge variant={locationTypeColors[value] || "outline"}>{value?.replace("_", " ")}</Badge>
    ) },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
    { key: "customer", label: "Customer", render: (value: Customer) => value?.display_name || "-" },
    { key: "latitude", label: "Lat", render: (value: number) => value?.toFixed(4) || "-" },
    { key: "longitude", label: "Long", render: (value: number) => value?.toFixed(4) || "-" },
    { key: "is_active", label: "Status", render: (value: boolean) => (
      <Badge variant={value ? "default" : "destructive"}>{value ? "Active" : "Inactive"}</Badge>
    ) }
  ];

  const handleAdd = () => navigate("/locations/add");
  const handleEdit = (location: Location) => navigate(`/locations/${location.id}/edit`);
  const handleView = (location: Location) => navigate(`/locations/${location.id}`);

  const handleDeleteClick = (location: Location) => {
    setLocationToDelete(location);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!locationToDelete) return;
    try {
      const { error } = await supabase.from("locations").delete().eq("id", locationToDelete.id);
      if (error) throw error;
      setLocations(locations.filter(l => l.id !== locationToDelete.id));
      toast({ title: "Location deleted", description: `${locationToDelete.location_name} has been removed.` });
    } catch (error: any) {
      toast({ title: "Error deleting location", description: error.message, variant: "destructive" });
    }
    setLocationToDelete(null);
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><LoadingSpinner /></div></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <DataTable
          title="Locations"
          description="Manage warehouses, distribution centers, and pickup points"
          columns={columns}
          data={locations}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
          onView={handleView}
          searchPlaceholder="Search locations..."
        />

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Location"
          description={`Are you sure you want to delete "${locationToDelete?.location_name}"? This action cannot be undone.`}
          confirmText="Delete"
          onConfirm={handleDeleteConfirm}
          variant="destructive"
        />
      </div>
    </Layout>
  );
}
