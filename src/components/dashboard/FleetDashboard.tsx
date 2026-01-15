import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, Radio, AlertTriangle, Calendar, Plus, FileWarning } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useNavigate } from "react-router-dom";
import { format, addDays, isBefore } from "date-fns";
import { DashboardHeader } from "./DashboardHeader";
import { StatWidget } from "./StatWidget";
import { QuickActionCard } from "./QuickActionCard";
import { ComplianceAlertsWidget } from "@/components/compliance/ComplianceAlertsWidget";

export function FleetDashboard() {
  const navigate = useNavigate();

  const { data: vehicleStats, isLoading: vehiclesLoading } = useQuery({
    queryKey: ['fleet-vehicle-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicles').select('id, is_active, rc_expiry_date, insurance_expiry_date, fitness_expiry_date, puc_expiry_date, permit_expiry_date');
      if (error) throw error;
      const thirtyDaysFromNow = addDays(new Date(), 30);
      const checkExpiring = (dateStr: string | null) => dateStr && isBefore(new Date(dateStr), thirtyDaysFromNow);
      return {
        total: data?.length || 0,
        active: data?.filter(v => v.is_active).length || 0,
        inactive: data?.filter(v => !v.is_active).length || 0,
        expiringDocs: data?.filter(v => 
          checkExpiring(v.rc_expiry_date) || checkExpiring(v.insurance_expiry_date) || 
          checkExpiring(v.fitness_expiry_date) || checkExpiring(v.puc_expiry_date) || checkExpiring(v.permit_expiry_date)
        ).length || 0,
      };
    }
  });

  const { data: trackingStats, isLoading: trackingLoading } = useQuery({
    queryKey: ['fleet-tracking-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tracking_assets').select('id, is_active, asset_type');
      if (error) throw error;
      return {
        total: data?.length || 0,
        active: data?.filter(t => t.is_active).length || 0,
        gps: data?.filter(t => t.asset_type === 'gps').length || 0,
        sim: data?.filter(t => t.asset_type === 'sim').length || 0,
      };
    }
  });

  const { data: onTripVehicles } = useQuery({
    queryKey: ['fleet-on-trip'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select('vehicle_id')
        .in('status', ['ongoing', 'created']);
      if (error) throw error;
      return new Set(data?.map(t => t.vehicle_id).filter(Boolean)).size;
    }
  });

  const { data: expiringVehicles } = useQuery({
    queryKey: ['fleet-expiring-vehicles'],
    queryFn: async () => {
      const thirtyDaysFromNow = addDays(new Date(), 30);
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, vehicle_number, rc_expiry_date, insurance_expiry_date, fitness_expiry_date, puc_expiry_date')
        .eq('is_active', true)
        .limit(10);
      if (error) throw error;
      
      const checkExpiring = (dateStr: string | null) => dateStr && isBefore(new Date(dateStr), thirtyDaysFromNow);
      return data?.filter(v => 
        checkExpiring(v.rc_expiry_date) || checkExpiring(v.insurance_expiry_date) || 
        checkExpiring(v.fitness_expiry_date) || checkExpiring(v.puc_expiry_date)
      ).map(v => {
        const expiringDocs = [];
        if (checkExpiring(v.rc_expiry_date)) expiringDocs.push({ type: 'RC', date: v.rc_expiry_date });
        if (checkExpiring(v.insurance_expiry_date)) expiringDocs.push({ type: 'Insurance', date: v.insurance_expiry_date });
        if (checkExpiring(v.fitness_expiry_date)) expiringDocs.push({ type: 'Fitness', date: v.fitness_expiry_date });
        if (checkExpiring(v.puc_expiry_date)) expiringDocs.push({ type: 'PUC', date: v.puc_expiry_date });
        return { ...v, expiringDocs };
      }) || [];
    }
  });

  if (vehiclesLoading || trackingLoading) {
    return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <DashboardHeader title="Fleet Dashboard" subtitle="Vehicle and tracking asset management" />

      <QuickActionCard actions={[
        { label: "Add Vehicle", icon: Plus, href: "/vehicles/add" },
        { label: "Add Tracking Asset", icon: Radio, href: "/tracking-assets/add" },
        { label: "All Vehicles", icon: Truck, href: "/vehicles" },
      ]} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatWidget title="Total Vehicles" value={vehicleStats?.total || 0} icon={Truck} iconColor="text-blue-600" iconBgColor="bg-blue-100" onClick={() => navigate('/vehicles')} />
        <StatWidget title="Active Vehicles" value={vehicleStats?.active || 0} icon={Truck} iconColor="text-green-600" iconBgColor="bg-green-100" />
        <StatWidget title="On Trip" value={onTripVehicles || 0} icon={Truck} iconColor="text-purple-600" iconBgColor="bg-purple-100" />
        <StatWidget title="Expiring Docs" value={vehicleStats?.expiringDocs || 0} icon={FileWarning} iconColor="text-orange-600" iconBgColor="bg-orange-100" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatWidget title="Tracking Assets" value={trackingStats?.total || 0} icon={Radio} iconColor="text-indigo-600" iconBgColor="bg-indigo-100" onClick={() => navigate('/tracking-assets')} />
        <StatWidget title="Active Assets" value={trackingStats?.active || 0} icon={Radio} iconColor="text-green-600" iconBgColor="bg-green-100" />
        <StatWidget title="GPS Devices" value={trackingStats?.gps || 0} icon={Radio} iconColor="text-blue-600" iconBgColor="bg-blue-100" />
        <StatWidget title="SIM Tracking" value={trackingStats?.sim || 0} icon={Radio} iconColor="text-purple-600" iconBgColor="bg-purple-100" />
      </div>

      <ComplianceAlertsWidget maxItems={10} showActions={true} />
    </div>
  );
}
