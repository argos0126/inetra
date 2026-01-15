import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { DataTable } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Eye, PackageCheck, PackageX, Plus } from "lucide-react";
import { TripBulkImport } from "@/components/trip/TripBulkImport";

interface Location {
  id: string;
  location_name: string;
}

interface Vehicle {
  id: string;
  vehicle_number: string;
}

interface Driver {
  id: string;
  name: string;
}

interface Customer {
  id: string;
  display_name: string;
}

interface Trip {
  id: string;
  trip_code: string;
  origin_location_id: string | null;
  destination_location_id: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  customer_id: string | null;
  status: string;
  planned_start_time: string | null;
  current_eta: string | null;
  origin_location?: Location;
  destination_location?: Location;
  vehicle?: Vehicle;
  driver?: Driver;
  customer?: Customer;
  shipment_count?: number;
  // Flattened fields for search
  origin_name?: string;
  destination_name?: string;
  vehicle_number?: string;
  driver_name?: string;
}

const statusColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  created: "outline",
  ongoing: "secondary",
  completed: "default",
  cancelled: "destructive",
  on_hold: "outline",
  closed: "secondary"
};

export default function Trips() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tripToDelete, setTripToDelete] = useState<Trip | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const channel = supabase
      .channel('trips-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trips' },
        () => fetchTrips()
      )
      .subscribe();

    fetchTrips();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTrips = async () => {
    try {
      // Fetch trips with related data
      const { data: tripsData, error: tripsError } = await supabase.from("trips").select(`
        *,
        origin_location:locations!trips_origin_location_id_fkey(id, location_name),
        destination_location:locations!trips_destination_location_id_fkey(id, location_name),
        vehicle:vehicles(id, vehicle_number),
        driver:drivers(id, name),
        customer:customers(id, display_name)
      `).order("created_at", { ascending: false });

      if (tripsError) throw tripsError;

      // Fetch shipment counts for all trips
      const tripIds = (tripsData || []).map(t => t.id);
      const { data: shipmentCounts, error: countError } = await supabase
        .from("shipments")
        .select("trip_id")
        .in("trip_id", tripIds);

      if (countError) throw countError;

      // Count shipments per trip
      const shipmentCountMap: Record<string, number> = {};
      (shipmentCounts || []).forEach(s => {
        if (s.trip_id) {
          shipmentCountMap[s.trip_id] = (shipmentCountMap[s.trip_id] || 0) + 1;
        }
      });

      // Merge shipment count into trips and flatten location names for search
      const tripsWithShipments = (tripsData || []).map(trip => ({
        ...trip,
        shipment_count: shipmentCountMap[trip.id] || 0,
        // Flatten nested location names for better search
        origin_name: trip.origin_location?.location_name || '',
        destination_name: trip.destination_location?.location_name || '',
        vehicle_number: trip.vehicle?.vehicle_number || '',
        driver_name: trip.driver?.name || ''
      }));

      setTrips(tripsWithShipments);
    } catch (error: any) {
      toast({
        title: "Error fetching trips",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatEta = (eta: string | null) => {
    if (!eta) return "-";
    const date = new Date(eta);
    return date.toLocaleString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  const columns = [
    { key: "trip_code", label: "Trip Code" },
    { key: "origin_location", label: "Origin", render: (value: Location) => value?.location_name || "-" },
    { key: "destination_location", label: "Destination", render: (value: Location) => value?.location_name || "-" },
    { key: "vehicle", label: "Vehicle", render: (value: Vehicle) => value?.vehicle_number || "-" },
    { key: "driver", label: "Driver", render: (value: Driver) => value?.name || "-" },
    { key: "shipment_count", label: "Shipments", render: (value: number) => (
      <Badge variant="outline" className={value > 0 
        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
        : "bg-muted text-muted-foreground"
      }>
        {value > 0 ? (
          <><PackageCheck className="h-3 w-3 mr-1" />{value}</>
        ) : (
          <><PackageX className="h-3 w-3 mr-1" />None</>
        )}
      </Badge>
    ) },
    { key: "status", label: "Status", render: (value: string) => (
      <Badge variant={statusColors[value] || "outline"}>
        {value?.replace("_", " ")}
      </Badge>
    ) },
    { key: "current_eta", label: "ETA", render: (value: string | null) => formatEta(value) },
    { key: "planned_start_time", label: "Planned Start", render: (value: string) => 
      value ? new Date(value).toLocaleDateString() : "-"
    },
    {
      key: "actions",
      label: "",
      render: (_: any, trip: Trip) => (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/trips/${trip.id}`);
          }}
        >
          <Eye className="h-4 w-4 mr-1" />
          View
        </Button>
      )
    }
  ];

  const handleAdd = () => {
    navigate("/trips/add");
  };

  const handleEdit = (trip: Trip) => {
    navigate(`/trips/${trip.id}/edit`);
  };

  const handleDeleteClick = (trip: Trip) => {
    setTripToDelete(trip);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!tripToDelete) return;
    
    try {
      const { error } = await supabase.from("trips").delete().eq("id", tripToDelete.id);
      if (error) throw error;
      
      setTrips(trips.filter(t => t.id !== tripToDelete.id));
      toast({
        title: "Trip deleted",
        description: `${tripToDelete.trip_code} has been removed successfully.`
      });
    } catch (error: any) {
      toast({
        title: "Error deleting trip",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setDeleteDialogOpen(false);
      setTripToDelete(null);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <DataTable
          title="Trip Management"
          description="Plan, track and manage transportation trips"
          columns={columns}
          data={trips}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
          searchPlaceholder="Search trips..."
          headerActions={
            <TripBulkImport onImportComplete={fetchTrips} />
          }
        />

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Trip"
          description={`Are you sure you want to delete trip "${tripToDelete?.trip_code}"? This action cannot be undone.`}
          onConfirm={handleDeleteConfirm}
          confirmText="Delete"
          cancelText="Cancel"
        />
      </div>
    </Layout>
  );
}