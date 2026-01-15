import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Shield, Clock, Plus, FileCheck, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useNavigate } from "react-router-dom";
import { format, addDays, isBefore } from "date-fns";
import { DashboardHeader } from "./DashboardHeader";
import { StatWidget } from "./StatWidget";
import { QuickActionCard } from "./QuickActionCard";

export function DriverCoordinatorDashboard() {
  const navigate = useNavigate();

  const { data: driverStats, isLoading: driversLoading } = useQuery({
    queryKey: ['dc-driver-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('drivers').select('id, is_active, consent_status, license_expiry_date');
      if (error) throw error;
      const thirtyDaysFromNow = addDays(new Date(), 30);
      return {
        total: data?.length || 0,
        active: data?.filter(d => d.is_active).length || 0,
        inactive: data?.filter(d => !d.is_active).length || 0,
        expiringLicense: data?.filter(d => d.license_expiry_date && isBefore(new Date(d.license_expiry_date), thirtyDaysFromNow)).length || 0,
      };
    }
  });

  const { data: consentStats, isLoading: consentsLoading } = useQuery({
    queryKey: ['dc-consent-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('driver_consents').select('consent_status');
      if (error) throw error;
      return {
        pending: data?.filter(c => c.consent_status === 'pending').length || 0,
        allowed: data?.filter(c => c.consent_status === 'allowed').length || 0,
        notAllowed: data?.filter(c => c.consent_status === 'not_allowed').length || 0,
        expired: data?.filter(c => c.consent_status === 'expired').length || 0,
      };
    }
  });

  const { data: onTripDrivers } = useQuery({
    queryKey: ['dc-on-trip'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select('driver_id')
        .in('status', ['ongoing', 'created']);
      if (error) throw error;
      return new Set(data?.map(t => t.driver_id).filter(Boolean)).size;
    }
  });

  const { data: expiringDrivers } = useQuery({
    queryKey: ['dc-expiring-drivers'],
    queryFn: async () => {
      const thirtyDaysFromNow = addDays(new Date(), 30);
      const { data, error } = await supabase
        .from('drivers')
        .select('id, name, mobile, license_expiry_date')
        .eq('is_active', true)
        .not('license_expiry_date', 'is', null)
        .order('license_expiry_date', { ascending: true })
        .limit(10);
      if (error) throw error;
      return data?.filter(d => d.license_expiry_date && isBefore(new Date(d.license_expiry_date), thirtyDaysFromNow)) || [];
    }
  });

  const { data: pendingConsents } = useQuery({
    queryKey: ['dc-pending-consents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_consents')
        .select(`id, msisdn, consent_requested_at, driver:drivers(name)`)
        .eq('consent_status', 'pending')
        .order('consent_requested_at', { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    }
  });

  if (driversLoading || consentsLoading) {
    return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <DashboardHeader title="Driver Coordinator" subtitle="Manage drivers, consents, and compliance" />

      <QuickActionCard actions={[
        { label: "Add Driver", icon: Plus, href: "/drivers/add" },
        { label: "Request Consent", icon: Shield, href: "/driver-consents" },
        { label: "All Drivers", icon: Users, href: "/drivers" },
      ]} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatWidget title="Total Drivers" value={driverStats?.total || 0} icon={Users} iconColor="text-blue-600" iconBgColor="bg-blue-100" onClick={() => navigate('/drivers')} />
        <StatWidget title="Active Drivers" value={driverStats?.active || 0} icon={Users} iconColor="text-green-600" iconBgColor="bg-green-100" />
        <StatWidget title="On Trip" value={onTripDrivers || 0} icon={Users} iconColor="text-purple-600" iconBgColor="bg-purple-100" />
        <StatWidget title="Expiring License" value={driverStats?.expiringLicense || 0} icon={FileCheck} iconColor="text-orange-600" iconBgColor="bg-orange-100" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatWidget title="Pending Consents" value={consentStats?.pending || 0} icon={Clock} iconColor="text-yellow-600" iconBgColor="bg-yellow-100" onClick={() => navigate('/driver-consents')} />
        <StatWidget title="Active Consents" value={consentStats?.allowed || 0} icon={Shield} iconColor="text-green-600" iconBgColor="bg-green-100" />
        <StatWidget title="Denied Consents" value={consentStats?.notAllowed || 0} icon={Shield} iconColor="text-red-600" iconBgColor="bg-red-100" />
        <StatWidget title="Expired Consents" value={consentStats?.expired || 0} icon={Clock} iconColor="text-gray-600" iconBgColor="bg-gray-100" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-orange-500" />Licenses Expiring Soon</CardTitle></CardHeader>
          <CardContent>
            {expiringDrivers && expiringDrivers.length > 0 ? (
              <div className="space-y-3">
                {expiringDrivers.map((driver) => (
                  <div key={driver.id} className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => navigate(`/drivers/${driver.id}`)}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{driver.name}</span>
                        <p className="text-xs text-muted-foreground">{driver.mobile}</p>
                      </div>
                      <Badge variant="outline" className="text-orange-600 border-orange-300">
                        Expires: {format(new Date(driver.license_expiry_date!), 'MMM d')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground"><Users className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>All licenses up to date</p></div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Pending Consent Requests</CardTitle></CardHeader>
          <CardContent>
            {pendingConsents && pendingConsents.length > 0 ? (
              <div className="space-y-3">
                {pendingConsents.map((consent) => (
                  <div key={consent.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{consent.driver?.name || 'Unknown'}</span>
                        <p className="text-xs text-muted-foreground">{consent.msisdn}</p>
                      </div>
                      <Badge variant="outline" className="text-yellow-600 border-yellow-300">Pending</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground"><Shield className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No pending consents</p></div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
