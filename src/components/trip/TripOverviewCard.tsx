import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, PackageCheck, PackageX } from "lucide-react";

interface TripOverviewCardProps {
  tripCode: string;
  status: string;
  distanceKm?: number | null;
  shipmentStatus?: 'mapped' | 'no_shipments' | 'loading';
  shipmentCount?: number;
  currentEta?: string | null;
  plannedEta?: string | null;
}

const statusColors: Record<string, string> = {
  created: "bg-muted text-muted-foreground",
  ongoing: "bg-primary text-primary-foreground",
  completed: "bg-green-500 text-white",
  cancelled: "bg-destructive text-destructive-foreground",
  on_hold: "bg-orange-500 text-white",
  closed: "bg-slate-600 text-white",
};

const statusLabels: Record<string, string> = {
  created: "Created",
  ongoing: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  on_hold: "On Hold",
  closed: "Closed",
};

const shipmentStatusConfig = {
  mapped: { 
    label: "Shipments Mapped", 
    icon: PackageCheck, 
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
  },
  no_shipments: { 
    label: "No Shipments", 
    icon: PackageX, 
    className: "bg-muted text-muted-foreground" 
  },
  loading: { 
    label: "Loading...", 
    icon: Package, 
    className: "bg-muted text-muted-foreground" 
  },
};

export function TripOverviewCard({ 
  tripCode, 
  status, 
  distanceKm, 
  shipmentStatus = 'loading',
  shipmentCount = 0,
  currentEta,
  plannedEta
}: TripOverviewCardProps) {
  const shipmentConfig = shipmentStatusConfig[shipmentStatus];
  const ShipmentIcon = shipmentConfig.icon;

  const formatEta = (eta: string | null | undefined) => {
    if (!eta) return null;
    const date = new Date(eta);
    return date.toLocaleString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Trip Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Trip No.</span>
          <span className="font-medium">{tripCode}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Status</span>
          <Badge className={statusColors[status] || "bg-muted"}>
            {statusLabels[status] || status}
          </Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Shipments</span>
          <Badge variant="outline" className={`flex items-center gap-1.5 ${shipmentConfig.className}`}>
            <ShipmentIcon className="h-3.5 w-3.5" />
            {shipmentStatus === 'mapped' ? `${shipmentCount} Mapped` : shipmentConfig.label}
          </Badge>
        </div>
        {distanceKm !== null && distanceKm !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Distance</span>
            <span className="font-medium">{distanceKm} km</span>
          </div>
        )}
        {(currentEta || plannedEta) && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {currentEta ? 'Current ETA' : 'Planned ETA'}
            </span>
            <span className="font-medium text-sm">
              {formatEta(currentEta || plannedEta)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
