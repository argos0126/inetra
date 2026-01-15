import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Circle } from "lucide-react";

interface TrackingStatusCardProps {
  hasGpsTracking?: boolean;
  hasSimTracking?: boolean;
  consentStatus?: string | null;
}

export function TrackingStatusCard({
  hasGpsTracking = false,
  hasSimTracking = false,
  consentStatus,
}: TrackingStatusCardProps) {
  const StatusIcon = ({ active }: { active: boolean }) =>
    active ? (
      <CheckCircle2 className="h-5 w-5 text-green-500" />
    ) : (
      <XCircle className="h-5 w-5 text-muted-foreground" />
    );

  const consentGranted = consentStatus === "allowed" || consentStatus === "granted";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Tracking Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">GPS Tracked</span>
          <StatusIcon active={hasGpsTracking} />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">SIM Tracked</span>
          <StatusIcon active={hasSimTracking} />
        </div>
        {hasSimTracking && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Consent Available</span>
            <StatusIcon active={consentGranted} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
