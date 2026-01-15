import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock, MapPin, Flag, Truck } from "lucide-react";

export interface TimelineEvent {
  id: string;
  time: string;
  title: string;
  description?: string;
  status: "completed" | "current" | "upcoming" | "delayed";
  type: "origin" | "waypoint" | "destination" | "event";
  delay?: string;
}

interface TripTimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export function TripTimeline({ events, className }: TripTimelineProps) {
  const getIcon = (type: TimelineEvent["type"], status: TimelineEvent["status"]) => {
    const iconClass = cn(
      "h-5 w-5",
      status === "completed" && "text-primary",
      status === "current" && "text-orange-500",
      status === "upcoming" && "text-muted-foreground",
      status === "delayed" && "text-destructive"
    );

    switch (type) {
      case "origin":
        return <Truck className={iconClass} />;
      case "destination":
        return <Flag className={iconClass} />;
      default:
        return status === "completed" ? (
          <CheckCircle2 className={iconClass} />
        ) : (
          <Circle className={iconClass} />
        );
    }
  };

  const getStatusBadge = (status: TimelineEvent["status"], delay?: string) => {
    if (status === "delayed" && delay) {
      return (
        <Badge variant="destructive" className="text-xs">
          Delayed by {delay}
        </Badge>
      );
    }
    if (status === "completed" || status === "current") {
      return (
        <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
          On Schedule
        </Badge>
      );
    }
    return null;
  };

  const getLineColor = (status: TimelineEvent["status"]) => {
    switch (status) {
      case "completed":
        return "bg-primary";
      case "current":
        return "bg-orange-500";
      case "delayed":
        return "bg-destructive";
      default:
        return "bg-border";
    }
  };

  return (
    <div className={cn("space-y-0", className)}>
      {events.map((event, index) => (
        <div key={event.id} className="flex gap-4">
          {/* Timeline indicator */}
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border-2",
                event.status === "completed" && "border-primary bg-primary/10",
                event.status === "current" && "border-orange-500 bg-orange-500/10",
                event.status === "upcoming" && "border-border bg-muted",
                event.status === "delayed" && "border-destructive bg-destructive/10"
              )}
            >
              {getIcon(event.type, event.status)}
            </div>
            {index < events.length - 1 && (
              <div
                className={cn(
                  "w-0.5 flex-1 min-h-[40px]",
                  getLineColor(event.status)
                )}
              />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 pb-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{event.time}</span>
              {event.type === "destination" && event.status === "upcoming" && (
                <span className="text-muted-foreground">(ETA)</span>
              )}
            </div>
            <p className="font-medium mt-1">{event.title}</p>
            {event.description && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {event.description}
              </p>
            )}
            <div className="mt-2">
              {getStatusBadge(event.status, event.delay)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
