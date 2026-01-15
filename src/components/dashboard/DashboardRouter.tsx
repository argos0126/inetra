import { useUserRole } from "@/hooks/useUserRole";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { AdminDashboard } from "./AdminDashboard";
import { OperationsDashboard } from "./OperationsDashboard";
import { DispatcherDashboard } from "./DispatcherDashboard";
import { ControlTowerDashboard } from "./ControlTowerDashboard";
import { FleetDashboard } from "./FleetDashboard";
import { DriverCoordinatorDashboard } from "./DriverCoordinatorDashboard";
import { TransporterDashboard } from "./TransporterDashboard";
import { ShipperAdminDashboard } from "./ShipperAdminDashboard";
import { ShipperUserDashboard } from "./ShipperUserDashboard";
import { SupportDashboard } from "./SupportDashboard";
import { BillingDashboard } from "./BillingDashboard";
import { RoutePlannerDashboard } from "./RoutePlannerDashboard";
import { DataEntryDashboard } from "./DataEntryDashboard";
import { ViewerDashboard } from "./ViewerDashboard";

export function DashboardRouter() {
  const { dashboardType, isLoading } = useUserRole();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner />
      </div>
    );
  }

  switch (dashboardType) {
    case 'admin':
      return <AdminDashboard />;
    case 'operations':
      return <OperationsDashboard />;
    case 'dispatcher':
      return <DispatcherDashboard />;
    case 'control-tower':
      return <ControlTowerDashboard />;
    case 'fleet':
      return <FleetDashboard />;
    case 'driver-coordinator':
      return <DriverCoordinatorDashboard />;
    case 'transporter':
      return <TransporterDashboard />;
    case 'shipper-admin':
      return <ShipperAdminDashboard />;
    case 'shipper-user':
      return <ShipperUserDashboard />;
    case 'support':
      return <SupportDashboard />;
    case 'billing':
      return <BillingDashboard />;
    case 'route-planner':
      return <RoutePlannerDashboard />;
    case 'data-entry':
      return <DataEntryDashboard />;
    case 'viewer':
    default:
      return <ViewerDashboard />;
  }
}
