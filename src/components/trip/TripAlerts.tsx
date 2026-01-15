import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Info, Circle } from "lucide-react";

export interface TripAlert {
  id: string;
  title: string;
  description: string;
  severity: "critical" | "warning" | "info";
  timestamp?: string;
}

interface TripAlertsProps {
  alerts: TripAlert[];
  className?: string;
}

export function TripAlerts({ alerts, className }: TripAlertsProps) {
  const getIcon = (severity: TripAlert["severity"]) => {
    switch (severity) {
      case "critical":
        return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case "info":
        return <Info className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getBadgeVariant = (severity: TripAlert["severity"]) => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "warning":
        return "default";
      case "info":
        return "secondary";
    }
  };

  const getBadgeLabel = (severity: TripAlert["severity"]) => {
    switch (severity) {
      case "critical":
        return "Critical";
      case "warning":
        return "Warning";
      case "info":
        return "Info";
    }
  };

  if (alerts.length === 0) {
    return (
      <div className={cn("text-center py-6 text-muted-foreground", className)}>
        <Circle className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No alerts for this trip</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={cn(
            "flex items-start gap-3 p-3 rounded-lg border",
            alert.severity === "critical" && "border-destructive/30 bg-destructive/5",
            alert.severity === "warning" && "border-orange-500/30 bg-orange-500/5",
            alert.severity === "info" && "border-border bg-muted/50"
          )}
        >
          <div className="mt-0.5">{getIcon(alert.severity)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium text-sm">{alert.title}</h4>
              <Badge
                variant={getBadgeVariant(alert.severity) as any}
                className={cn(
                  "shrink-0 text-xs",
                  alert.severity === "warning" && "bg-orange-500 hover:bg-orange-600"
                )}
              >
                {getBadgeLabel(alert.severity)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
