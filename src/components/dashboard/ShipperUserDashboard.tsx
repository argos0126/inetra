import { Package, MapPin, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useNavigate } from "react-router-dom";
import { DashboardHeader } from "./DashboardHeader";
import { StatWidget } from "./StatWidget";
import { QuickActionCard } from "./QuickActionCard";

export function ShipperUserDashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useQuery({
    queryKey: ['shipper-user-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shipments').select('status');
      if (error) throw error;
      return {
        active: data?.filter(s => !['delivered', 'returned'].includes(s.status)).length || 0,
        delivered: data?.filter(s => s.status === 'delivered').length || 0,
      };
    }
  });

  if (isLoading) return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <DashboardHeader title="My Shipments" subtitle="Track your orders" />
      <QuickActionCard actions={[{ label: "Create Shipment", icon: Plus, href: "/shipments/add" }]} />
      <div className="grid grid-cols-2 gap-4">
        <StatWidget title="Active Shipments" value={stats?.active || 0} icon={Package} iconColor="text-blue-600" iconBgColor="bg-blue-100" onClick={() => navigate('/shipments')} />
        <StatWidget title="Delivered" value={stats?.delivered || 0} icon={MapPin} iconColor="text-green-600" iconBgColor="bg-green-100" />
      </div>
    </div>
  );
}
