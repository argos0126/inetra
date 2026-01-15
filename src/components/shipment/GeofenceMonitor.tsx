import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { 
  triggerGeofenceCheck, 
  GeofenceEvent, 
  getGeofenceEventDescription, 
  getGeofenceEventColor 
} from "@/utils/geofenceUtils";
import { MapPin, RefreshCw, Loader2, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";

interface GeofenceMonitorProps {
  autoRefresh?: boolean;
  refreshInterval?: number; // in seconds
  onEvent?: (events: GeofenceEvent[]) => void;
}

export function GeofenceMonitor({ 
  autoRefresh = false, 
  refreshInterval = 60,
  onEvent 
}: GeofenceMonitorProps) {
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [lastEvents, setLastEvents] = useState<GeofenceEvent[]>([]);
  const [tripsChecked, setTripsChecked] = useState(0);

  const runGeofenceCheck = useCallback(async () => {
    setChecking(true);
    try {
      const result = await triggerGeofenceCheck();
      
      setLastCheck(result.checkedAt);
      setTripsChecked(result.tripsChecked);
      setLastEvents(result.geofenceEvents);

      if (result.geofenceEvents.length > 0) {
        toast({
          title: "Geofence Events Detected",
          description: `${result.geofenceEvents.length} shipment status(es) updated automatically`,
        });
        onEvent?.(result.geofenceEvents);
      }

      if (!result.success) {
        toast({
          title: "Geofence Check Warning",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Geofence Check Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  }, [onEvent]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(runGeofenceCheck, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, runGeofenceCheck]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Geofence Monitor
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={runGeofenceCheck}
            disabled={checking}
            className="gap-2"
          >
            {checking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Check Now
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Info */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {lastCheck && (
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Last check: {format(new Date(lastCheck), 'h:mm:ss a')}
            </div>
          )}
          {tripsChecked > 0 && (
            <div className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              {tripsChecked} trips checked
            </div>
          )}
        </div>

        {/* Auto-refresh indicator */}
        {autoRefresh && (
          <Badge variant="outline" className="gap-1">
            <RefreshCw className="w-3 h-3" />
            Auto-refresh every {refreshInterval}s
          </Badge>
        )}

        {/* Recent Events */}
        {lastEvents.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Recent Geofence Events</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {lastEvents.map((event, index) => (
                <div
                  key={`${event.shipmentId}-${index}`}
                  className="flex items-center justify-between p-2 bg-muted rounded-lg"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{event.shipmentCode}</span>
                    <span className="text-xs text-muted-foreground">
                      {event.locationName} • {event.distance}m away
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getGeofenceEventColor(event.eventType)}>
                      {getGeofenceEventDescription(event.eventType)}
                    </Badge>
                    {event.newStatus && (
                      <Badge variant="outline">{event.newStatus}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          lastCheck && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No geofence events detected in last check
            </p>
          )
        )}
      </CardContent>
    </Card>
  );
}
