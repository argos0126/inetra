import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Circle, Loader2, Truck, Package, FileCheck, Receipt, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { ShipmentStatus, subStatusConfig, validateSubStatusProgression } from "@/utils/shipmentValidations";
import { updateShipmentSubStatus } from "@/utils/shipmentStatusLogger";
import { useToast } from "@/hooks/use-toast";

interface ShipmentSubStatusSelectorProps {
  shipmentId: string;
  status: ShipmentStatus;
  currentSubStatus: string | null;
  onUpdate: () => void;
}

const subStatusIcons: Record<string, React.ElementType> = {
  vehicle_placed: Truck,
  loading_started: Package,
  loading_completed: Package,
  ready_for_dispatch: CheckCircle,
  on_time: CheckCircle,
  delayed: Circle,
  pod_pending: FileCheck,
  pod_cleaned: FileCheck,
  billed: Receipt,
  paid: CreditCard,
};

export function ShipmentSubStatusSelector({
  shipmentId,
  status,
  currentSubStatus,
  onUpdate,
}: ShipmentSubStatusSelectorProps) {
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  const config = subStatusConfig[status];

  if (!config) {
    return null; // No sub-statuses for this status
  }

  const currentIndex = currentSubStatus ? config.statuses.indexOf(currentSubStatus) : -1;

  const handleSubStatusChange = async (newSubStatus: string) => {
    // Validate progression
    const validation = validateSubStatusProgression(status, currentSubStatus, newSubStatus);
    if (!validation.valid) {
      toast({
        title: "Invalid transition",
        description: validation.message,
        variant: "destructive",
      });
      return;
    }

    setUpdating(newSubStatus);

    try {
      const result = await updateShipmentSubStatus(
        shipmentId,
        status,
        currentSubStatus,
        newSubStatus
      );

      if (result.success) {
        toast({
          title: "Sub-status updated",
          description: `Updated to ${config.labels[newSubStatus]}`,
        });
        onUpdate();
      } else {
        toast({
          title: "Update failed",
          description: result.error,
          variant: "destructive",
        });
      }
    } finally {
      setUpdating(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          {status === "in_pickup" && "Pickup Progress"}
          {status === "in_transit" && "Transit Status"}
          {status === "delivered" && "POD & Billing Progress"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {config.statuses.map((subStatus, index) => {
            const Icon = subStatusIcons[subStatus] || Circle;
            const isCompleted = index <= currentIndex;
            const isCurrent = subStatus === currentSubStatus;
            const isNext = index === currentIndex + 1;
            const isLoading = updating === subStatus;

            return (
              <Button
                key={subStatus}
                variant={isCompleted ? "default" : "outline"}
                size="sm"
                disabled={!isNext || updating !== null}
                onClick={() => handleSubStatusChange(subStatus)}
                className={cn(
                  "gap-2 transition-all",
                  isCurrent && "ring-2 ring-primary ring-offset-2",
                  isCompleted && "bg-green-600 hover:bg-green-700",
                  isNext && "border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                )}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isCompleted ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
                {config.labels[subStatus]}
              </Button>
            );
          })}
        </div>

        {/* Progress indicator */}
        <div className="mt-4 flex items-center gap-1">
          {config.statuses.map((subStatus, index) => {
            const isCompleted = index <= currentIndex;
            return (
              <div
                key={subStatus}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  isCompleted ? "bg-green-500" : "bg-muted"
                )}
              />
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground text-center">
          {currentIndex + 1} of {config.statuses.length} completed
        </p>
      </CardContent>
    </Card>
  );
}
