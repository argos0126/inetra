import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertTriangle, 
  AlertCircle, 
  Wrench, 
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

interface ExceptionTrip {
  id: string;
  trip_code: string;
  status: string;
  updated_at: string;
  vehicle?: { vehicle_number: string } | null;
  driver?: { name: string } | null;
  origin_location?: { location_name: string } | null;
  destination_location?: { location_name: string } | null;
  hold_reason?: string;
}

export function TripExceptionsWidget() {
  const navigate = useNavigate();

  // Fetch trips on_hold with their latest audit log for hold reason
  const { data: exceptionTrips, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard-exception-trips'],
    queryFn: async () => {
      // Get all on_hold trips
      const { data: trips, error } = await supabase
        .from('trips')
        .select(`
          id,
          trip_code,
          status,
          updated_at,
          vehicle:vehicles(vehicle_number),
          driver:drivers(name),
          origin_location:locations!trips_origin_location_id_fkey(location_name),
          destination_location:locations!trips_destination_location_id_fkey(location_name)
        `)
        .eq('status', 'on_hold')
        .order('updated_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      if (!trips || trips.length === 0) return [];

      // Get the latest audit log for each trip to find hold reason
      const tripIds = trips.map(t => t.id);
      const { data: auditLogs } = await supabase
        .from('trip_audit_logs')
        .select('trip_id, metadata, created_at')
        .in('trip_id', tripIds)
        .eq('new_status', 'on_hold')
        .order('created_at', { ascending: false });

      // Map hold reasons to trips
      const holdReasonMap: Record<string, string> = {};
      auditLogs?.forEach(log => {
        if (!holdReasonMap[log.trip_id]) {
          const metadata = log.metadata as { hold_reason?: string } | null;
          holdReasonMap[log.trip_id] = metadata?.hold_reason || 'unknown';
        }
      });

      return trips.map(trip => ({
        ...trip,
        hold_reason: holdReasonMap[trip.id] || 'unknown'
      })) as ExceptionTrip[];
    },
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  const getExceptionIcon = (reason: string) => {
    switch (reason) {
      case 'accident':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'breakdown':
        return <Wrench className="h-4 w-4 text-orange-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getExceptionBadge = (reason: string) => {
    switch (reason) {
      case 'accident':
        return <Badge variant="destructive" className="text-xs">Accident</Badge>;
      case 'breakdown':
        return <Badge className="bg-orange-500 hover:bg-orange-600 text-xs">Breakdown</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">On Hold</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center">
            <AlertTriangle className="mr-2 h-4 w-4 text-orange-500" />
            Trip Exceptions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center">
            <AlertTriangle className="mr-2 h-4 w-4 text-orange-500" />
            Trip Exceptions
            {exceptionTrips && exceptionTrips.length > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">
                {exceptionTrips.length}
              </Badge>
            )}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!exceptionTrips || exceptionTrips.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No trips with exceptions</p>
            <p className="text-xs">All trips running smoothly</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {exceptionTrips.map((trip) => (
              <div
                key={trip.id}
                className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/trips/${trip.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getExceptionIcon(trip.hold_reason || 'unknown')}
                    <span className="font-medium text-sm">{trip.trip_code}</span>
                    {getExceptionBadge(trip.hold_reason || 'unknown')}
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
                
                <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                  <p className="truncate">
                    {trip.origin_location?.location_name || 'N/A'} → {trip.destination_location?.location_name || 'N/A'}
                  </p>
                  <div className="flex items-center justify-between">
                    <span>
                      {trip.driver?.name || 'No driver'} • {trip.vehicle?.vehicle_number || 'No vehicle'}
                    </span>
                    <span className="text-muted-foreground/70">
                      {formatDistanceToNow(new Date(trip.updated_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
