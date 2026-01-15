import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Gauge, Timer, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format, differenceInMinutes, parseISO, addMinutes } from "date-fns";

interface TripETACardProps {
  originName: string;
  destinationName: string;
  totalDistanceKm: number | null;
  coveredDistanceKm?: number | null;
  plannedStartTime: string | null;
  actualStartTime: string | null;
  plannedEndTime: string | null;
  currentEta?: string | null;
  averageSpeedKmph?: number | null;
  tripStatus: string;
}

export function TripETACard({
  originName,
  destinationName,
  totalDistanceKm,
  coveredDistanceKm = 0,
  plannedStartTime,
  actualStartTime,
  plannedEndTime,
  currentEta,
  averageSpeedKmph,
  tripStatus,
}: TripETACardProps) {
  const remainingDistance = totalDistanceKm ? totalDistanceKm - (coveredDistanceKm || 0) : null;
  const progressPercent = totalDistanceKm && coveredDistanceKm 
    ? Math.min(100, Math.round((coveredDistanceKm / totalDistanceKm) * 100))
    : 0;

  // Calculate ETA based on remaining distance and average speed
  const calculateETA = () => {
    if (!remainingDistance || !averageSpeedKmph || averageSpeedKmph <= 0) {
      return currentEta || plannedEndTime;
    }
    
    const hoursRemaining = remainingDistance / averageSpeedKmph;
    const minutesRemaining = Math.round(hoursRemaining * 60);
    const etaDate = addMinutes(new Date(), minutesRemaining);
    return etaDate.toISOString();
  };

  const estimatedArrival = tripStatus === "ongoing" ? calculateETA() : (currentEta || plannedEndTime);

  // Calculate if ahead/behind schedule
  const getScheduleStatus = () => {
    if (!plannedEndTime || !estimatedArrival) return null;
    
    try {
      const planned = parseISO(plannedEndTime);
      const estimated = parseISO(estimatedArrival);
      const diffMinutes = differenceInMinutes(estimated, planned);
      
      if (Math.abs(diffMinutes) < 5) return { status: 'on-time', minutes: 0 };
      if (diffMinutes > 0) return { status: 'delayed', minutes: diffMinutes };
      return { status: 'ahead', minutes: Math.abs(diffMinutes) };
    } catch {
      return null;
    }
  };

  const scheduleStatus = getScheduleStatus();

  const formatTimeRemaining = (etaStr: string | null) => {
    if (!etaStr) return null;
    try {
      const eta = parseISO(etaStr);
      const now = new Date();
      const diffMinutes = differenceInMinutes(eta, now);
      
      if (diffMinutes < 0) return "Arrived";
      if (diffMinutes < 60) return `${diffMinutes} min`;
      
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    } catch {
      return null;
    }
  };

  const formatEtaTime = (etaStr: string | null) => {
    if (!etaStr) return "--:--";
    try {
      return format(parseISO(etaStr), "HH:mm");
    } catch {
      return "--:--";
    }
  };

  const formatEtaDate = (etaStr: string | null) => {
    if (!etaStr) return null;
    try {
      return format(parseISO(etaStr), "dd MMM yyyy");
    } catch {
      return null;
    }
  };

  const timeRemaining = formatTimeRemaining(estimatedArrival);
  const etaTime = formatEtaTime(estimatedArrival);
  const etaDate = formatEtaDate(estimatedArrival);

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Timer className="h-5 w-5 text-primary" />
          ETA & Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ETA Display */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Estimated Arrival</p>
            <p className="text-2xl font-bold">{etaTime}</p>
            {etaDate && <p className="text-xs text-muted-foreground">{etaDate}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Time Remaining</p>
            <p className="text-xl font-semibold text-primary">{timeRemaining || "--"}</p>
          </div>
        </div>

        {/* Schedule Status */}
        {scheduleStatus && tripStatus === "ongoing" && (
          <div className="flex items-center gap-2">
            {scheduleStatus.status === 'on-time' && (
              <Badge variant="secondary" className="bg-primary/10 text-primary gap-1">
                <Minus className="h-3 w-3" />
                On Schedule
              </Badge>
            )}
            {scheduleStatus.status === 'ahead' && (
              <Badge variant="secondary" className="bg-green-500/10 text-green-600 gap-1">
                <TrendingDown className="h-3 w-3" />
                {scheduleStatus.minutes} min ahead
              </Badge>
            )}
            {scheduleStatus.status === 'delayed' && (
              <Badge variant="destructive" className="gap-1">
                <TrendingUp className="h-3 w-3" />
                {scheduleStatus.minutes} min delayed
              </Badge>
            )}
          </div>
        )}

        {/* Distance Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Distance Progress</span>
            <span className="font-medium">
              {coveredDistanceKm?.toFixed(1) || 0} / {totalDistanceKm?.toFixed(1) || 0} km
            </span>
          </div>
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{progressPercent}% complete</span>
            <span>{remainingDistance?.toFixed(1) || 0} km remaining</span>
          </div>
        </div>

        {/* Speed & Stats */}
        {tripStatus === "ongoing" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Avg Speed</p>
                <p className="text-sm font-medium">{averageSpeedKmph?.toFixed(0) || "--"} km/h</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Remaining</p>
                <p className="text-sm font-medium">{remainingDistance?.toFixed(1) || "--"} km</p>
              </div>
            </div>
          </div>
        )}

        {/* Route info */}
        <div className="pt-2 border-t">
          <div className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="truncate max-w-[120px]">{originName}</span>
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="truncate max-w-[120px]">{destinationName}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
