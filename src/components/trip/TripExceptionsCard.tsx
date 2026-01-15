import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormDialog } from "@/components/FormDialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  AlertTriangle, 
  UserCog, 
  Truck, 
  AlertCircle,
  ArrowRightLeft,
  Loader2,
  History
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Driver {
  id: string;
  name: string;
  mobile: string;
  transporter_id: string | null;
}

interface Vehicle {
  id: string;
  vehicle_number: string;
  make: string | null;
  model: string | null;
  tracking_asset_id: string | null;
  transporter_id: string | null;
}

interface AuditLog {
  id: string;
  previous_status: string | null;
  new_status: string;
  change_reason: string | null;
  created_at: string;
  metadata: any;
}

interface TripExceptionsCardProps {
  tripId: string;
  tripStatus: string;
  currentDriverId: string | null;
  currentVehicleId: string | null;
  currentTrackingAssetId: string | null;
  currentDriverName?: string;
  currentVehicleNumber?: string;
  transporterId: string | null;
  onTripUpdated: () => void;
}

type ExceptionType = "driver_switch" | "vehicle_switch" | "accident" | "breakdown" | "diverted_vehicle";

export function TripExceptionsCard({
  tripId,
  tripStatus,
  currentDriverId,
  currentVehicleId,
  currentTrackingAssetId,
  currentDriverName,
  currentVehicleNumber,
  transporterId,
  onTripUpdated
}: TripExceptionsCardProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [exceptionType, setExceptionType] = useState<ExceptionType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  
  // Form data
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [reason, setReason] = useState("");

  // Track drivers and vehicles already on active trips
  const [driversOnActiveTrips, setDriversOnActiveTrips] = useState<Set<string>>(new Set());
  const [vehiclesOnActiveTrips, setVehiclesOnActiveTrips] = useState<Set<string>>(new Set());

  // Fetch available drivers and vehicles, and check active trip assignments
  useEffect(() => {
    const fetchData = async () => {
      const [driversRes, vehiclesRes, activeTripsRes] = await Promise.all([
        supabase.from("drivers").select("id, name, mobile, transporter_id").eq("is_active", true),
        supabase.from("vehicles").select("id, vehicle_number, make, model, tracking_asset_id, transporter_id").eq("is_active", true),
        supabase.from("trips")
          .select("id, driver_id, vehicle_id, status")
          .in("status", ["created", "ongoing"])
          .neq("id", tripId) // Exclude current trip
      ]);
      
      if (driversRes.data) setDrivers(driversRes.data);
      if (vehiclesRes.data) setVehicles(vehiclesRes.data);
      
      // Build sets of drivers and vehicles already on active trips
      if (activeTripsRes.data) {
        const driverIds = new Set<string>();
        const vehicleIds = new Set<string>();
        activeTripsRes.data.forEach(trip => {
          if (trip.driver_id) driverIds.add(trip.driver_id);
          if (trip.vehicle_id) vehicleIds.add(trip.vehicle_id);
        });
        setDriversOnActiveTrips(driverIds);
        setVehiclesOnActiveTrips(vehicleIds);
      }
    };
    fetchData();
  }, [tripId]);

  // Fetch audit logs
  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const { data, error } = await supabase
        .from("trip_audit_logs")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      setAuditLogs(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching audit logs",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoadingAudit(false);
    }
  };

  const openExceptionDialog = (type: ExceptionType) => {
    setExceptionType(type);
    setSelectedDriverId("");
    setSelectedVehicleId("");
    setReason("");
    setIsDialogOpen(true);
  };

  const handleSubmitException = async () => {
    if (!exceptionType) return;
    
    setIsSubmitting(true);
    try {
      const updates: Record<string, any> = {};
      const auditMetadata: Record<string, any> = { exception_type: exceptionType };
      let changeReason = reason.trim();

      switch (exceptionType) {
        case "driver_switch":
          if (!selectedDriverId) {
            toast({ title: "Please select a driver", variant: "destructive" });
            setIsSubmitting(false);
            return;
          }
          const newDriver = drivers.find(d => d.id === selectedDriverId);
          auditMetadata.previous_driver_id = currentDriverId;
          auditMetadata.new_driver_id = selectedDriverId;
          auditMetadata.previous_driver_name = currentDriverName;
          auditMetadata.new_driver_name = newDriver?.name;
          updates.driver_id = selectedDriverId;
          if (!changeReason) changeReason = `Driver switched from ${currentDriverName || 'unassigned'} to ${newDriver?.name}`;
          break;

        case "vehicle_switch":
          if (!selectedVehicleId) {
            toast({ title: "Please select a vehicle", variant: "destructive" });
            setIsSubmitting(false);
            return;
          }
          const newVehicle = vehicles.find(v => v.id === selectedVehicleId);
          auditMetadata.previous_vehicle_id = currentVehicleId;
          auditMetadata.new_vehicle_id = selectedVehicleId;
          auditMetadata.previous_vehicle_number = currentVehicleNumber;
          auditMetadata.new_vehicle_number = newVehicle?.vehicle_number;
          auditMetadata.previous_tracking_asset_id = currentTrackingAssetId;
          auditMetadata.new_tracking_asset_id = newVehicle?.tracking_asset_id;
          
          updates.vehicle_id = selectedVehicleId;
          // Remap tracking asset from vehicle if available
          if (newVehicle?.tracking_asset_id) {
            updates.tracking_asset_id = newVehicle.tracking_asset_id;
            updates.tracking_type = 'gps';
            updates.is_trackable = true;
            auditMetadata.tracking_asset_remapped = true;
            auditMetadata.tracking_type_changed = 'gps';
          } else {
            updates.tracking_asset_id = null;
            updates.tracking_type = 'manual';
            updates.is_trackable = false;
            auditMetadata.tracking_asset_remapped = false;
            auditMetadata.tracking_type_changed = 'manual';
          }
          if (!changeReason) changeReason = `Vehicle switched from ${currentVehicleNumber || 'unassigned'} to ${newVehicle?.vehicle_number}`;
          break;

        case "accident":
          updates.status = "on_hold";
          auditMetadata.hold_reason = "accident";
          if (!changeReason) changeReason = "Trip put on hold due to accident";
          break;

        case "breakdown":
          updates.status = "on_hold";
          auditMetadata.hold_reason = "breakdown";
          if (!changeReason) changeReason = "Trip put on hold due to vehicle breakdown";
          break;

        case "diverted_vehicle":
          if (!selectedVehicleId) {
            toast({ title: "Please select a diverted vehicle", variant: "destructive" });
            setIsSubmitting(false);
            return;
          }
          const divertedVehicle = vehicles.find(v => v.id === selectedVehicleId);
          auditMetadata.exception_type = "diverted_vehicle";
          auditMetadata.previous_vehicle_id = currentVehicleId;
          auditMetadata.new_vehicle_id = selectedVehicleId;
          auditMetadata.previous_vehicle_number = currentVehicleNumber;
          auditMetadata.new_vehicle_number = divertedVehicle?.vehicle_number;
          auditMetadata.previous_tracking_asset_id = currentTrackingAssetId;
          auditMetadata.new_tracking_asset_id = divertedVehicle?.tracking_asset_id;
          auditMetadata.is_diverted = true;
          
          updates.vehicle_id = selectedVehicleId;
          updates.status = "ongoing"; // Resume trip with diverted vehicle
          // Remap tracking asset from diverted vehicle
          if (divertedVehicle?.tracking_asset_id) {
            updates.tracking_asset_id = divertedVehicle.tracking_asset_id;
            updates.tracking_type = 'gps';
            updates.is_trackable = true;
            auditMetadata.tracking_asset_remapped = true;
            auditMetadata.tracking_type_changed = 'gps';
          } else {
            updates.tracking_asset_id = null;
            updates.tracking_type = 'manual';
            updates.is_trackable = false;
            auditMetadata.tracking_type_changed = 'manual';
          }
          if (!changeReason) changeReason = `Diverted vehicle assigned: ${divertedVehicle?.vehicle_number}. Trip resumed.`;
          break;
      }

      // Update trip
      const { error: updateError } = await supabase
        .from("trips")
        .update(updates)
        .eq("id", tripId);

      if (updateError) throw updateError;

      // Create audit log
      const { error: auditError } = await supabase
        .from("trip_audit_logs")
        .insert([{
          trip_id: tripId,
          previous_status: tripStatus as any,
          new_status: (updates.status || tripStatus) as any,
          change_reason: changeReason,
          metadata: auditMetadata
        }]);

      if (auditError) throw auditError;

      toast({
        title: "Exception handled",
        description: changeReason
      });

      setIsDialogOpen(false);
      onTripUpdated();
    } catch (error: any) {
      toast({
        title: "Error handling exception",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDialogTitle = () => {
    switch (exceptionType) {
      case "driver_switch": return "Switch Driver";
      case "vehicle_switch": return "Switch Vehicle";
      case "accident": return "Report Accident";
      case "breakdown": return "Report Breakdown";
      case "diverted_vehicle": return "Assign Diverted Vehicle";
      default: return "Handle Exception";
    }
  };

  const getDialogDescription = () => {
    switch (exceptionType) {
      case "driver_switch": return "Select a new driver for this trip. An audit log will be created.";
      case "vehicle_switch": return "Select a new vehicle. Tracking asset will be remapped automatically.";
      case "accident": return "Report an accident. Trip will be put on hold.";
      case "breakdown": return "Report a vehicle breakdown. Trip will be put on hold.";
      case "diverted_vehicle": return "Assign a replacement vehicle to continue the trip. Tracking asset will be remapped.";
      default: return "";
    }
  };

  const formatAuditMetadata = (metadata: Record<string, any> | null) => {
    if (!metadata) return null;
    
    const parts: string[] = [];
    if (metadata.exception_type) parts.push(`Type: ${metadata.exception_type.replace(/_/g, " ")}`);
    if (metadata.is_diverted) parts.push("Diverted vehicle");
    if (metadata.new_driver_name) parts.push(`New Driver: ${metadata.new_driver_name}`);
    if (metadata.new_vehicle_number) parts.push(`New Vehicle: ${metadata.new_vehicle_number}`);
    if (metadata.tracking_asset_remapped) parts.push("Tracking asset remapped");
    if (metadata.tracking_type_changed) parts.push(`Tracking: ${metadata.tracking_type_changed}`);
    if (metadata.hold_reason) parts.push(`Hold reason: ${metadata.hold_reason}`);
    
    return parts.length > 0 ? parts.join(" • ") : null;
  };

  // Show for created, ongoing, and on_hold trips
  const canManageExceptions = tripStatus === "ongoing" || tripStatus === "on_hold" || tripStatus === "created";
  
  if (!canManageExceptions) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center">
              {tripStatus === "created" ? (
                <>
                  <ArrowRightLeft className="mr-2 h-4 w-4 text-blue-500" />
                  Assign Resources
                </>
              ) : (
                <>
                  <AlertTriangle className="mr-2 h-4 w-4 text-orange-500" />
                  Trip Exceptions
                </>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowAuditLog(!showAuditLog);
                if (!showAuditLog && auditLogs.length === 0) {
                  fetchAuditLogs();
                }
              }}
            >
              <History className="h-4 w-4 mr-1" />
              {showAuditLog ? "Hide" : "Audit Log"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* On Hold Banner with Diverted Vehicle Option */}
          {tripStatus === "on_hold" && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg mb-2">
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-2">
                Trip is currently on hold
              </p>
              <Button
                size="sm"
                onClick={() => openExceptionDialog("diverted_vehicle")}
                className="w-full bg-yellow-600 hover:bg-yellow-700"
              >
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Assign Diverted Vehicle & Resume
              </Button>
            </div>
          )}

          {/* Exception Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openExceptionDialog("driver_switch")}
              className="justify-start"
            >
              <UserCog className="h-4 w-4 mr-2" />
              Switch Driver
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openExceptionDialog("vehicle_switch")}
              className="justify-start"
            >
              <Truck className="h-4 w-4 mr-2" />
              Switch Vehicle
            </Button>
            {tripStatus === "ongoing" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openExceptionDialog("accident")}
                  className="justify-start text-destructive hover:text-destructive"
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Report Accident
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openExceptionDialog("breakdown")}
                  className="justify-start text-orange-600 hover:text-orange-700"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Report Breakdown
                </Button>
              </>
            )}
          </div>

          {/* Audit Log Section */}
          {showAuditLog && (
            <div className="mt-4 border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Recent Changes</h4>
              {loadingAudit ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {auditLogs.map((log) => (
                    <div 
                      key={log.id} 
                      className="text-sm border-l-2 border-muted pl-3 py-1"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        {log.previous_status !== log.new_status && (
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">
                              {log.previous_status || "new"}
                            </Badge>
                            <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                            <Badge variant="secondary" className="text-xs">
                              {log.new_status}
                            </Badge>
                          </div>
                        )}
                        <span className="text-muted-foreground text-xs">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      {log.change_reason && (
                        <p className="text-muted-foreground mt-1">{log.change_reason}</p>
                      )}
                      {log.metadata && (
                        <p className="text-xs text-muted-foreground/70 mt-0.5">
                          {formatAuditMetadata(log.metadata)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Exception Dialog */}
      <FormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={getDialogTitle()}
        description={getDialogDescription()}
        onSubmit={handleSubmitException}
        isSubmitting={isSubmitting}
      >
        <div className="space-y-4">
          {exceptionType === "driver_switch" && (
            <>
              <div>
                <Label>Current Driver</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {currentDriverName || "No driver assigned"}
                </p>
              </div>
              <div>
                <Label htmlFor="new_driver">New Driver *</Label>
                <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select new driver" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers
                      .filter(d => d.id !== currentDriverId)
                      .map((driver) => {
                        const isOnActiveTrip = driversOnActiveTrips.has(driver.id);
                        return (
                          <SelectItem 
                            key={driver.id} 
                            value={driver.id}
                            className={isOnActiveTrip ? "text-orange-600" : ""}
                          >
                            {driver.name} ({driver.mobile})
                            {isOnActiveTrip && " ⚠️ On active trip"}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
                {selectedDriverId && driversOnActiveTrips.has(selectedDriverId) && (
                  <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                    ⚠️ This driver is already assigned to another active trip. Assigning will create a conflict.
                  </div>
                )}
              </div>
            </>
          )}

          {exceptionType === "vehicle_switch" && (
            <>
              <div>
                <Label>Current Vehicle</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {currentVehicleNumber || "No vehicle assigned"}
                </p>
              </div>
              <div>
                <Label htmlFor="new_vehicle">New Vehicle *</Label>
                <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select new vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles
                      .filter(v => v.id !== currentVehicleId)
                      .map((vehicle) => {
                        const isOnActiveTrip = vehiclesOnActiveTrips.has(vehicle.id);
                        return (
                          <SelectItem 
                            key={vehicle.id} 
                            value={vehicle.id}
                            className={isOnActiveTrip ? "text-orange-600" : ""}
                          >
                            {vehicle.vehicle_number} {vehicle.make ? `(${vehicle.make} ${vehicle.model || ''})` : ''}
                            {vehicle.tracking_asset_id && " 📍"}
                            {isOnActiveTrip && " ⚠️ On active trip"}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  📍 indicates vehicle has tracking asset (will be remapped)
                </p>
                {selectedVehicleId && vehiclesOnActiveTrips.has(selectedVehicleId) && (
                  <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                    ⚠️ This vehicle is already assigned to another active trip. Assigning will create a conflict.
                  </div>
                )}
              </div>
            </>
          )}

          {(exceptionType === "accident" || exceptionType === "breakdown") && (
            <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <p className="text-sm">
                This will put the trip <strong>on hold</strong>. You can resume the trip 
                after the issue is resolved, or assign a diverted vehicle.
              </p>
            </div>
          )}

          {exceptionType === "diverted_vehicle" && (
            <>
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm">
                  Assigning a diverted vehicle will <strong>resume the trip</strong> with 
                  the new vehicle and remap its tracking asset.
                </p>
              </div>
              <div>
                <Label>Current Vehicle</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {currentVehicleNumber || "No vehicle assigned"}
                </p>
              </div>
              <div>
                <Label htmlFor="diverted_vehicle">Diverted/Replacement Vehicle *</Label>
                <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select replacement vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles
                      .filter(v => v.id !== currentVehicleId)
                      .map((vehicle) => {
                        const isOnActiveTrip = vehiclesOnActiveTrips.has(vehicle.id);
                        return (
                          <SelectItem 
                            key={vehicle.id} 
                            value={vehicle.id}
                            className={isOnActiveTrip ? "text-orange-600" : ""}
                          >
                            {vehicle.vehicle_number} {vehicle.make ? `(${vehicle.make} ${vehicle.model || ''})` : ''}
                            {vehicle.tracking_asset_id && " 📍"}
                            {isOnActiveTrip && " ⚠️ On active trip"}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  📍 indicates vehicle has tracking asset (will be remapped)
                </p>
                {selectedVehicleId && vehiclesOnActiveTrips.has(selectedVehicleId) && (
                  <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                    ⚠️ This vehicle is already assigned to another active trip. Assigning will create a conflict.
                  </div>
                )}
              </div>
            </>
          )}

          <div>
            <Label htmlFor="reason">Reason / Notes</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide additional details about this exception..."
              rows={3}
            />
          </div>
        </div>
      </FormDialog>
    </>
  );
}
