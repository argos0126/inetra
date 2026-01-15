import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Circle, 
  CheckCircle, 
  Clock, 
  User, 
  MapPin, 
  Settings, 
  Smartphone,
  AlertTriangle 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getShipmentStatusHistory } from "@/utils/shipmentStatusLogger";
import { statusConfig, subStatusConfig } from "@/utils/shipmentValidations";
import { format } from "date-fns";

interface ShipmentStatusTimelineProps {
  shipmentId: string;
  className?: string;
}

interface HistoryEntry {
  id: string;
  previous_status: string | null;
  new_status: string;
  previous_sub_status: string | null;
  new_sub_status: string | null;
  changed_at: string;
  change_source: string;
  notes: string | null;
  metadata: Record<string, any>;
}

const sourceIcons: Record<string, React.ElementType> = {
  manual: User,
  geofence: MapPin,
  api: Settings,
  system: Smartphone,
};

const sourceLabels: Record<string, string> = {
  manual: "Manual",
  geofence: "Geofence",
  api: "API",
  system: "System",
};

export function ShipmentStatusTimeline({ shipmentId, className }: ShipmentStatusTimelineProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [shipmentId]);

  const loadHistory = async () => {
    setLoading(true);
    const data = await getShipmentStatusHistory(shipmentId);
    setHistory(data);
    setLoading(false);
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">Status Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">Status Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No status changes recorded yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Status Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-6">
            {history.map((entry, index) => {
              const SourceIcon = sourceIcons[entry.change_source] || User;
              const config = statusConfig[entry.new_status as keyof typeof statusConfig];
              const isSubStatusChange = entry.previous_status === entry.new_status && entry.new_sub_status;
              const subConfig = entry.new_sub_status && subStatusConfig[entry.new_status];
              const subLabel = subConfig?.labels?.[entry.new_sub_status];

              return (
                <div key={entry.id} className="relative flex gap-4 pl-2">
                  {/* Timeline dot */}
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center z-10 shrink-0",
                      config?.bgColor || "bg-muted"
                    )}
                  >
                    <CheckCircle className={cn("w-4 h-4", config?.color || "text-muted-foreground")} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={cn(config?.color)}>
                        {isSubStatusChange ? subLabel : config?.label || entry.new_status}
                      </Badge>
                      
                      {isSubStatusChange && (
                        <span className="text-xs text-muted-foreground">
                          (within {config?.label})
                        </span>
                      )}

                      {entry.metadata?.is_delayed && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Delayed
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <SourceIcon className="w-3 h-3" />
                      <span>{sourceLabels[entry.change_source] || entry.change_source}</span>
                      <span>•</span>
                      <span>{format(new Date(entry.changed_at), "MMM d, yyyy h:mm a")}</span>
                    </div>

                    {entry.notes && (
                      <p className="mt-1 text-sm text-muted-foreground italic">
                        "{entry.notes}"
                      </p>
                    )}

                    {entry.previous_status && !isSubStatusChange && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Changed from{" "}
                        <span className="font-medium">
                          {statusConfig[entry.previous_status as keyof typeof statusConfig]?.label || entry.previous_status}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
