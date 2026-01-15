import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MapPin, AlertTriangle, Navigation, Clock, Loader2, MapPinned } from "lucide-react";
import { formatDistance } from "@/utils/geoUtils";

interface LocationValidationResult {
  valid: boolean;
  distance_meters: number;
  radius_meters: number;
  current_location: {
    latitude: number;
    longitude: number;
    timestamp: string;
    detailed_address: string | null;
  } | null;
  target_location: {
    latitude: number;
    longitude: number;
    name: string;
  };
  tracking_type: 'gps' | 'sim' | 'none';
  location_stale: boolean;
  stale_minutes?: number;
  error?: string;
}

interface LocationValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  validationResult: LocationValidationResult | null;
  actionType: 'start' | 'complete';
  loading: boolean;
  onConfirm: () => void;
  onOverride: (reason: string) => void;
  onRetry: () => void;
  onManualLocationUpdate?: () => void; // New prop for manual location update
}

export function LocationValidationDialog({
  open,
  onOpenChange,
  validationResult,
  actionType,
  loading,
  onConfirm,
  onOverride,
  onRetry,
  onManualLocationUpdate
}: LocationValidationDialogProps) {
  const [overrideReason, setOverrideReason] = useState("");
  const [showOverrideForm, setShowOverrideForm] = useState(false);

  const handleOverride = () => {
    if (overrideReason.trim().length < 10) {
      return;
    }
    onOverride(overrideReason);
    setOverrideReason("");
    setShowOverrideForm(false);
  };

  const locationLabel = actionType === 'start' ? 'origin' : 'destination';

  if (!validationResult) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            {validationResult.valid ? (
              <>
                <Navigation className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 shrink-0" />
                Location Validated
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500 shrink-0" />
                <span className="break-words">Location Outside {locationLabel.charAt(0).toUpperCase() + locationLabel.slice(1)} Radius</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {validationResult.valid
              ? `Vehicle is within the ${locationLabel} geofence. Ready to ${actionType} trip.`
              : `Vehicle must be within ${formatDistance(validationResult.radius_meters)} of the ${locationLabel} to ${actionType} the trip.`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
          {/* Current Location */}
          <div className="rounded-lg border bg-muted/50 p-3 sm:p-4 space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-medium">Current Vehicle Location</span>
              <Badge variant={validationResult.tracking_type === 'gps' ? 'default' : 'secondary'} className="text-xs shrink-0">
                {validationResult.tracking_type.toUpperCase()}
              </Badge>
            </div>
            
            {validationResult.current_location ? (
              <>
                <div className="flex items-start gap-2">
                  <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-xs sm:text-sm break-words">
                    {validationResult.current_location.detailed_address || 
                      `${validationResult.current_location.latitude.toFixed(6)}, ${validationResult.current_location.longitude.toFixed(6)}`
                    }
                  </span>
                </div>
                
                {validationResult.location_stale && (
                  <Alert variant="destructive" className="py-2">
                    <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                    <AlertDescription className="text-xs sm:text-sm">
                      Location data is {validationResult.stale_minutes} minutes old
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <Alert variant="destructive" className="py-2">
                <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4" />
                <AlertDescription className="text-xs sm:text-sm">
                  {validationResult.error || 'Unable to fetch current location'}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Target Location */}
          <div className="rounded-lg border p-3 sm:p-4 space-y-2">
            <span className="text-xs sm:text-sm font-medium">{locationLabel.charAt(0).toUpperCase() + locationLabel.slice(1)} Location</span>
            <div className="flex items-start gap-2">
              <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-primary mt-0.5 shrink-0" />
              <span className="text-xs sm:text-sm break-words">{validationResult.target_location.name}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Allowed radius: {formatDistance(validationResult.radius_meters)}
            </div>
          </div>

          {/* Distance Info */}
          {validationResult.current_location && (
            <div className="flex items-center justify-between gap-2 rounded-lg border p-3 sm:p-4">
              <span className="text-xs sm:text-sm font-medium">Vehicle distance from {locationLabel}</span>
              <Badge variant={validationResult.valid ? 'default' : 'destructive'} className="text-xs shrink-0">
                {formatDistance(validationResult.distance_meters)}
              </Badge>
            </div>
          )}

          {/* Manual Location Update Option (Admin only) */}
          {!validationResult.valid && onManualLocationUpdate && (
            <Alert className="bg-blue-500/10 border-blue-500/30 p-3">
              <MapPinned className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
              <AlertDescription className="text-xs sm:text-sm">
                If the vehicle is at the {locationLabel} but tracking is inaccurate, you can manually update the location.
              </AlertDescription>
            </Alert>
          )}

          {/* Override Form */}
          {!validationResult.valid && showOverrideForm && (
            <div className="space-y-2">
              <Label htmlFor="override-reason" className="text-xs sm:text-sm">Override Reason (required)</Label>
              <Textarea
                id="override-reason"
                placeholder="Enter reason for overriding location validation (min 10 characters)..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={3}
                className="text-xs sm:text-sm"
              />
              <p className="text-xs text-muted-foreground">
                This will be logged in the trip audit history.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {validationResult.valid ? (
            <Button onClick={onConfirm} disabled={loading} className="w-full sm:w-auto text-xs sm:text-sm">
              {loading && <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />}
              {actionType === 'start' ? 'Start Trip' : 'Complete Trip'}
            </Button>
          ) : (
            <>
              {/* Manual Location Update Button */}
              {onManualLocationUpdate && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    onOpenChange(false);
                    onManualLocationUpdate();
                  }}
                  disabled={loading}
                  className="w-full sm:w-auto border-blue-500/50 text-blue-600 hover:bg-blue-500/10 text-xs sm:text-sm"
                >
                  <MapPinned className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  Manual Location Update
                </Button>
              )}
              
              <Button variant="outline" onClick={onRetry} disabled={loading} className="w-full sm:w-auto text-xs sm:text-sm">
                {loading && <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />}
                Retry Location Check
              </Button>
              
              {showOverrideForm ? (
                <Button 
                  variant="destructive" 
                  onClick={handleOverride} 
                  disabled={overrideReason.trim().length < 10 || loading}
                  className="w-full sm:w-auto text-xs sm:text-sm"
                >
                  Confirm Override
                </Button>
              ) : (
                <Button 
                  variant="ghost" 
                  onClick={() => setShowOverrideForm(true)}
                  className="w-full sm:w-auto text-xs sm:text-sm"
                >
                  Override & Continue
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
