import { useState, useEffect } from "react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle, XCircle, AlertTriangle, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ShipmentStatus {
  id: string;
  shipment_code: string;
  status: string;
  pod_collected: boolean;
}

// Terminal statuses that indicate shipment is finalized
const TERMINAL_STATUSES = ['delivered', 'returned', 'success', 'ndr'];

interface TripClosureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  tripCode: string;
  onClosed: () => void;
}

export function TripClosureDialog({
  open,
  onOpenChange,
  tripId,
  tripCode,
  onClosed,
}: TripClosureDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [closureNotes, setClosureNotes] = useState("");
  const [shipments, setShipments] = useState<ShipmentStatus[]>([]);
  const [validationResult, setValidationResult] = useState<{
    canClose: boolean;
    issues: string[];
    warnings: string[];
  } | null>(null);

  // Validate shipments when dialog opens
  useEffect(() => {
    if (open) {
      validateShipments();
    }
  }, [open, tripId]);

  const validateShipments = async () => {
    setValidating(true);
    try {
      const { data, error } = await supabase
        .from("shipments")
        .select("id, shipment_code, status, pod_collected")
        .eq("trip_id", tripId);

      if (error) throw error;

      const shipmentList = data || [];
      setShipments(shipmentList);

      const issues: string[] = [];
      const warnings: string[] = [];

      // Check for non-terminal shipments
      const nonTerminalShipments = shipmentList.filter(
        (s) => !TERMINAL_STATUSES.includes(s.status)
      );

      if (nonTerminalShipments.length > 0) {
        issues.push(
          `${nonTerminalShipments.length} shipment(s) are not in terminal status: ${nonTerminalShipments
            .map((s) => s.shipment_code)
            .join(", ")}`
        );
      }

      // Check for missing POD (warning only)
      const missingPodShipments = shipmentList.filter(
        (s) => s.status === "delivered" && !s.pod_collected
      );

      if (missingPodShipments.length > 0) {
        warnings.push(
          `${missingPodShipments.length} delivered shipment(s) without POD collected`
        );
      }

      // No shipments at all is a warning (trip might be empty)
      if (shipmentList.length === 0) {
        warnings.push("No shipments are mapped to this trip");
      }

      setValidationResult({
        canClose: issues.length === 0,
        issues,
        warnings,
      });
    } catch (error: any) {
      toast({
        title: "Validation Error",
        description: error.message,
        variant: "destructive",
      });
      setValidationResult({
        canClose: false,
        issues: ["Failed to validate shipments"],
        warnings: [],
      });
    } finally {
      setValidating(false);
    }
  };

  const handleClose = async () => {
    if (!validationResult?.canClose) return;

    setLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Get user profile for closed_by
      let closedBy: string | null = null;
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        closedBy = profile?.id || null;
      }

      // Update trip status to closed
      const { error } = await supabase
        .from("trips")
        .update({
          status: "closed",
          closure_notes: closureNotes.trim() || null,
          closed_at: new Date().toISOString(),
          closed_by: closedBy,
        })
        .eq("id", tripId);

      if (error) throw error;

      // Log the closure in audit logs
      await supabase.from("trip_audit_logs").insert({
        trip_id: tripId,
        previous_status: "completed",
        new_status: "closed",
        changed_by: closedBy,
        change_reason: closureNotes.trim() || "Trip closed after completion",
        metadata: {
          shipment_count: shipments.length,
          closure_time: new Date().toISOString(),
        },
      });

      toast({
        title: "Trip Closed",
        description: `${tripCode} has been closed successfully.`,
      });

      onClosed();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error closing trip",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
    if (TERMINAL_STATUSES.includes(status)) return "default";
    return "outline";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Close Trip
          </DialogTitle>
          <DialogDescription>
            Review and close trip <strong>{tripCode}</strong>. This action
            finalizes the trip for archival and reporting.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Validation Loading */}
          {validating && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Validating shipments...</span>
            </div>
          )}

          {/* Validation Results */}
          {!validating && validationResult && (
            <>
              {/* Issues (Blocking) */}
              {validationResult.issues.length > 0 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Cannot Close Trip</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      {validationResult.issues.map((issue, idx) => (
                        <li key={idx}>{issue}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Warnings (Non-blocking) */}
              {validationResult.warnings.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Warnings</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      {validationResult.warnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Success - Can Close */}
              {validationResult.canClose && validationResult.issues.length === 0 && (
                <Alert className="border-green-500/50 bg-green-500/10">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-600">Ready to Close</AlertTitle>
                  <AlertDescription>
                    All {shipments.length} shipment(s) are in terminal status.
                  </AlertDescription>
                </Alert>
              )}

              {/* Shipment Summary */}
              {shipments.length > 0 && (
                <div className="border rounded-lg p-3 space-y-2">
                  <div className="text-sm font-medium">Shipment Summary</div>
                  <div className="flex flex-wrap gap-2">
                    {shipments.map((shipment) => (
                      <div
                        key={shipment.id}
                        className="flex items-center gap-1 text-xs"
                      >
                        <span className="font-mono">{shipment.shipment_code}</span>
                        <Badge
                          variant={getStatusBadgeVariant(shipment.status)}
                          className="text-xs"
                        >
                          {shipment.status.replace("_", " ")}
                        </Badge>
                        {shipment.status === "delivered" && (
                          <Badge
                            variant={shipment.pod_collected ? "default" : "outline"}
                            className={`text-xs ${
                              shipment.pod_collected
                                ? "bg-green-600"
                                : "text-orange-600 border-orange-400"
                            }`}
                          >
                            {shipment.pod_collected ? "POD ✓" : "POD ✗"}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Closure Notes */}
              <div className="space-y-2">
                <Label htmlFor="closure_notes">Closure Notes (Optional)</Label>
                <Textarea
                  id="closure_notes"
                  placeholder="Add any notes about this trip closure..."
                  value={closureNotes}
                  onChange={(e) => setClosureNotes(e.target.value)}
                  rows={3}
                  disabled={!validationResult.canClose}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleClose}
            disabled={loading || validating || !validationResult?.canClose}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Closing...
              </>
            ) : (
              <>
                <Lock className="mr-2 h-4 w-4" />
                Close Trip
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
