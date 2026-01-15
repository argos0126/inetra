import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PermissionProvider } from "@/contexts/PermissionContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import VehicleMaster from "./pages/VehicleMaster";
import Locations from "./pages/Locations";
import Drivers from "./pages/Drivers";
import TrackingAssets from "./pages/TrackingAssets";
import Users from "./pages/Users";
import Roles from "./pages/Roles";
import RoleAdd from "./pages/roles/RoleAdd";
import RoleView from "./pages/roles/RoleView";
import RoleEdit from "./pages/roles/RoleEdit";
import UserView from "./pages/users/UserView";
import UserAdd from "./pages/users/UserAdd";
import UserEdit from "./pages/users/UserEdit";
import Trips from "./pages/Trips";
import TripDetails from "./pages/TripDetails";
import Dashboard from "./pages/Dashboard";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import TripSettings from "./pages/settings/TripSettings";
import NotificationSettings from "./pages/settings/NotificationSettings";
import SecuritySettings from "./pages/settings/SecuritySettings";
import SystemSettings from "./pages/settings/SystemSettings";
import IntegrationSettings from "./pages/settings/IntegrationSettings";
import Profile from "./pages/Profile";
import Customers from "./pages/Customers";
import Transporters from "./pages/Transporters";
import VehicleTypes from "./pages/VehicleTypes";
import Materials from "./pages/Materials";
import ServiceabilityLanes from "./pages/ServiceabilityLanes";
import DriverConsents from "./pages/DriverConsents";
import TripExceptions from "./pages/TripExceptions";
import AlertDashboard from "./pages/AlertDashboard";
import Shipments from "./pages/Shipments";
import AdminManagement from "./pages/AdminManagement";
import AdminRecovery from "./pages/AdminRecovery";
import ShipmentAdd from "./pages/shipments/ShipmentAdd";
import ShipmentView from "./pages/shipments/ShipmentView";
import ShipmentEdit from "./pages/shipments/ShipmentEdit";

// CRUD Pages
import TransporterAdd from "./pages/transporters/TransporterAdd";
import TransporterView from "./pages/transporters/TransporterView";
import TransporterEdit from "./pages/transporters/TransporterEdit";
import CustomerAdd from "./pages/customers/CustomerAdd";
import CustomerView from "./pages/customers/CustomerView";
import CustomerEdit from "./pages/customers/CustomerEdit";
import VehicleAdd from "./pages/vehicles/VehicleAdd";
import VehicleView from "./pages/vehicles/VehicleView";
import VehicleEdit from "./pages/vehicles/VehicleEdit";
import DriverAdd from "./pages/drivers/DriverAdd";
import DriverView from "./pages/drivers/DriverView";
import DriverEdit from "./pages/drivers/DriverEdit";
import LocationAdd from "./pages/locations/LocationAdd";
import LocationView from "./pages/locations/LocationView";
import LocationEdit from "./pages/locations/LocationEdit";
import TrackingAssetAdd from "./pages/tracking-assets/TrackingAssetAdd";
import TrackingAssetView from "./pages/tracking-assets/TrackingAssetView";
import TrackingAssetEdit from "./pages/tracking-assets/TrackingAssetEdit";
import VehicleTypeAdd from "./pages/vehicle-types/VehicleTypeAdd";
import VehicleTypeView from "./pages/vehicle-types/VehicleTypeView";
import VehicleTypeEdit from "./pages/vehicle-types/VehicleTypeEdit";
import MaterialAdd from "./pages/materials/MaterialAdd";
import MaterialView from "./pages/materials/MaterialView";
import MaterialEdit from "./pages/materials/MaterialEdit";
import ServiceabilityLaneAdd from "./pages/serviceability-lanes/ServiceabilityLaneAdd";
import ServiceabilityLaneView from "./pages/serviceability-lanes/ServiceabilityLaneView";
import ServiceabilityLaneEdit from "./pages/serviceability-lanes/ServiceabilityLaneEdit";
import TripAdd from "./pages/trips/TripAdd";
import TripEdit from "./pages/trips/TripEdit";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <AuthProvider>
          <PermissionProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/admin-recovery" element={<AdminRecovery />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            
            {/* Customers */}
            <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
            <Route path="/customers/add" element={<ProtectedRoute><CustomerAdd /></ProtectedRoute>} />
            <Route path="/customers/:id" element={<ProtectedRoute><CustomerView /></ProtectedRoute>} />
            <Route path="/customers/:id/edit" element={<ProtectedRoute><CustomerEdit /></ProtectedRoute>} />
            
            {/* Transporters */}
            <Route path="/transporters" element={<ProtectedRoute><Transporters /></ProtectedRoute>} />
            <Route path="/transporters/add" element={<ProtectedRoute><TransporterAdd /></ProtectedRoute>} />
            <Route path="/transporters/:id" element={<ProtectedRoute><TransporterView /></ProtectedRoute>} />
            <Route path="/transporters/:id/edit" element={<ProtectedRoute><TransporterEdit /></ProtectedRoute>} />
            
            {/* Vehicles */}
            <Route path="/vehicles" element={<ProtectedRoute><VehicleMaster /></ProtectedRoute>} />
            <Route path="/vehicles/add" element={<ProtectedRoute><VehicleAdd /></ProtectedRoute>} />
            <Route path="/vehicles/:id" element={<ProtectedRoute><VehicleView /></ProtectedRoute>} />
            <Route path="/vehicles/:id/edit" element={<ProtectedRoute><VehicleEdit /></ProtectedRoute>} />
            
            {/* Drivers */}
            <Route path="/drivers" element={<ProtectedRoute><Drivers /></ProtectedRoute>} />
            <Route path="/drivers/add" element={<ProtectedRoute><DriverAdd /></ProtectedRoute>} />
            <Route path="/drivers/:id" element={<ProtectedRoute><DriverView /></ProtectedRoute>} />
            <Route path="/drivers/:id/edit" element={<ProtectedRoute><DriverEdit /></ProtectedRoute>} />
            
            {/* Locations */}
            <Route path="/locations" element={<ProtectedRoute><Locations /></ProtectedRoute>} />
            <Route path="/locations/add" element={<ProtectedRoute><LocationAdd /></ProtectedRoute>} />
            <Route path="/locations/:id" element={<ProtectedRoute><LocationView /></ProtectedRoute>} />
            <Route path="/locations/:id/edit" element={<ProtectedRoute><LocationEdit /></ProtectedRoute>} />
            
            {/* Tracking Assets */}
            <Route path="/tracking-assets" element={<ProtectedRoute><TrackingAssets /></ProtectedRoute>} />
            <Route path="/tracking-assets/add" element={<ProtectedRoute><TrackingAssetAdd /></ProtectedRoute>} />
            <Route path="/tracking-assets/:id" element={<ProtectedRoute><TrackingAssetView /></ProtectedRoute>} />
            <Route path="/tracking-assets/:id/edit" element={<ProtectedRoute><TrackingAssetEdit /></ProtectedRoute>} />
            
            {/* Vehicle Types */}
            <Route path="/vehicle-types" element={<ProtectedRoute><VehicleTypes /></ProtectedRoute>} />
            <Route path="/vehicle-types/add" element={<ProtectedRoute><VehicleTypeAdd /></ProtectedRoute>} />
            <Route path="/vehicle-types/:id" element={<ProtectedRoute><VehicleTypeView /></ProtectedRoute>} />
            <Route path="/vehicle-types/:id/edit" element={<ProtectedRoute><VehicleTypeEdit /></ProtectedRoute>} />
            
            {/* Materials */}
            <Route path="/materials" element={<ProtectedRoute><Materials /></ProtectedRoute>} />
            <Route path="/materials/add" element={<ProtectedRoute><MaterialAdd /></ProtectedRoute>} />
            <Route path="/materials/:id" element={<ProtectedRoute><MaterialView /></ProtectedRoute>} />
            <Route path="/materials/:id/edit" element={<ProtectedRoute><MaterialEdit /></ProtectedRoute>} />
            
            {/* Serviceability Lanes */}
            <Route path="/serviceability-lanes" element={<ProtectedRoute><ServiceabilityLanes /></ProtectedRoute>} />
            <Route path="/serviceability-lanes/add" element={<ProtectedRoute><ServiceabilityLaneAdd /></ProtectedRoute>} />
            <Route path="/serviceability-lanes/:id" element={<ProtectedRoute><ServiceabilityLaneView /></ProtectedRoute>} />
            <Route path="/serviceability-lanes/:id/edit" element={<ProtectedRoute><ServiceabilityLaneEdit /></ProtectedRoute>} />
            
            {/* Legacy routes */}
            <Route path="/vehicle-master" element={<ProtectedRoute><VehicleMaster /></ProtectedRoute>} />
            <Route path="/lanes" element={<ProtectedRoute><ServiceabilityLanes /></ProtectedRoute>} />
            <Route path="/driver" element={<ProtectedRoute><Drivers /></ProtectedRoute>} />
            <Route path="/tracking-asset" element={<ProtectedRoute><TrackingAssets /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
            <Route path="/users/add" element={<ProtectedRoute><UserAdd /></ProtectedRoute>} />
            <Route path="/users/:id" element={<ProtectedRoute><UserView /></ProtectedRoute>} />
            <Route path="/users/:id/edit" element={<ProtectedRoute><UserEdit /></ProtectedRoute>} />
            
            {/* Roles */}
            <Route path="/roles" element={<ProtectedRoute><Roles /></ProtectedRoute>} />
            <Route path="/roles/add" element={<ProtectedRoute><RoleAdd /></ProtectedRoute>} />
            <Route path="/roles/:id" element={<ProtectedRoute><RoleView /></ProtectedRoute>} />
            <Route path="/roles/:id/edit" element={<ProtectedRoute><RoleEdit /></ProtectedRoute>} />
            
            {/* Driver Consents */}
            <Route path="/driver-consents" element={<ProtectedRoute><DriverConsents /></ProtectedRoute>} />
            
            {/* Trip Exceptions */}
            <Route path="/exceptions" element={<ProtectedRoute><TripExceptions /></ProtectedRoute>} />
            
            {/* Alert Dashboard */}
            <Route path="/alerts" element={<ProtectedRoute><AlertDashboard /></ProtectedRoute>} />
            
            {/* Trips */}
            <Route path="/trips" element={<ProtectedRoute><Trips /></ProtectedRoute>} />
            <Route path="/trips/add" element={<ProtectedRoute><TripAdd /></ProtectedRoute>} />
            <Route path="/trips/:id" element={<ProtectedRoute><TripDetails /></ProtectedRoute>} />
            <Route path="/trips/:id/edit" element={<ProtectedRoute><TripEdit /></ProtectedRoute>} />
            
            {/* Shipments */}
            <Route path="/shipments" element={<ProtectedRoute><Shipments /></ProtectedRoute>} />
            <Route path="/shipments/add" element={<ProtectedRoute><ShipmentAdd /></ProtectedRoute>} />
            <Route path="/shipments/:id" element={<ProtectedRoute><ShipmentView /></ProtectedRoute>} />
            <Route path="/shipments/:id/edit" element={<ProtectedRoute><ShipmentEdit /></ProtectedRoute>} />
            
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            
            {/* Settings */}
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/settings/trips" element={<ProtectedRoute><TripSettings /></ProtectedRoute>} />
            <Route path="/settings/notifications" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
            <Route path="/settings/security" element={<ProtectedRoute><SecuritySettings /></ProtectedRoute>} />
            <Route path="/settings/system" element={<ProtectedRoute><SystemSettings /></ProtectedRoute>} />
            <Route path="/settings/integrations" element={<ProtectedRoute><IntegrationSettings /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            
            {/* Admin Management */}
            <Route path="/admin-management" element={<ProtectedRoute><AdminManagement /></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
          </PermissionProvider>
        </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
