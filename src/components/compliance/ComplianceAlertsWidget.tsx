import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, FileWarning, Check, Truck, User, ChevronRight, RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface ComplianceAlert {
  id: string;
  entity_type: 'vehicle' | 'driver';
  entity_id: string;
  document_type: string;
  expiry_date: string;
  alert_level: 'warning' | 'critical' | 'expired';
  status: 'active' | 'acknowledged' | 'resolved';
  created_at: string;
  vehicle?: { id: string; vehicle_number: string } | null;
  driver?: { id: string; name: string } | null;
}

interface ComplianceAlertsWidgetProps {
  maxItems?: number;
  showActions?: boolean;
}

export function ComplianceAlertsWidget({ maxItems = 5, showActions = true }: ComplianceAlertsWidgetProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: alerts, isLoading, refetch } = useQuery({
    queryKey: ['compliance-alerts-widget'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compliance_alerts')
        .select('*')
        .in('status', ['active', 'acknowledged'])
        .order('alert_level', { ascending: true })
        .order('expiry_date', { ascending: true })
        .limit(maxItems);

      if (error) throw error;

      // Fetch entity names
      const alertsWithNames: ComplianceAlert[] = [];
      for (const alert of data || []) {
        let enrichedAlert = { ...alert } as ComplianceAlert;
        
        if (alert.entity_type === 'vehicle') {
          const { data: vehicle } = await supabase
            .from('vehicles')
            .select('id, vehicle_number')
            .eq('id', alert.entity_id)
            .maybeSingle();
          enrichedAlert.vehicle = vehicle;
        } else if (alert.entity_type === 'driver') {
          const { data: driver } = await supabase
            .from('drivers')
            .select('id, name')
            .eq('id', alert.entity_id)
            .maybeSingle();
          enrichedAlert.driver = driver;
        }
        
        alertsWithNames.push(enrichedAlert);
      }

      return alertsWithNames;
    }
  });

  const { data: stats } = useQuery({
    queryKey: ['compliance-alerts-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compliance_alerts')
        .select('alert_level, status')
        .in('status', ['active', 'acknowledged']);

      if (error) throw error;

      return {
        total: data?.length || 0,
        expired: data?.filter(a => a.alert_level === 'expired').length || 0,
        critical: data?.filter(a => a.alert_level === 'critical').length || 0,
        warning: data?.filter(a => a.alert_level === 'warning').length || 0
      };
    }
  });

  const runCheckMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('compliance-alerts-monitor');
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-alerts-widget'] });
      queryClient.invalidateQueries({ queryKey: ['compliance-alerts-stats'] });
      toast({ title: "Success", description: "Compliance check completed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from('compliance_alerts')
        .update({ 
          status: 'acknowledged', 
          acknowledged_at: new Date().toISOString() 
        })
        .eq('id', alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-alerts-widget'] });
      queryClient.invalidateQueries({ queryKey: ['compliance-alerts-stats'] });
    }
  });

  const getAlertLevelBadge = (level: string) => {
    switch (level) {
      case 'expired':
        return <Badge variant="destructive">Expired</Badge>;
      case 'critical':
        return <Badge className="bg-orange-500 hover:bg-orange-600">Critical</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400">Warning</Badge>;
      default:
        return <Badge variant="outline">{level}</Badge>;
    }
  };

  const getEntityIcon = (type: string) => {
    return type === 'vehicle' ? <Truck className="h-4 w-4" /> : <User className="h-4 w-4" />;
  };

  const getEntityName = (alert: ComplianceAlert) => {
    if (alert.entity_type === 'vehicle' && alert.vehicle) {
      return alert.vehicle.vehicle_number;
    } else if (alert.entity_type === 'driver' && alert.driver) {
      return alert.driver.name;
    }
    return 'Unknown';
  };

  const handleViewEntity = (alert: ComplianceAlert) => {
    if (alert.entity_type === 'vehicle') {
      navigate(`/vehicles/${alert.entity_id}`);
    } else {
      navigate(`/drivers/${alert.entity_id}`);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-orange-500" />
            Compliance Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-orange-500" />
            Compliance Alerts
          </CardTitle>
          {showActions && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => runCheckMutation.mutate()}
              disabled={runCheckMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${runCheckMutation.isPending ? 'animate-spin' : ''}`} />
              Check Now
            </Button>
          )}
        </div>
        {stats && stats.total > 0 && (
          <div className="flex gap-3 mt-2">
            {stats.expired > 0 && (
              <Badge variant="destructive">{stats.expired} Expired</Badge>
            )}
            {stats.critical > 0 && (
              <Badge className="bg-orange-500">{stats.critical} Critical</Badge>
            )}
            {stats.warning > 0 && (
              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400">
                {stats.warning} Warning
              </Badge>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {!alerts || alerts.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Check className="h-10 w-10 mx-auto mb-2 text-green-500" />
            <p>All documents are compliant</p>
          </div>
        ) : (
          <ScrollArea className="h-[280px]">
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleViewEntity(alert)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      {getEntityIcon(alert.entity_type)}
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {getEntityName(alert)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {alert.document_type} expires {format(new Date(alert.expiry_date), 'MMM d, yyyy')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {getAlertLevelBadge(alert.alert_level)}
                      {alert.status === 'active' && showActions && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            acknowledgeMutation.mutate(alert.id);
                          }}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}