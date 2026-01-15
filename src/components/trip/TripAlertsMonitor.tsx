import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, Bell, MapPinOff, 
  PauseCircle, Clock, WifiOff, ShieldOff, 
  MapPin, Gauge, RefreshCw, ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { 
  TripAlertRecord, 
  TripAlertType, 
  AlertStatus
} from '@/utils/tripAlerts';

interface TripAlertsMonitorProps {
  tripId: string;
  tripStatus: string;
  onAlertChange?: () => void;
}

const getAlertIcon = (type: TripAlertType) => {
  const iconMap: Record<TripAlertType, React.ReactNode> = {
    route_deviation: <MapPinOff className="h-3.5 w-3.5" />,
    stoppage: <PauseCircle className="h-3.5 w-3.5" />,
    idle_time: <Clock className="h-3.5 w-3.5" />,
    tracking_lost: <WifiOff className="h-3.5 w-3.5" />,
    consent_revoked: <ShieldOff className="h-3.5 w-3.5" />,
    geofence_entry: <MapPin className="h-3.5 w-3.5" />,
    geofence_exit: <MapPinOff className="h-3.5 w-3.5" />,
    speed_exceeded: <Gauge className="h-3.5 w-3.5" />,
    delay_warning: <AlertTriangle className="h-3.5 w-3.5" />,
  };
  return iconMap[type] || <AlertTriangle className="h-3.5 w-3.5" />;
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical':
      return 'bg-red-500 text-white';
    case 'high':
      return 'bg-orange-500 text-white';
    case 'medium':
      return 'bg-yellow-500 text-white';
    case 'low':
      return 'bg-blue-500 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
};

const getStatusBadge = (status: AlertStatus) => {
  const variants: Record<AlertStatus, { variant: 'destructive' | 'secondary' | 'default' | 'outline'; label: string }> = {
    active: { variant: 'destructive', label: 'Active' },
    acknowledged: { variant: 'secondary', label: 'Ack' },
    resolved: { variant: 'default', label: 'Done' },
    dismissed: { variant: 'outline', label: 'Dismissed' },
  };
  const config = variants[status];
  return <Badge variant={config.variant} className="text-[10px] px-1 py-0">{config.label}</Badge>;
};

export default function TripAlertsMonitor({ 
  tripId, 
  tripStatus
}: TripAlertsMonitorProps) {
  const navigate = useNavigate();
  const { data: alerts = [], isLoading, refetch } = useQuery({
    queryKey: ['trip-alerts', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trip_alerts')
        .select('*')
        .eq('trip_id', tripId)
        .order('triggered_at', { ascending: false });
      
      if (error) throw error;
      return data as TripAlertRecord[];
    },
    refetchInterval: tripStatus === 'ongoing' ? 30000 : false,
  });

  const activeAlerts = alerts.filter(a => a.status === 'active' || a.status === 'acknowledged');
  const resolvedAlerts = alerts.filter(a => a.status === 'resolved' || a.status === 'dismissed');

  const renderCompactAlert = (alert: TripAlertRecord) => {
    const isActive = alert.status === 'active' || alert.status === 'acknowledged';
    
    return (
      <div 
        key={alert.id}
        className={`flex items-center gap-2 p-2 rounded-md text-xs ${
          isActive 
            ? 'bg-destructive/10 border border-destructive/20' 
            : 'bg-muted/50'
        }`}
      >
        <div className={isActive ? 'text-destructive' : 'text-muted-foreground'}>
          {getAlertIcon(alert.alert_type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`font-medium truncate ${isActive ? '' : 'text-muted-foreground'}`}>
              {alert.title}
            </span>
            <Badge className={`${getSeverityColor(alert.severity)} text-[10px] px-1 py-0`}>
              {alert.severity}
            </Badge>
          </div>
          <p className="text-muted-foreground truncate">
            {formatDistanceToNow(new Date(alert.triggered_at), { addSuffix: true })}
          </p>
        </div>
        {getStatusBadge(alert.status)}
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card className="p-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Bell className="h-4 w-4" />
          <span>Loading alerts...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card 
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => navigate('/alerts')}
    >
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alerts
            {activeAlerts.length > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {activeAlerts.length}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                refetch();
              }}
              disabled={isLoading}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0 space-y-2">
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Bell className="h-4 w-4 opacity-30" />
            <span>No alerts</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {activeAlerts.slice(0, 3).map(renderCompactAlert)}
            {activeAlerts.length > 3 && (
              <p className="text-xs text-primary text-center py-1 hover:underline">
                +{activeAlerts.length - 3} more active
              </p>
            )}
            {resolvedAlerts.length > 0 && (
              <p className="text-xs text-muted-foreground pt-1 border-t">
                {resolvedAlerts.length} resolved
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}