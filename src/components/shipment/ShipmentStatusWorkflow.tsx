import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle, Circle, Package, Truck, MapPin, Home, AlertTriangle, RotateCcw, Award, Loader2 } from "lucide-react";
import { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { 
  statusConfig, 
  statusFlow, 
  allowedTransitions, 
  validateStatusTransition,
  validateMandatoryFields,
  checkTripVehicleLinkage,
  subStatusConfig
} from "@/utils/shipmentValidations";
import { updateShipmentStatus } from "@/utils/shipmentStatusLogger";
import { ShipmentSubStatusSelector } from "./ShipmentSubStatusSelector";
import { useToast } from "@/hooks/use-toast";

type ShipmentStatus = Database["public"]["Enums"]["shipment_status"];

interface ShipmentStatusWorkflowProps {
  shipment: {
    id: string;
    shipment_code: string;
    status: ShipmentStatus;
    sub_status?: string | null;
    trip: { trip_code: string; id?: string } | null;
    consignee_code?: string | null;
    material_id?: string | null;
    pickup_location_id?: string | null;
    drop_location_id?: string | null;
    is_delayed?: boolean;
    delay_percentage?: number | null;
  };
  onStatusChange: (shipmentId: string, newStatus: ShipmentStatus) => Promise<void>;
  onClose: () => void;
}

const statusIcons: Record<ShipmentStatus, React.ElementType> = {
  created: Circle,
  confirmed: CheckCircle,
  mapped: Package,
  in_pickup: MapPin,
  in_transit: Truck,
  out_for_delivery: Truck,
  delivered: Home,
  ndr: AlertTriangle,
  returned: RotateCcw,
  success: Award,
};

export function ShipmentStatusWorkflow({ shipment, onStatusChange, onClose }: ShipmentStatusWorkflowProps) {
  const [updating, setUpdating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { toast } = useToast();
  
  const currentIndex = statusFlow.indexOf(shipment.status);
  const nextStatuses = allowedTransitions[shipment.status];
  const hasSubStatuses = !!subStatusConfig[shipment.status];

  const validateTransition = async (newStatus: ShipmentStatus): Promise<{ valid: boolean; message?: string }> => {
    // Basic transition validation
    const transitionCheck = validateStatusTransition(shipment.status, newStatus);
    if (!transitionCheck.valid) {
      return transitionCheck;
    }

    // Validation: Created → Confirmed requires mandatory fields
    if (shipment.status === "created" && newStatus === "confirmed") {
      const mandatoryCheck = validateMandatoryFields(shipment);
      if (!mandatoryCheck.valid) {
        return { 
          valid: false, 
          message: `Missing required fields: ${mandatoryCheck.missingFields.join(", ")}` 
        };
      }
    }

    // Validation: Cannot move to mapped without a trip
    if (newStatus === "mapped" && !shipment.trip) {
      return { valid: false, message: "Shipment must be linked to a trip before mapping" };
    }

    // Validation: Mapped → In-Pickup requires trip-vehicle linkage
    if (shipment.status === "mapped" && newStatus === "in_pickup" && shipment.trip?.id) {
      const vehicleCheck = await checkTripVehicleLinkage(shipment.trip.id);
      if (!vehicleCheck.valid) {
        return vehicleCheck;
      }
    }

    // Validation: Delivered → Success requires all POD sub-statuses completed
    if (shipment.status === "delivered" && newStatus === "success") {
      if (shipment.sub_status !== "paid") {
        return { 
          valid: false, 
          message: "All POD sub-statuses (POD Cleaned, Billed, Paid) must be completed before Success" 
        };
      }
    }

    return { valid: true };
  };

  const handleStatusUpdate = async (newStatus: ShipmentStatus) => {
    setValidationError(null);
    setUpdating(true);

    try {
      // Run validations
      const validation = await validateTransition(newStatus);
      if (!validation.valid) {
        setValidationError(validation.message || "Invalid transition");
        toast({
          title: "Validation Failed",
          description: validation.message,
          variant: "destructive",
        });
        return;
      }

      // Use the status logger to update with history
      const result = await updateShipmentStatus(
        shipment.id,
        shipment.status,
        newStatus,
        shipment.sub_status,
        null // Reset sub-status when changing main status
      );

      if (result.success) {
        await onStatusChange(shipment.id, newStatus);
        toast({
          title: "Status Updated",
          description: `Shipment moved to ${statusConfig[newStatus].label}`,
        });
      } else {
        toast({
          title: "Update Failed",
          description: result.error,
          variant: "destructive",
        });
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleSubStatusUpdate = () => {
    // Refresh parent data
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Shipment Status Workflow</DialogTitle>
          <DialogDescription className="flex items-center gap-2 flex-wrap">
            {shipment.shipment_code} - Current status: 
            <Badge className={statusConfig[shipment.status].bgColor + " " + statusConfig[shipment.status].color}>
              {statusConfig[shipment.status].label}
            </Badge>
            {shipment.sub_status && subStatusConfig[shipment.status] && (
              <Badge variant="outline">
                {subStatusConfig[shipment.status].labels[shipment.sub_status]}
              </Badge>
            )}
            {shipment.is_delayed && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="w-3 h-3" />
                Delayed {shipment.delay_percentage ? `(${shipment.delay_percentage.toFixed(1)}%)` : ""}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Visual Timeline */}
        <div className="py-6">
          <div className="flex items-center justify-between overflow-x-auto pb-4">
            {statusFlow.map((status, index) => {
              const config = statusConfig[status];
              const StatusIcon = statusIcons[status];
              const isActive = status === shipment.status;
              const isPast = currentIndex > index;
              const isFuture = currentIndex < index;

              return (
                <div key={status} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                        isActive && "ring-2 ring-offset-2 ring-primary",
                        isPast ? config.bgColor : isFuture ? "bg-muted" : config.bgColor
                      )}
                    >
                      <StatusIcon className={cn("w-5 h-5", isPast || isActive ? config.color : "text-muted-foreground")} />
                    </div>
                    <span className={cn(
                      "text-xs mt-2 text-center whitespace-nowrap",
                      isActive ? "font-semibold text-foreground" : "text-muted-foreground"
                    )}>
                      {config.label}
                    </span>
                  </div>
                  {index < statusFlow.length - 1 && (
                    <ArrowRight className={cn(
                      "w-6 h-6 mx-2 flex-shrink-0",
                      isPast ? "text-primary" : "text-muted-foreground"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sub-Status Selector (if applicable) */}
        {hasSubStatuses && (
          <ShipmentSubStatusSelector
            shipmentId={shipment.id}
            status={shipment.status}
            currentSubStatus={shipment.sub_status || null}
            onUpdate={handleSubStatusUpdate}
          />
        )}

        {/* Exception Status (NDR/Returned) */}
        {(shipment.status === "ndr" || shipment.status === "returned") && (
          <div className="flex items-center gap-4 p-4 bg-destructive/10 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Exception Status</p>
              <p className="text-sm text-muted-foreground">
                This shipment is in {statusConfig[shipment.status].label} status.
              </p>
            </div>
          </div>
        )}

        {/* Validation Error */}
        {validationError && (
          <div className="flex items-center gap-4 p-4 bg-destructive/10 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Validation Error</p>
              <p className="text-sm text-muted-foreground">{validationError}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-4">
          <h4 className="font-medium">Available Actions</h4>
          
          {nextStatuses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No further status transitions available. Shipment is in final status.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {nextStatuses.map((status) => {
                const config = statusConfig[status];
                const StatusIcon = statusIcons[status];
                const isDisabled = status === "mapped" && !shipment.trip;
                const isSuccessDisabled = status === "success" && shipment.sub_status !== "paid";
                
                return (
                  <Button
                    key={status}
                    variant="outline"
                    disabled={updating || isDisabled || isSuccessDisabled}
                    onClick={() => handleStatusUpdate(status)}
                    className={cn("gap-2", config.color)}
                  >
                    {updating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <StatusIcon className="w-4 h-4" />
                    )}
                    Move to {config.label}
                    {isDisabled && " (Requires Trip)"}
                    {isSuccessDisabled && " (Complete POD first)"}
                  </Button>
                );
              })}
            </div>
          )}
        </div>

        {/* Trip Info */}
        {shipment.trip && (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm">
              <span className="text-muted-foreground">Mapped to Trip:</span>{" "}
              <span className="font-medium">{shipment.trip.trip_code}</span>
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
