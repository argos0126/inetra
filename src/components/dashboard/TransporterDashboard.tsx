import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, Users, MapPin, TrendingUp, Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { DashboardHeader } from "./DashboardHeader";
import { StatWidget } from "./StatWidget";
import { QuickActionCard } from "./QuickActionCard";

export function TransporterDashboard() {
  const navigate = useNavigate();

  const { data: fleetStats, isLoading: fleetLoading } = useQuery({
    queryKey: ['transporter-fleet-stats'],
    queryFn: async () => {
      const [vehicles, drivers] = await Promise.all([
        supabase.from('vehicles').select('id, is_active').eq('is_active', true),
        supabase.from('drivers').select('id, is_active').eq('is_active', true),
      ]);
      return {
        vehicles: vehicles.data?.length || 0,
        drivers: drivers.data?.length || 0,
      };
    }
  });

  const { data: tripStats, isLoading: tripsLoading } = useQuery({
    queryKey: ['transporter-trip-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('trips').select('status');
      if (error) throw error;
      return {
        ongoing: data?.filter(t => t.status === 'ongoing').length || 0,
        completed: data?.filter(t => t.status === 'completed').length || 0,
        total: data?.length || 0,
      };
    }
  });

  const { data: assignedTrips } = useQuery({
    queryKey: ['transporter-assigned-trips'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select(`id, trip_code, status, created_at, origin_location:locations!trips_origin_location_id_fkey(location_name), destination_location:locations!trips_destination_location_id_fkey(location_name), vehicle:vehicles(vehicle_number), driver:drivers(name)`)
        .in('status', ['ongoing', 'created'])
        .order('created_at', { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    }
  });

  if (fleetLoading || tripsLoading) {
    return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>;
  }

  const completionRate = tripStats?.total ? Math.round((tripStats.completed / tripStats.total) * 100) : 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <DashboardHeader title="Transporter Dashboard" subtitle="Manage your fleet and assigned trips" />

      <QuickActionCard actions={[
        { label: "View Trips", icon: Truck, href: "/trips" },
        { label: "My Vehicles", icon: Truck, href: "/vehicles" },
        { label: "My Drivers", icon: Users, href: "/drivers" },
      ]} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatWidget title="My Vehicles" value={fleetStats?.vehicles || 0} icon={Truck} iconColor="text-blue-600" iconBgColor="bg-blue-100" onClick={() => navigate('/vehicles')} />
        <StatWidget title="My Drivers" value={fleetStats?.drivers || 0} icon={Users} iconColor="text-green-600" iconBgColor="bg-green-100" onClick={() => navigate('/drivers')} />
        <StatWidget title="Active Trips" value={tripStats?.ongoing || 0} icon={MapPin} iconColor="text-purple-600" iconBgColor="bg-purple-100" />
        <StatWidget title="Completion Rate" value={`${completionRate}%`} icon={TrendingUp} iconColor="text-orange-600" iconBgColor="bg-orange-100" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatWidget title="Total Trips" value={tripStats?.total || 0} icon={Truck} />
        <StatWidget title="Completed Trips" value={tripStats?.completed || 0} icon={Package} iconColor="text-green-600" iconBgColor="bg-green-100" />
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" />Assigned Trips</CardTitle></CardHeader>
        <CardContent>
          {assignedTrips && assignedTrips.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {assignedTrips.map((trip) => (
                <div key={trip.id} className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => navigate(`/trips/${trip.id}`)}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{trip.trip_code}</span>
                    <Badge variant={trip.status === 'ongoing' ? 'default' : 'outline'}>{trip.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {trip.origin_location?.location_name || 'N/A'} → {trip.destination_location?.location_name || 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {trip.vehicle?.vehicle_number || 'No vehicle'} • {trip.driver?.name || 'No driver'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground"><Truck className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No assigned trips</p></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
