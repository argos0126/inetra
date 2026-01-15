import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, MapPin, Clock, Radio, Eye, CheckCircle, XCircle, Truck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { DashboardHeader } from "./DashboardHeader";
import { StatWidget } from "./StatWidget";
import { QuickActionCard } from "./QuickActionCard";

export function ControlTowerDashboard() {
  const navigate = useNavigate();

  const { data: alertStats, isLoading: alertsLoading } = useQuery({
    queryKey: ['ct-alert-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('trip_alerts').select('status, severity, alert_type');
      if (error) throw error;
      return {
        active: data?.filter(a => a.status === 'active').length || 0,
        critical: data?.filter(a => a.status === 'active' && a.severity === 'high').length || 0,
        acknowledged: data?.filter(a => a.status === 'acknowledged').length || 0,
        byType: data?.reduce((acc, a) => { acc[a.alert_type] = (acc[a.alert_type] || 0) + 1; return acc; }, {} as Record<string, number>),
      };
    },
    refetchInterval: 30000
  });

  const { data: tripStats, isLoading: tripsLoading } = useQuery({
    queryKey: ['ct-trip-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('trips').select('status, is_trackable, last_ping_at, active_alert_count');
      if (error) throw error;
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      return {
        ongoing: data?.filter(t => t.status === 'ongoing').length || 0,
        trackable: data?.filter(t => t.status === 'ongoing' && t.is_trackable).length || 0,
        recentPing: data?.filter(t => t.status === 'ongoing' && t.last_ping_at && new Date(t.last_ping_at) > fiveMinAgo).length || 0,
        withAlerts: data?.filter(t => (t.active_alert_count || 0) > 0).length || 0,
      };
    },
    refetchInterval: 30000
  });

  const { data: exceptionStats } = useQuery({
    queryKey: ['ct-exception-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shipment_exceptions').select('status');
      if (error) throw error;
      return {
        open: data?.filter(e => e.status === 'open').length || 0,
        escalated: data?.filter(e => e.status === 'escalated').length || 0,
      };
    },
    refetchInterval: 30000
  });

  const { data: recentAlerts } = useQuery({
    queryKey: ['ct-recent-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trip_alerts')
        .select(`id, title, alert_type, severity, status, triggered_at, trip:trips(trip_code)`)
        .eq('status', 'active')
        .order('triggered_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000
  });

  if (alertsLoading || tripsLoading) {
    return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>;
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <DashboardHeader title="Control Tower" subtitle="Real-time monitoring and alert management" />

      <QuickActionCard actions={[
        { label: "View All Alerts", icon: AlertTriangle, href: "/alerts" },
        { label: "Fleet Map", icon: MapPin, href: "/trips" },
        { label: "Exceptions", icon: XCircle, href: "/trip-exceptions" },
      ]} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatWidget title="Active Alerts" value={alertStats?.active || 0} icon={AlertTriangle} iconColor="text-red-600" iconBgColor="bg-red-100" onClick={() => navigate('/alerts')} />
        <StatWidget title="Critical Alerts" value={alertStats?.critical || 0} icon={AlertTriangle} iconColor="text-red-800" iconBgColor="bg-red-200" />
        <StatWidget title="Open Exceptions" value={exceptionStats?.open || 0} icon={XCircle} iconColor="text-orange-600" iconBgColor="bg-orange-100" onClick={() => navigate('/trip-exceptions')} />
        <StatWidget title="Escalated" value={exceptionStats?.escalated || 0} icon={AlertTriangle} iconColor="text-purple-600" iconBgColor="bg-purple-100" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatWidget title="Live Trips" value={tripStats?.ongoing || 0} icon={Truck} iconColor="text-blue-600" iconBgColor="bg-blue-100" />
        <StatWidget title="Trackable" value={tripStats?.trackable || 0} icon={Radio} iconColor="text-green-600" iconBgColor="bg-green-100" />
        <StatWidget title="Recent Ping (<5m)" value={tripStats?.recentPing || 0} icon={Clock} iconColor="text-green-600" iconBgColor="bg-green-100" />
        <StatWidget title="Trips with Alerts" value={tripStats?.withAlerts || 0} icon={AlertTriangle} iconColor="text-yellow-600" iconBgColor="bg-yellow-100" />
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" />Active Alerts</CardTitle></CardHeader>
        <CardContent>
          {recentAlerts && recentAlerts.length > 0 ? (
            <div className="space-y-3">
              {recentAlerts.map((alert) => (
                <div key={alert.id} className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => navigate(`/trips/${alert.trip?.trip_code}`)}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{alert.title}</span>
                    <Badge className={getSeverityColor(alert.severity)}>{alert.severity}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{alert.trip?.trip_code || 'Unknown Trip'}</span>
                    <span>{formatDistanceToNow(new Date(alert.triggered_at), { addSuffix: true })}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground"><CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" /><p>No active alerts</p></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
