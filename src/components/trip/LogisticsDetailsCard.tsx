import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone } from "lucide-react";

interface LogisticsDetailsCardProps {
  vehicleNumber?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  transporterName?: string | null;
  driverName?: string | null;
  driverMobile?: string | null;
}

export function LogisticsDetailsCard({
  vehicleNumber,
  vehicleMake,
  vehicleModel,
  transporterName,
  driverName,
  driverMobile,
}: LogisticsDetailsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Logistics Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Vehicle No.</span>
          <span className="font-medium">{vehicleNumber || "—"}</span>
        </div>
        {(vehicleMake || vehicleModel) && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Vehicle</span>
            <span className="font-medium">
              {[vehicleMake, vehicleModel].filter(Boolean).join(" ") || "—"}
            </span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Transporter</span>
          <span className="font-medium">{transporterName || "—"}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Driver Name</span>
          <span className="font-medium">{driverName || "—"}</span>
        </div>
        {driverMobile && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Driver No.</span>
            <a 
              href={`tel:${driverMobile}`}
              className="font-medium flex items-center gap-1 text-primary hover:underline"
            >
              {driverMobile}
              <Phone className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
