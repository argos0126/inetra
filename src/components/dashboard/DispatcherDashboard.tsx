import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Truck, Users, Calendar, Plus, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { DashboardHeader } from "./DashboardHeader";
import { StatWidget } from "./StatWidget";
import { QuickActionCard } from "./QuickActionCard";

export function DispatcherDashboard() {
  const navigate = useNavigate();

  const { data: shipmentStats, isLoading: shipmentsLoading } = useQuery({
    queryKey: ['dispatcher-shipment-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shipments').select('status, trip_id, planned_pickup_time, planned_delivery_time');
      if (error) throw error;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return {
        unmapped: data?.filter(s => !s.trip_id && ['created', 'confirmed'].includes(s.status)).length || 0,
        todayPickups: data?.filter(s => s.planned_pickup_time && new Date(s.planned_pickup_time) >= today && new Date(s.planned_pickup_time) < tomorrow).length || 0,
        todayDeliveries: data?.filter(s => s.planned_delivery_time && new Date(s.planned_delivery_time) >= today && new Date(s.planned_delivery_time) < tomorrow).length || 0,
        total: data?.length || 0,
      };
    }
  });

  const { data: resourceStats, isLoading: resourcesLoading } = useQuery({
    queryKey: ['dispatcher-resources'],
    queryFn: async () => {
      const [drivers, vehicles, activeTrips] = await Promise.all([
        supabase.from('drivers').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('trips').select('driver_id, vehicle_id').in('status', ['ongoing', 'created']),
      ]);
      const busyDrivers = new Set(activeTrips.data?.map(t => t.driver_id).filter(Boolean)).size;
      const busyVehicles = new Set(activeTrips.data?.map(t => t.vehicle_id).filter(Boolean)).size;
      return {
        availableDrivers: (drivers.count || 0) - busyDrivers,
        availableVehicles: (vehicles.count || 0) - busyVehicles,
        totalDrivers: drivers.count || 0,
        totalVehicles: vehicles.count || 0,
      };
    }
  });

  const { data: unmappedShipments } = useQuery({
    queryKey: ['dispatcher-unmapped-shipments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipments')
        .select(`id, shipment_code, status, created_at, pickup_location:locations!shipments_pickup_location_id_fkey(location_name), drop_location:locations!shipments_drop_location_id_fkey(location_name), customer:customers(display_name)`)
        .is('trip_id', null)
        .in('status', ['created', 'confirmed'])
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    }
  });

  if (shipmentsLoading || resourcesLoading) {
    return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <DashboardHeader title="Dispatcher Dashboard" subtitle="Manage shipment assignments and scheduling" />

      <QuickActionCard actions={[
        { label: "Create Shipment", icon: Plus, href: "/shipments/add" },
        { label: "Create Trip", icon: Truck, href: "/trips/add" },
        { label: "All Shipments", icon: Package, href: "/shipments" },
      ]} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatWidget title="Unmapped Shipments" value={shipmentStats?.unmapped || 0} icon={Package} iconColor="text-orange-600" iconBgColor="bg-orange-100" onClick={() => navigate('/shipments?unmapped=true')} />
        <StatWidget title="Today's Pickups" value={shipmentStats?.todayPickups || 0} icon={Calendar} iconColor="text-blue-600" iconBgColor="bg-blue-100" />
        <StatWidget title="Today's Deliveries" value={shipmentStats?.todayDeliveries || 0} icon={Calendar} iconColor="text-green-600" iconBgColor="bg-green-100" />
        <StatWidget title="Available Drivers" value={`${resourceStats?.availableDrivers}/${resourceStats?.totalDrivers}`} icon={Users} iconColor="text-purple-600" iconBgColor="bg-purple-100" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatWidget title="Available Vehicles" value={`${resourceStats?.availableVehicles}/${resourceStats?.totalVehicles}`} icon={Truck} iconColor="text-indigo-600" iconBgColor="bg-indigo-100" />
        <StatWidget title="Total Shipments" value={shipmentStats?.total || 0} icon={Package} iconColor="text-gray-600" iconBgColor="bg-gray-100" />
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Shipments Awaiting Assignment</CardTitle></CardHeader>
        <CardContent>
          {unmappedShipments && unmappedShipments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {unmappedShipments.map((shipment) => (
                <div key={shipment.id} className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => navigate(`/shipments/${shipment.id}`)}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{shipment.shipment_code}</span>
                    <Badge variant="outline">{shipment.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{shipment.customer?.display_name || 'N/A'}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {shipment.pickup_location?.location_name || 'N/A'} → {shipment.drop_location?.location_name || 'N/A'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground"><Package className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>All shipments are assigned</p></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
