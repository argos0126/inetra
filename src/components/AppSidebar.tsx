import { useState } from "react";
import { 
  Truck, 
  MapPin, 
  Users, 
  User, 
  Radio, 
  UserCog, 
  Route,
  ChevronDown,
  ChevronRight,
  FileText,
  Settings,
  Home,
  Building2,
  TruckIcon,
  Package,
  ArrowRightLeft,
  MessageSquare,
  AlertTriangle,
  Bell,
  Shield,
  ShieldCheck,
  LucideIcon
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import tmsLogo from "@/assets/tms-logo.png";
import { usePermissions, PermissionResource, PermissionAction } from "@/contexts/PermissionContext";
import { useUserRole } from "@/hooks/useUserRole";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  resource?: PermissionResource;
  action?: PermissionAction;
  alwaysVisible?: boolean;
  hideForRoles?: string[];
  superadminOnly?: boolean;
}

const mainItems: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: Home, alwaysVisible: true },
];

const masterItems: NavItem[] = [
  { title: "Customers", url: "/customers", icon: Building2, resource: "customers", action: "view" },
  { title: "Transporters", url: "/transporters", icon: TruckIcon, resource: "transporters", action: "view", hideForRoles: ["Transporter Admin"] },
  { title: "Vehicle Types", url: "/vehicle-types", icon: Truck, resource: "vehicles", action: "view" },
  { title: "Vehicles", url: "/vehicle-master", icon: Truck, resource: "vehicles", action: "view" },
  { title: "Drivers", url: "/driver", icon: User, resource: "drivers", action: "view" },
  { title: "Locations", url: "/locations", icon: MapPin, resource: "locations", action: "view" },
  { title: "Lanes", url: "/lanes", icon: ArrowRightLeft, resource: "lanes", action: "view" },
  { title: "Materials", url: "/materials", icon: Package, resource: "materials", action: "view" },
  { title: "Tracking Assets", url: "/tracking-asset", icon: Radio, resource: "tracking_assets", action: "view" },
  { title: "Users", url: "/users", icon: UserCog, resource: "users", action: "view" },
  { title: "Roles & Permissions", url: "/roles", icon: Shield, resource: "roles", action: "view" },
];

const tripItems: NavItem[] = [
  { title: "Shipments", url: "/shipments", icon: Package, resource: "shipments", action: "view" },
  { title: "Trips", url: "/trips", icon: Route, resource: "trips", action: "view" },
  { title: "Alerts", url: "/alerts", icon: Bell, resource: "alerts", action: "view" },
  { title: "Exceptions", url: "/exceptions", icon: AlertTriangle, resource: "exceptions", action: "view" },
  { title: "Driver Consents", url: "/driver-consents", icon: MessageSquare, resource: "consents", action: "view" },
];

const reportItems: NavItem[] = [
  { title: "Reports", url: "/reports", icon: FileText, resource: "reports", action: "view" },
];

const systemItems: NavItem[] = [
  { title: "Settings", url: "/settings", icon: Settings, resource: "settings", action: "view" },
  { title: "Profile", url: "/profile", icon: User, alwaysVisible: true },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { hasPermission, isSuperAdmin, loading } = usePermissions();
  const { roleName } = useUserRole();
  
  const [masterOpen, setMasterOpen] = useState(true);
  const isCollapsed = state === "collapsed";

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium" 
      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

  // Filter items based on permissions and role restrictions
  const filterItems = (items: NavItem[]): NavItem[] => {
    if (loading) return [];
    
    return items.filter(item => {
      // Check if this item should be hidden for the current role
      if (item.hideForRoles && roleName && item.hideForRoles.includes(roleName)) {
        return false;
      }
      
      // Handle superadmin-only items
      if (item.superadminOnly) {
        return isSuperAdmin;
      }
      
      if (isSuperAdmin) return true;
      if (item.alwaysVisible) return true;
      if (!item.resource || !item.action) return true;
      return hasPermission(item.resource, item.action);
    });
  };

  const visibleMainItems = filterItems(mainItems);
  const visibleMasterItems = filterItems(masterItems);
  const visibleTripItems = filterItems(tripItems);
  const visibleReportItems = filterItems(reportItems);
  const visibleSystemItems = filterItems(systemItems);

  return (
    <Sidebar
      className="bg-sidebar-background border-sidebar-border"
      collapsible="icon"
    >
      <SidebarContent className="bg-sidebar-background">
        {/* Logo */}
        <div className="flex items-center gap-2 p-4 border-b border-sidebar-border">
          <img src={tmsLogo} alt="TMS Logo" className="h-8 w-auto" />
          {!isCollapsed && (
            <span className="text-sidebar-foreground font-semibold text-lg">TripMS</span>
          )}
        </div>

        {/* Main Navigation */}
        {visibleMainItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleMainItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={getNavCls}>
                        <item.icon className="h-4 w-4" />
                        {!isCollapsed && <span className="ml-2">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Masters Section */}
        {visibleMasterItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel 
              className="flex items-center justify-between text-sidebar-foreground hover:text-sidebar-accent-foreground cursor-pointer"
              onClick={() => setMasterOpen(!masterOpen)}
            >
              <span>Masters</span>
              {!isCollapsed && (
                masterOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )
              )}
            </SidebarGroupLabel>

            {masterOpen && (
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleMasterItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} className={getNavCls}>
                          <item.icon className="h-4 w-4" />
                          {!isCollapsed && <span className="ml-2">{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>
        )}

        {/* Trips Section */}
        {visibleTripItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleTripItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={getNavCls}>
                        <item.icon className="h-4 w-4" />
                        {!isCollapsed && <span className="ml-2">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Reports Section */}
        {visibleReportItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleReportItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={getNavCls}>
                        <item.icon className="h-4 w-4" />
                        {!isCollapsed && <span className="ml-2">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* System Section */}
        {visibleSystemItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleSystemItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={getNavCls}>
                        <item.icon className="h-4 w-4" />
                        {!isCollapsed && <span className="ml-2">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
