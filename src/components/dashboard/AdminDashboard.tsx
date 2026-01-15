import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Truck, Users, MapPin, TrendingUp, Package, Building2, Route, 
  UserPlus, ShieldCheck, Activity
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell } from "recharts";
import { ChartContainer, ChartConfig, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { toast } from "sonner";
import { TripExceptionsWidget } from "./TripExceptionsWidget";
import { DashboardHeader } from "./DashboardHeader";
import { StatWidget } from "./StatWidget";
import { QuickActionCard } from "./QuickActionCard";

export function AdminDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('admin-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-trip-stats'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-recent-trips'] });
        if (payload.eventType === 'UPDATE') {
          toast.info('Trip status updated', {
            description: `A trip was updated to ${payload.new?.status?.replace('_', ' ')}`
          });
        } else if (payload.eventType === 'INSERT') {
          toast.success('New trip created');
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-shipment-stats'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const { data: tripStats, isLoading: tripsLoading } = useQuery({
    queryKey: ['dashboard-trip-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('trips').select('status');
      if (error) throw error;
      const counts = { created: 0, ongoing: 0, completed: 0, cancelled: 0, on_hold: 0, closed: 0, total: data?.length || 0 };
      data?.forEach(trip => { counts[trip.status as keyof typeof counts]++; });
      return counts;
    }
  });

  const { data: recentTrips, isLoading: recentLoading } = useQuery({
    queryKey: ['dashboard-recent-trips'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select(`id, trip_code, status, created_at, origin_location:locations!trips_origin_location_id_fkey(location_name), destination_location:locations!trips_destination_location_id_fkey(location_name), driver:drivers(name), vehicle:vehicles(vehicle_number)`)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    }
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      const [drivers, vehicles, customers, locations, users] = await Promise.all([
        supabase.from('drivers').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('locations').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ]);
      return { drivers: drivers.count || 0, vehicles: vehicles.count || 0, customers: customers.count || 0, locations: locations.count || 0, users: users.count || 0 };
    }
  });

  const { data: shipmentStats } = useQuery({
    queryKey: ['dashboard-shipment-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shipments').select('status');
      if (error) throw error;
      const inTransit = data?.filter(s => ['in_transit', 'in_pickup', 'out_for_delivery'].includes(s.status)).length || 0;
      const delivered = data?.filter(s => s.status === 'delivered').length || 0;
      return { inTransit, delivered, total: data?.length || 0 };
    }
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "ongoing": return "secondary";
      case "created": return "outline";
      case "on_hold": return "secondary";
      case "cancelled": return "destructive";
      default: return "outline";
    }
  };

  const tripStatusData = [
    { name: 'Created', value: tripStats?.created || 0, fill: 'hsl(var(--chart-1))' },
    { name: 'Ongoing', value: tripStats?.ongoing || 0, fill: 'hsl(var(--chart-2))' },
    { name: 'Completed', value: tripStats?.completed || 0, fill: 'hsl(var(--chart-3))' },
    { name: 'On Hold', value: tripStats?.on_hold || 0, fill: 'hsl(var(--chart-4))' },
    { name: 'Cancelled', value: tripStats?.cancelled || 0, fill: 'hsl(var(--chart-5))' },
  ].filter(item => item.value > 0);

  const chartConfig = {
    created: { label: "Created", color: "hsl(var(--chart-1))" },
    ongoing: { label: "Ongoing", color: "hsl(var(--chart-2))" },
    completed: { label: "Completed", color: "hsl(var(--chart-3))" },
    on_hold: { label: "On Hold", color: "hsl(var(--chart-4))" },
    cancelled: { label: "Cancelled", color: "hsl(var(--chart-5))" },
  } satisfies ChartConfig;

  if (tripsLoading || recentLoading || metricsLoading) {
    return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <DashboardHeader title="Admin Dashboard" subtitle="Complete system overview and management" />

      <QuickActionCard actions={[
        { label: "Create User", icon: UserPlus, href: "/users" },
        { label: "Manage Roles", icon: ShieldCheck, href: "/roles" },
        { label: "View Alerts", icon: Activity, href: "/alerts" },
      ]} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        <StatWidget title="Active Trips" value={tripStats?.ongoing || 0} icon={Truck} iconColor="text-blue-600" iconBgColor="bg-blue-100" onClick={() => navigate('/trips')} />
        <StatWidget title="Total Drivers" value={metrics?.drivers || 0} icon={Users} iconColor="text-green-600" iconBgColor="bg-green-100" onClick={() => navigate('/drivers')} />
        <StatWidget title="Vehicles" value={metrics?.vehicles || 0} icon={Truck} iconColor="text-orange-600" iconBgColor="bg-orange-100" onClick={() => navigate('/vehicles')} />
        <StatWidget title="Locations" value={metrics?.locations || 0} icon={MapPin} iconColor="text-purple-600" iconBgColor="bg-purple-100" onClick={() => navigate('/locations')} />
        <StatWidget title="Users" value={metrics?.users || 0} icon={Users} iconColor="text-indigo-600" iconBgColor="bg-indigo-100" onClick={() => navigate('/users')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatWidget title="Total Trips" value={tripStats?.total || 0} icon={Route} />
        <StatWidget title="Customers" value={metrics?.customers || 0} icon={Building2} />
        <StatWidget title="Shipments In Transit" value={shipmentStats?.inTransit || 0} icon={Package} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TripExceptionsWidget />
        <Card>
          <CardHeader><CardTitle className="flex items-center space-x-2"><TrendingUp className="h-5 w-5" /><span>Trip Status</span></CardTitle></CardHeader>
          <CardContent>
            {tripStatusData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[250px]">
                <PieChart>
                  <Pie data={tripStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {tripStatusData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">No trip data available</div>
            )}
            <div className="mt-4 space-y-2">
              {tripStatusData.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
                    <span>{item.name}</span>
                  </div>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center space-x-2"><Truck className="h-5 w-5" /><span>Recent Trips</span></CardTitle></CardHeader>
        <CardContent>
          {recentTrips && recentTrips.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentTrips.map((trip) => (
                <div key={trip.id} className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => navigate(`/trips/${trip.id}`)}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{trip.trip_code}</span>
                    <Badge variant={getStatusBadgeVariant(trip.status)}>{trip.status.replace('_', ' ')}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{trip.origin_location?.location_name || 'N/A'} → {trip.destination_location?.location_name || 'N/A'}</p>
                  <p className="text-xs text-muted-foreground mt-1">{trip.driver?.name || 'No driver'}{trip.vehicle?.vehicle_number ? ` • ${trip.vehicle.vehicle_number}` : ''}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">{format(new Date(trip.created_at), 'MMM d, yyyy')}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground"><Truck className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No trips found</p></div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Trip Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-orange-50 rounded-lg"><p className="text-2xl font-bold text-orange-600">{tripStats?.created || 0}</p><p className="text-sm text-muted-foreground">Created</p></div>
            <div className="text-center p-4 bg-blue-50 rounded-lg"><p className="text-2xl font-bold text-blue-600">{tripStats?.ongoing || 0}</p><p className="text-sm text-muted-foreground">Ongoing</p></div>
            <div className="text-center p-4 bg-green-50 rounded-lg"><p className="text-2xl font-bold text-green-600">{tripStats?.completed || 0}</p><p className="text-sm text-muted-foreground">Completed</p></div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg"><p className="text-2xl font-bold text-yellow-600">{tripStats?.on_hold || 0}</p><p className="text-sm text-muted-foreground">On Hold</p></div>
            <div className="text-center p-4 bg-red-50 rounded-lg"><p className="text-2xl font-bold text-red-600">{tripStats?.cancelled || 0}</p><p className="text-sm text-muted-foreground">Cancelled</p></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
