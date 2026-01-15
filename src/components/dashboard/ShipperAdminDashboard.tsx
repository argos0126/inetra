import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Truck, MapPin, Plus, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useNavigate } from "react-router-dom";
import { DashboardHeader } from "./DashboardHeader";
import { StatWidget } from "./StatWidget";
import { QuickActionCard } from "./QuickActionCard";

export function ShipperAdminDashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useQuery({
    queryKey: ['shipper-admin-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shipments').select('status, is_delayed');
      if (error) throw error;
      return {
        total: data?.length || 0,
        inTransit: data?.filter(s => ['in_transit', 'in_pickup', 'out_for_delivery'].includes(s.status)).length || 0,
        delivered: data?.filter(s => s.status === 'delivered').length || 0,
        delayed: data?.filter(s => s.is_delayed).length || 0,
      };
    }
  });

  if (isLoading) return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <DashboardHeader title="Shipper Dashboard" subtitle="Manage your shipments and track deliveries" />
      <QuickActionCard actions={[
        { label: "Create Shipment", icon: Plus, href: "/shipments/add" },
        { label: "Track Orders", icon: MapPin, href: "/shipments" },
      ]} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatWidget title="Total Shipments" value={stats?.total || 0} icon={Package} iconColor="text-blue-600" iconBgColor="bg-blue-100" onClick={() => navigate('/shipments')} />
        <StatWidget title="In Transit" value={stats?.inTransit || 0} icon={Truck} iconColor="text-purple-600" iconBgColor="bg-purple-100" />
        <StatWidget title="Delivered" value={stats?.delivered || 0} icon={Package} iconColor="text-green-600" iconBgColor="bg-green-100" />
        <StatWidget title="Delayed" value={stats?.delayed || 0} icon={TrendingUp} iconColor="text-red-600" iconBgColor="bg-red-100" />
      </div>
    </div>
  );
}
