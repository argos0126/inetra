import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { 
  Truck, 
  MapPin, 
  Flag, 
  AlertTriangle, 
  PackageOpen,
  PackageCheck,
  Clock,
  WifiOff,
  PauseCircle,
  AlertCircle,
  RouteOff,
  Warehouse
} from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface TripAlert {
  id: string;
  alert_type: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  triggered_at: string;
  location_latitude?: number | null;
  location_longitude?: number | null;
}

export interface ShipmentStop {
  id: string;
  type: "pickup" | "drop";
  location_name: string;
  shipment_code: string;
  status: "pending" | "completed";
  time?: string | null;
}

export interface LiveTimelineEvent {
  id: string;
  title: string;
  description?: string;
  type: "origin" | "pickup" | "drop" | "destination" | "current_location" | "alert";
  status: "completed" | "current" | "upcoming" | "alert";
  time?: string | null;
  alertType?: string;
  alertSeverity?: string;
}

interface TripLiveTimelineProps {
  tripStatus: string;
  originName: string;
  destinationName: string;
  actualStartTime?: string | null;
  actualEndTime?: string | null;
  plannedEndTime?: string | null;
  currentLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
    time?: string;
  } | null;
  shipmentStops: ShipmentStop[];
  alerts: TripAlert[];
  vehicleProgressPercent?: number; // 0-100, position along the route
  snapToSteps?: boolean; // Snap vehicle position to 10% increments for stable layouts
  className?: string;
}

// Fixed slot configuration
const TOTAL_SLOTS = 11; // 0-10 (11 slots total)
const SLOT_HEIGHT = 64; // Fixed height per slot in pixels

interface SlotContent {
  events: LiveTimelineEvent[];
}

export function TripLiveTimeline({
  tripStatus,
  originName,
  destinationName,
  actualStartTime,
  actualEndTime,
  plannedEndTime,
  currentLocation,
  shipmentStops,
  alerts,
  vehicleProgressPercent = 0,
  snapToSteps = true,
  className
}: TripLiveTimelineProps) {
  const formatTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    try {
      return format(parseISO(dateStr), "HH:mm, dd MMM");
    } catch {
      return null;
    }
  };

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case "route_deviation":
        return <RouteOff className="h-4 w-4" />;
      case "stoppage":
        return <PauseCircle className="h-4 w-4" />;
      case "tracking_lost":
        return <WifiOff className="h-4 w-4" />;
      case "delay_warning":
      case "delay_detected":
        return <Clock className="h-4 w-4" />;
      case "idle_time":
      case "idle_detected":
        return <PauseCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
      case "critical":
        return "bg-destructive text-destructive-foreground";
      case "medium":
        return "bg-orange-500 text-white";
      default:
        return "bg-yellow-500 text-white";
    }
  };

  // Build intermediate events (pickups, drops, alerts) - excludes origin and destination
  const intermediateEvents: LiveTimelineEvent[] = [];

  // Pickup locations from shipments
  const pickupStops = shipmentStops.filter(s => s.type === "pickup");
  pickupStops.forEach(stop => {
    intermediateEvents.push({
      id: `pickup-${stop.id}`,
      title: `Pickup: ${stop.location_name}`,
      description: `Shipment ${stop.shipment_code}`,
      type: "pickup",
      status: stop.status === "completed" ? "completed" : "upcoming",
      time: stop.time
    });
  });

  // Active alerts
  const activeAlerts = alerts.filter(a => a.status === "active" || a.status === "acknowledged");
  activeAlerts.forEach(alert => {
    intermediateEvents.push({
      id: `alert-${alert.id}`,
      title: alert.title,
      description: alert.description,
      type: "alert",
      status: "alert",
      time: alert.triggered_at,
      alertType: alert.alert_type,
      alertSeverity: alert.severity
    });
  });

  // Drop locations from shipments
  const dropStops = shipmentStops.filter(s => s.type === "drop");
  dropStops.forEach(stop => {
    intermediateEvents.push({
      id: `drop-${stop.id}`,
      title: `Drop: ${stop.location_name}`,
      description: `Shipment ${stop.shipment_code}`,
      type: "drop",
      status: stop.status === "completed" ? "completed" : "upcoming",
      time: stop.time
    });
  });

  // Create origin and destination events
  const originEvent: LiveTimelineEvent = {
    id: "origin",
    title: originName,
    description: actualStartTime ? "Departed" : "Starting point",
    type: "origin",
    status: actualStartTime ? "completed" : tripStatus === "ongoing" ? "current" : "upcoming",
    time: actualStartTime
  };

  const destinationEvent: LiveTimelineEvent = {
    id: "destination",
    title: destinationName,
    description: actualEndTime ? "Arrived" : plannedEndTime ? `ETA: ${formatTime(plannedEndTime)}` : "End point",
    type: "destination",
    status: actualEndTime ? "completed" : "upcoming",
    time: actualEndTime
  };

  // Map intermediate events to slots 1-9 (distributed evenly)
  const slots: SlotContent[] = Array.from({ length: TOTAL_SLOTS }, () => ({ events: [] }));
  
  // Slot 0 = Origin, Slot 10 = Destination
  slots[0].events.push(originEvent);
  slots[10].events.push(destinationEvent);

  // Distribute intermediate events across slots 1-9
  if (intermediateEvents.length > 0) {
    const availableSlots = 9; // slots 1-9
    intermediateEvents.forEach((event, index) => {
      let slotIndex: number;
      if (intermediateEvents.length === 1) {
        slotIndex = 5; // Center single event
      } else {
        // Distribute evenly across slots 1-9
        slotIndex = 1 + Math.round(index * (availableSlots - 1) / (intermediateEvents.length - 1));
      }
      // Clamp to valid range
      slotIndex = Math.max(1, Math.min(9, slotIndex));
      slots[slotIndex].events.push(event);
    });
  }

  // Calculate vehicle step (0-10), clamped to max 9 if trip not ended
  const rawVehicleStep = snapToSteps 
    ? Math.round(vehicleProgressPercent / 10) 
    : Math.round(vehicleProgressPercent / 10);
  const vehicleStep = actualEndTime 
    ? Math.min(10, rawVehicleStep) 
    : Math.min(9, rawVehicleStep); // Never overlap destination if trip ongoing

  const showVehicleIndicator = tripStatus === "ongoing" && currentLocation && !actualEndTime && vehicleProgressPercent > 0;

  // Get icon for event type
  const getIcon = (event: LiveTimelineEvent) => {
    const iconClass = "h-5 w-5";
    
    switch (event.type) {
      case "origin":
        return <Warehouse className={cn(iconClass, "text-green-600")} />;
      case "pickup":
        return <PackageOpen className={cn(iconClass, event.status === "completed" ? "text-blue-600" : "text-blue-400")} />;
      case "drop":
        return <PackageCheck className={cn(iconClass, event.status === "completed" ? "text-purple-600" : "text-purple-400")} />;
      case "destination":
        return <Flag className={cn(iconClass, "text-red-600")} />;
      case "alert":
        return getAlertIcon(event.alertType || "");
      default:
        return <MapPin className={iconClass} />;
    }
  };

  // Get node style based on event type and status
  const getNodeStyle = (event: LiveTimelineEvent) => {
    if (event.type === "alert") {
      return cn(
        "border-2 border-destructive bg-destructive/10",
        event.alertSeverity === "high" || event.alertSeverity === "critical" 
          ? "ring-2 ring-destructive/30" 
          : ""
      );
    }
    
    switch (event.type) {
      case "origin":
        return cn(
          "border-2 border-green-500",
          event.status === "completed" ? "bg-green-500/20" : "bg-green-500/10"
        );
      case "destination":
        return cn(
          "border-2 border-red-500",
          event.status === "completed" ? "bg-red-500/20" : "bg-red-500/10"
        );
      case "pickup":
        return cn(
          "border-2 border-blue-500",
          event.status === "completed" ? "bg-blue-500/20" : "bg-blue-500/10"
        );
      case "drop":
        return cn(
          "border-2 border-purple-500",
          event.status === "completed" ? "bg-purple-500/20" : "bg-purple-500/10"
        );
      default:
        return "border-2 border-border bg-muted";
    }
  };

  const timelineHeight = TOTAL_SLOTS * SLOT_HEIGHT;

  return (
    <TooltipProvider>
      <div className={cn("relative", className)} style={{ height: `${timelineHeight}px` }}>
        {/* Fixed vertical rail */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
        
        {/* Progress fill on the rail */}
        <div 
          className="absolute left-5 top-0 w-0.5 bg-primary transition-all duration-500"
          style={{ height: `${(vehicleStep / 10) * 100}%` }}
        />


        {/* Render slots with events */}
        {slots.map((slot, slotIndex) => {
          const hasEvents = slot.events.length > 0;

          return (
            <div
              key={`slot-${slotIndex}`}
              className="absolute left-0 right-0 flex items-start"
              style={{ top: `${slotIndex * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
            >
              {/* Event nodes and content */}
              {hasEvents && (
                <div className="flex items-start gap-3 w-full">
                  {/* Node */}
                  <div className="relative flex-shrink-0">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300",
                        getNodeStyle(slot.events[0])
                      )}
                    >
                      {getIcon(slot.events[0])}
                    </div>
                    {/* Stacked events indicator */}
                    {slot.events.length > 1 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="secondary"
                            className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] cursor-pointer"
                          >
                            +{slot.events.length - 1}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <div className="space-y-1">
                            {slot.events.slice(1).map((e) => (
                              <div key={e.id} className="text-xs">
                                <span className="font-medium">{e.title}</span>
                                {e.description && (
                                  <span className="text-muted-foreground"> - {e.description}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  {/* Event content */}
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{slot.events[0].title}</p>
                        {slot.events[0].description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {slot.events[0].description}
                          </p>
                        )}
                      </div>
                      {slot.events[0].time && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatTime(slot.events[0].time)}
                        </span>
                      )}
                    </div>

                    {/* Alert badge */}
                    {slot.events[0].type === "alert" && slot.events[0].alertSeverity && (
                      <Badge
                        className={cn(
                          "text-xs gap-1 mt-1",
                          getSeverityColor(slot.events[0].alertSeverity)
                        )}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {slot.events[0].alertSeverity.charAt(0).toUpperCase() +
                          slot.events[0].alertSeverity.slice(1)}
                      </Badge>
                    )}

                    {/* Status badge for pickup/drop */}
                    {(slot.events[0].type === "pickup" || slot.events[0].type === "drop") &&
                      slot.events[0].status === "completed" && (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-primary/10 text-primary mt-1"
                        >
                          Completed
                        </Badge>
                      )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Vehicle indicator (single, non-overlapping) with smooth animation */}
        {showVehicleIndicator && (
          <div
            className="absolute z-20 flex items-start gap-3 transition-all duration-700 ease-out"
            style={{ top: `${vehicleStep * SLOT_HEIGHT + SLOT_HEIGHT / 2}px`, transform: "translateY(-50%)" }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-orange-500 bg-orange-500 shadow-lg animate-fade-in">
              <Truck className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div className="min-w-0 animate-fade-in">
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="bg-green-500/10 text-green-600 border-green-500/30 animate-pulse"
                >
                  Live
                </Badge>
              </div>
              <div className="mt-1 max-w-[260px]">
                {currentLocation?.time && (
                  <div className="text-xs text-foreground leading-snug">
                    {formatTime(currentLocation.time)}
                  </div>
                )}
                {currentLocation?.address && (
                  <div className="text-xs text-muted-foreground leading-snug line-clamp-2">
                    {currentLocation.address}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </TooltipProvider>
  );
}
