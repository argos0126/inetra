import { MapPin, Route, Plus, Map } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useNavigate } from "react-router-dom";
import { DashboardHeader } from "./DashboardHeader";
import { StatWidget } from "./StatWidget";
import { QuickActionCard } from "./QuickActionCard";

export function RoutePlannerDashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useQuery({
    queryKey: ['route-planner-stats'],
    queryFn: async () => {
      const [lanes, locations] = await Promise.all([
        supabase.from('serviceability_lanes').select('id, is_active'),
        supabase.from('locations').select('id, is_active'),
      ]);
      return {
        totalLanes: lanes.data?.length || 0,
        activeLanes: lanes.data?.filter(l => l.is_active).length || 0,
        totalLocations: locations.data?.length || 0,
        activeLocations: locations.data?.filter(l => l.is_active).length || 0,
      };
    }
  });

  if (isLoading) return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <DashboardHeader title="Route Planner" subtitle="Manage lanes and locations" />
      <QuickActionCard actions={[
        { label: "Add Lane", icon: Plus, href: "/serviceability-lanes/add" },
        { label: "Add Location", icon: MapPin, href: "/locations/add" },
      ]} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatWidget title="Total Lanes" value={stats?.totalLanes || 0} icon={Route} iconColor="text-blue-600" iconBgColor="bg-blue-100" onClick={() => navigate('/serviceability-lanes')} />
        <StatWidget title="Active Lanes" value={stats?.activeLanes || 0} icon={Route} iconColor="text-green-600" iconBgColor="bg-green-100" />
        <StatWidget title="Total Locations" value={stats?.totalLocations || 0} icon={MapPin} iconColor="text-purple-600" iconBgColor="bg-purple-100" onClick={() => navigate('/locations')} />
        <StatWidget title="Active Locations" value={stats?.activeLocations || 0} icon={MapPin} iconColor="text-green-600" iconBgColor="bg-green-100" />
      </div>
    </div>
  );
}
