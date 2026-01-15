import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { useTelenityTracking } from "@/hooks/useTelenityTracking";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface ConsentRequestButtonProps {
  driverId: string;
  driverName: string;
  driverMobile: string;
  tripId?: string;
  currentStatus?: string;
  entityId?: string;
  consentId?: string;
  onConsentUpdated?: () => void;
}

const statusConfig = {
  pending: { icon: Clock, variant: "secondary" as const, label: "Pending" },
  allowed: { icon: CheckCircle, variant: "default" as const, label: "Allowed" },
  not_allowed: { icon: XCircle, variant: "destructive" as const, label: "Denied" },
  expired: { icon: XCircle, variant: "outline" as const, label: "Expired" },
};

export function ConsentRequestButton({
  driverId,
  driverName,
  driverMobile,
  tripId,
  currentStatus,
  entityId,
  consentId,
  onConsentUpdated,
}: ConsentRequestButtonProps) {
  const [open, setOpen] = useState(false);
  const { loading, importDriver, checkConsent } = useTelenityTracking();

  const handleRequestConsent = async () => {
    try {
      await importDriver({
        msisdn: driverMobile,
        driverName,
        driverId,
        tripId,
      });
      onConsentUpdated?.();
      setOpen(false);
    } catch {
      // Error handled in hook
    }
  };

  const handleCheckStatus = async () => {
    if (!entityId) return;
    try {
      // Pass the actual msisdn (driverMobile), not entityId
      await checkConsent(driverMobile, consentId, entityId);
      onConsentUpdated?.();
    } catch {
      // Error handled in hook
    }
  };

  const config = currentStatus ? statusConfig[currentStatus as keyof typeof statusConfig] : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <MessageSquare className="h-4 w-4" />
          {config ? (
            <>
              <config.icon className="h-3 w-3" />
              {config.label}
            </>
          ) : (
            "Request Consent"
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>SIM Tracking Consent</DialogTitle>
          <DialogDescription>
            Request location tracking consent from the driver via SMS.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Driver</span>
              <span className="font-medium">{driverName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mobile</span>
              <span className="font-medium">{driverMobile}</span>
            </div>
            {currentStatus && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={config?.variant}>{config?.label}</Badge>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            {entityId && (
              <Button variant="outline" onClick={handleCheckStatus} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Check Status
              </Button>
            )}
            <Button onClick={handleRequestConsent} disabled={loading || currentStatus === "allowed"}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {currentStatus ? "Resend SMS" : "Send Consent SMS"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
