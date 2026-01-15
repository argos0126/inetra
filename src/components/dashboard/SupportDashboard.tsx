import { Package, AlertTriangle, MessageSquare, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useNavigate } from "react-router-dom";
import { DashboardHeader } from "./DashboardHeader";
import { StatWidget } from "./StatWidget";
import { QuickActionCard } from "./QuickActionCard";

export function SupportDashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useQuery({
    queryKey: ['support-stats'],
    queryFn: async () => {
      const [exceptions, shipments] = await Promise.all([
        supabase.from('shipment_exceptions').select('status'),
        supabase.from('shipments').select('status, has_open_exception'),
      ]);
      return {
        openExceptions: exceptions.data?.filter(e => e.status === 'open').length || 0,
        shipmentsWithIssues: shipments.data?.filter(s => s.has_open_exception).length || 0,
        inTransit: shipments.data?.filter(s => s.status === 'in_transit').length || 0,
      };
    }
  });

  if (isLoading) return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <DashboardHeader title="Support Dashboard" subtitle="Handle exceptions and customer queries" />
      <QuickActionCard actions={[
        { label: "View Exceptions", icon: AlertTriangle, href: "/trip-exceptions" },
        { label: "All Shipments", icon: Package, href: "/shipments" },
      ]} />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatWidget title="Open Exceptions" value={stats?.openExceptions || 0} icon={AlertTriangle} iconColor="text-red-600" iconBgColor="bg-red-100" onClick={() => navigate('/trip-exceptions')} />
        <StatWidget title="Shipments with Issues" value={stats?.shipmentsWithIssues || 0} icon={Package} iconColor="text-orange-600" iconBgColor="bg-orange-100" />
        <StatWidget title="In Transit" value={stats?.inTransit || 0} icon={Package} iconColor="text-blue-600" iconBgColor="bg-blue-100" />
      </div>
    </div>
  );
}
