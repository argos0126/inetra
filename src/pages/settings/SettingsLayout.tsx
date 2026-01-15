import { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/contexts/PermissionContext";
import {
  Database,
  Bell,
  Shield,
  Globe,
  Key,
  Save,
  RefreshCw,
} from "lucide-react";

interface SettingsLayoutProps {
  children: ReactNode;
  title: string;
  description: string;
  onSave: () => void;
  onReset: () => void;
  saving?: boolean;
}

const settingsNavItems = [
  {
    title: "Trip Settings",
    url: "/settings/trips",
    icon: Database,
  },
  {
    title: "Notifications",
    url: "/settings/notifications",
    icon: Bell,
  },
  {
    title: "Security",
    url: "/settings/security",
    icon: Shield,
  },
  {
    title: "System",
    url: "/settings/system",
    icon: Globe,
  },
  {
    title: "Integrations",
    url: "/settings/integrations",
    icon: Key,
    superAdminOnly: true,
  },
];

export const SettingsLayout = ({
  children,
  title,
  description,
  onSave,
  onReset,
  saving = false,
}: SettingsLayoutProps) => {
  const { isSuperAdmin } = usePermissions();
  const location = useLocation();

  const filteredNavItems = settingsNavItems.filter(
    (item) => !item.superAdminOnly || isSuperAdmin
  );

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">
              Manage your system preferences and configurations
            </p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onReset}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button onClick={onSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Settings Navigation Sidebar */}
          <div className="w-64 shrink-0">
            <nav className="flex flex-col space-y-1">
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.url;

                return (
                  <NavLink
                    key={item.url}
                    to={item.url}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.title}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Settings Content */}
          <div className="flex-1 min-w-0">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            {children}
          </div>
        </div>
      </div>
    </Layout>
  );
};
