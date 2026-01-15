import { Package, FileCheck, DollarSign, Receipt } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useNavigate } from "react-router-dom";
import { DashboardHeader } from "./DashboardHeader";
import { StatWidget } from "./StatWidget";
import { QuickActionCard } from "./QuickActionCard";

export function BillingDashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useQuery({
    queryKey: ['billing-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shipments').select('status, pod_collected, billed_at, paid_at');
      if (error) throw error;
      return {
        podPending: data?.filter(s => s.status === 'delivered' && !s.pod_collected).length || 0,
        readyForBilling: data?.filter(s => s.pod_collected && !s.billed_at).length || 0,
        billed: data?.filter(s => s.billed_at && !s.paid_at).length || 0,
        paid: data?.filter(s => s.paid_at).length || 0,
      };
    }
  });

  if (isLoading) return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <DashboardHeader title="Billing Dashboard" subtitle="POD collection and invoicing" />
      <QuickActionCard actions={[{ label: "View Shipments", icon: Package, href: "/shipments" }]} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatWidget title="POD Pending" value={stats?.podPending || 0} icon={FileCheck} iconColor="text-orange-600" iconBgColor="bg-orange-100" onClick={() => navigate('/shipments')} />
        <StatWidget title="Ready to Bill" value={stats?.readyForBilling || 0} icon={Receipt} iconColor="text-blue-600" iconBgColor="bg-blue-100" />
        <StatWidget title="Billed" value={stats?.billed || 0} icon={DollarSign} iconColor="text-purple-600" iconBgColor="bg-purple-100" />
        <StatWidget title="Paid" value={stats?.paid || 0} icon={DollarSign} iconColor="text-green-600" iconBgColor="bg-green-100" />
      </div>
    </div>
  );
}
