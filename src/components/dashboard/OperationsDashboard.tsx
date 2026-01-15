import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, Package, AlertTriangle, Clock, Play, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { DashboardHeader } from "./DashboardHeader";
import { StatWidget } from "./StatWidget";
import { QuickActionCard } from "./QuickActionCard";
import { TripExceptionsWidget } from "./TripExceptionsWidget";

export function OperationsDashboard() {
  const navigate = useNavigate();

  const { data: tripStats, isLoading: tripsLoading } = useQuery({
    queryKey: ['ops-trip-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('trips').select('status, planned_start_time');
      if (error) throw error;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const counts = { 
        created: 0, ongoing: 0, on_hold: 0, 
        todayScheduled: data?.filter(t => t.planned_start_time && new Date(t.planned_start_time).toDateString() === today.toDateString()).length || 0 
      };
      data?.forEach(trip => { if (counts[trip.status as keyof typeof counts] !== undefined) counts[trip.status as keyof typeof counts]++; });
      return counts;
    }
  });

  const { data: shipmentStats, isLoading: shipmentsLoading } = useQuery({
    queryKey: ['ops-shipment-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shipments').select('status, is_delayed');
      if (error) throw error;
      return {
        inTransit: data?.filter(s => ['in_transit', 'in_pickup', 'out_for_delivery'].includes(s.status)).length || 0,
        delayed: data?.filter(s => s.is_delayed).length || 0,
        pending: data?.filter(s => ['created', 'confirmed'].includes(s.status)).length || 0,
      };
    }
  });

  const { data: activeAlerts } = useQuery({
    queryKey: ['ops-active-alerts'],
    queryFn: async () => {
      const { count, error } = await supabase.from('trip_alerts').select('id', { count: 'exact', head: true }).eq('status', 'active');
      if (error) throw error;
      return count || 0;
    }
  });

  const { data: recentTrips } = useQuery({
    queryKey: ['ops-recent-trips'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select(`id, trip_code, status, created_at, origin_location:locations!trips_origin_location_id_fkey(location_name), destination_location:locations!trips_destination_location_id_fkey(location_name)`)
        .in('status', ['created', 'ongoing', 'on_hold'])
        .order('created_at', { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    }
  });

  if (tripsLoading || shipmentsLoading) {
    return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <DashboardHeader title="Operations Dashboard" subtitle="Monitor trips, shipments, and exceptions" />

      <QuickActionCard actions={[
        { label: "Start Trip", icon: Play, href: "/trips/add" },
        { label: "View Exceptions", icon: AlertTriangle, href: "/trip-exceptions" },
        { label: "All Trips", icon: Truck, href: "/trips" },
      ]} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatWidget title="Active Trips" value={tripStats?.ongoing || 0} icon={Truck} iconColor="text-blue-600" iconBgColor="bg-blue-100" onClick={() => navigate('/trips?status=ongoing')} />
        <StatWidget title="On Hold" value={tripStats?.on_hold || 0} icon={AlertTriangle} iconColor="text-yellow-600" iconBgColor="bg-yellow-100" onClick={() => navigate('/trips?status=on_hold')} />
        <StatWidget title="Today's Schedule" value={tripStats?.todayScheduled || 0} icon={Clock} iconColor="text-green-600" iconBgColor="bg-green-100" />
        <StatWidget title="Active Alerts" value={activeAlerts || 0} icon={AlertTriangle} iconColor="text-red-600" iconBgColor="bg-red-100" onClick={() => navigate('/alerts')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatWidget title="Shipments In Transit" value={shipmentStats?.inTransit || 0} icon={Package} iconColor="text-blue-600" iconBgColor="bg-blue-100" />
        <StatWidget title="Delayed Shipments" value={shipmentStats?.delayed || 0} icon={Clock} iconColor="text-red-600" iconBgColor="bg-red-100" />
        <StatWidget title="Pending Shipments" value={shipmentStats?.pending || 0} icon={Package} iconColor="text-orange-600" iconBgColor="bg-orange-100" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TripExceptionsWidget />
        
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" />Active & Pending Trips</CardTitle></CardHeader>
          <CardContent>
            {recentTrips && recentTrips.length > 0 ? (
              <div className="space-y-3">
                {recentTrips.map((trip) => (
                  <div key={trip.id} className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => navigate(`/trips/${trip.id}`)}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{trip.trip_code}</span>
                      <Badge variant={trip.status === 'ongoing' ? 'default' : trip.status === 'on_hold' ? 'secondary' : 'outline'}>{trip.status.replace('_', ' ')}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {trip.origin_location?.location_name || 'N/A'} → {trip.destination_location?.location_name || 'N/A'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No active trips</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
