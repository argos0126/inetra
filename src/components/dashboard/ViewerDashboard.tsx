import { Truck, Package, Users, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { DashboardHeader } from "./DashboardHeader";
import { StatWidget } from "./StatWidget";

export function ViewerDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['viewer-stats'],
    queryFn: async () => {
      const [trips, shipments, drivers, locations] = await Promise.all([
        supabase.from('trips').select('status'),
        supabase.from('shipments').select('id', { count: 'exact', head: true }),
        supabase.from('drivers').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('locations').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ]);
      return {
        activeTrips: trips.data?.filter(t => t.status === 'ongoing').length || 0,
        totalShipments: shipments.count || 0,
        drivers: drivers.count || 0,
        locations: locations.count || 0,
      };
    }
  });

  if (isLoading) return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <DashboardHeader title="Dashboard" subtitle="System overview (read-only)" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatWidget title="Active Trips" value={stats?.activeTrips || 0} icon={Truck} iconColor="text-blue-600" iconBgColor="bg-blue-100" />
        <StatWidget title="Total Shipments" value={stats?.totalShipments || 0} icon={Package} iconColor="text-green-600" iconBgColor="bg-green-100" />
        <StatWidget title="Drivers" value={stats?.drivers || 0} icon={Users} iconColor="text-purple-600" iconBgColor="bg-purple-100" />
        <StatWidget title="Locations" value={stats?.locations || 0} icon={MapPin} iconColor="text-orange-600" iconBgColor="bg-orange-100" />
      </div>
    </div>
  );
}
