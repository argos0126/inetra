import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, Truck, ArrowRight, Clock, History } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface AssignmentChange {
  id: string;
  created_at: string;
  change_reason: string;
  metadata: {
    driver_change?: {
      previous_driver_id: string | null;
      previous_driver_name: string | null;
      new_driver_id: string | null;
      new_driver_name: string | null;
    };
    vehicle_change?: {
      previous_vehicle_id: string | null;
      previous_vehicle_number: string | null;
      new_vehicle_id: string | null;
      new_vehicle_number: string | null;
    };
  } | null;
}

interface TripAssignmentHistoryProps {
  tripId: string;
}

export function TripAssignmentHistory({ tripId }: TripAssignmentHistoryProps) {
  const { data: changes, isLoading } = useQuery({
    queryKey: ['trip-assignment-history', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trip_audit_logs')
        .select('id, created_at, change_reason, metadata')
        .eq('trip_id', tripId)
        .or('change_reason.ilike.%driver%,change_reason.ilike.%vehicle%')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Filter to only include assignment changes and cast metadata properly
      return (data || []).filter(log => {
        const meta = log.metadata as Record<string, any> | null;
        return meta?.driver_change || meta?.vehicle_change;
      }).map(log => ({
        ...log,
        metadata: log.metadata as AssignmentChange['metadata']
      })) as AssignmentChange[];
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Assignment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!changes || changes.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Assignment History
          <Badge variant="secondary">{changes.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px]">
          <div className="space-y-4">
            {changes.map((change) => (
              <div key={change.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{change.change_reason}</span>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(change.created_at), 'MMM d, HH:mm')}
                  </div>
                </div>
                
                {change.metadata?.driver_change && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Driver:</span>
                    <span className={change.metadata.driver_change.previous_driver_name ? '' : 'text-muted-foreground'}>
                      {change.metadata.driver_change.previous_driver_name || 'None'}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className={change.metadata.driver_change.new_driver_name ? 'font-medium' : 'text-muted-foreground'}>
                      {change.metadata.driver_change.new_driver_name || 'None'}
                    </span>
                  </div>
                )}
                
                {change.metadata?.vehicle_change && (
                  <div className="flex items-center gap-2 text-sm">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Vehicle:</span>
                    <span className={change.metadata.vehicle_change.previous_vehicle_number ? '' : 'text-muted-foreground'}>
                      {change.metadata.vehicle_change.previous_vehicle_number || 'None'}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className={change.metadata.vehicle_change.new_vehicle_number ? 'font-medium' : 'text-muted-foreground'}>
                      {change.metadata.vehicle_change.new_vehicle_number || 'None'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}