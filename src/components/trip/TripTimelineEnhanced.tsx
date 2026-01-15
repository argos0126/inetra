import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock, MapPin, Flag, Truck, AlertTriangle, Timer } from "lucide-react";
import { format, differenceInMinutes, parseISO } from "date-fns";

export interface EnhancedTimelineEvent {
  id: string;
  title: string;
  description?: string;
  type: "origin" | "waypoint" | "destination" | "event";
  status: "completed" | "current" | "upcoming" | "delayed" | "skipped";
  plannedTime?: string | null;
  actualTime?: string | null;
  delayMinutes?: number | null;
  sequence?: number;
}

interface TripTimelineEnhancedProps {
  events: EnhancedTimelineEvent[];
  className?: string;
}

export function TripTimelineEnhanced({ events, className }: TripTimelineEnhancedProps) {
  const formatTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    try {
      return format(parseISO(dateStr), "HH:mm");
    } catch {
      return null;
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    try {
      return format(parseISO(dateStr), "dd MMM");
    } catch {
      return null;
    }
  };

  const calculateDelay = (planned: string | null | undefined, actual: string | null | undefined) => {
    if (!planned || !actual) return null;
    try {
      const plannedDate = parseISO(planned);
      const actualDate = parseISO(actual);
      const diff = differenceInMinutes(actualDate, plannedDate);
      return diff > 0 ? diff : null;
    } catch {
      return null;
    }
  };

  const getIcon = (type: EnhancedTimelineEvent["type"], status: EnhancedTimelineEvent["status"]) => {
    const iconClass = cn(
      "h-5 w-5",
      status === "completed" && "text-primary",
      status === "current" && "text-orange-500",
      status === "upcoming" && "text-muted-foreground",
      status === "delayed" && "text-destructive",
      status === "skipped" && "text-muted-foreground"
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
          <MapPin className={iconClass} />
        );
    }
  };

  const getLineColor = (status: EnhancedTimelineEvent["status"]) => {
    switch (status) {
      case "completed":
        return "bg-primary";
      case "current":
        return "bg-orange-500";
      case "delayed":
        return "bg-destructive";
      case "skipped":
        return "bg-muted-foreground/30";
      default:
        return "bg-border";
    }
  };

  const formatDelayText = (minutes: number) => {
    if (minutes < 60) return `${minutes} min late`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m late` : `${hours}h late`;
  };

  return (
    <div className={cn("space-y-0", className)}>
      {events.map((event, index) => {
        const delay = event.delayMinutes || calculateDelay(event.plannedTime, event.actualTime);
        const plannedTimeStr = formatTime(event.plannedTime);
        const actualTimeStr = formatTime(event.actualTime);
        const dateStr = formatDate(event.actualTime || event.plannedTime);
        
        return (
          <div key={event.id} className="flex gap-4">
            {/* Timeline indicator */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                  event.status === "completed" && "border-primary bg-primary/10",
                  event.status === "current" && "border-orange-500 bg-orange-500/10 ring-4 ring-orange-500/20",
                  event.status === "upcoming" && "border-border bg-muted",
                  event.status === "delayed" && "border-destructive bg-destructive/10",
                  event.status === "skipped" && "border-muted-foreground/30 bg-muted"
                )}
              >
                {getIcon(event.type, event.status)}
              </div>
              {index < events.length - 1 && (
                <div
                  className={cn(
                    "w-0.5 flex-1 min-h-[48px]",
                    getLineColor(event.status)
                  )}
                />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pb-6">
              {/* Header with times */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className={cn(
                    "font-medium",
                    event.status === "skipped" && "text-muted-foreground line-through"
                  )}>
                    {event.title}
                  </p>
                  {event.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {event.description}
                    </p>
                  )}
                </div>
                
                {/* Time display */}
                <div className="text-right shrink-0">
                  {actualTimeStr ? (
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">{actualTimeStr}</span>
                      {dateStr && <span className="text-xs text-muted-foreground">{dateStr}</span>}
                    </div>
                  ) : plannedTimeStr ? (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Timer className="h-3.5 w-3.5" />
                      <span className="text-sm">{plannedTimeStr}</span>
                      {dateStr && <span className="text-xs">{dateStr}</span>}
                      <span className="text-xs">(ETA)</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">--:--</span>
                  )}
                </div>
              </div>
              
              {/* Time comparison row */}
              {plannedTimeStr && actualTimeStr && event.status === "completed" && (
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <span>Planned:</span>
                    <span className="font-medium">{plannedTimeStr}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Actual:</span>
                    <span className={cn(
                      "font-medium",
                      delay && delay > 0 ? "text-destructive" : "text-primary"
                    )}>
                      {actualTimeStr}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Delay badge */}
              {delay && delay > 0 && (
                <div className="mt-2">
                  <Badge variant="destructive" className="text-xs gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {formatDelayText(delay)}
                  </Badge>
                </div>
              )}
              
              {/* On schedule badge for completed without delay */}
              {event.status === "completed" && (!delay || delay <= 0) && (
                <div className="mt-2">
                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    On Schedule
                  </Badge>
                </div>
              )}
              
              {/* Current status indicator */}
              {event.status === "current" && (
                <div className="mt-2">
                  <Badge className="text-xs bg-orange-500 gap-1 animate-pulse">
                    <Circle className="h-2 w-2 fill-current" />
                    In Progress
                  </Badge>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
