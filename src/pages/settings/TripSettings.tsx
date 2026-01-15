import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SettingsLayout } from "./SettingsLayout";
import { useSettings } from "@/hooks/useSettings";
import { MapPin, Play, FileWarning } from "lucide-react";

const TripSettings = () => {
  const {
    settings,
    loading,
    saving,
    handleSettingChange,
    handleSwitchChange,
    saveSettings,
    resetSettings,
  } = useSettings();

  const tripSettingKeys = [
    "autoAssignDrivers",
    "requireTripApproval",
    "defaultTripDurationHours",
    "vehicleProximityRadiusKm",
    "originGeofenceRadiusKm",
    "destinationGeofenceRadiusKm",
    "geofence_auto_start_enabled",
    "compliance_warning_days",
    "compliance_critical_days",
  ] as const;

  const handleSave = () => saveSettings([...tripSettingKeys]);
  const handleReset = () => resetSettings([...tripSettingKeys]);

  if (loading) {
    return (
      <SettingsLayout
        title="Trip Management"
        description="Configure trip creation and management settings"
        onSave={handleSave}
        onReset={handleReset}
      >
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner />
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout
      title="Trip Management"
      description="Configure trip creation and management settings"
      onSave={handleSave}
      onReset={handleReset}
      saving={saving}
    >
      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-Assign Drivers</Label>
              <p className="text-sm text-muted-foreground">
                Automatically assign available drivers to new trips
              </p>
            </div>
            <Switch
              checked={settings.autoAssignDrivers === "true"}
              onCheckedChange={(checked) =>
                handleSwitchChange("autoAssignDrivers", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Require Trip Approval</Label>
              <p className="text-sm text-muted-foreground">
                All trips must be approved before starting
              </p>
            </div>
            <Switch
              checked={settings.requireTripApproval === "true"}
              onCheckedChange={(checked) =>
                handleSwitchChange("requireTripApproval", checked)
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Default Trip Duration (hours)</Label>
            <Input
              type="number"
              value={settings.defaultTripDurationHours}
              onChange={(e) =>
                handleSettingChange("defaultTripDurationHours", e.target.value)
              }
              min="1"
              max="72"
              className="max-w-xs"
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Vehicle Proximity Settings
            </h3>

            <div className="space-y-2">
              <Label>Vehicle Proximity Radius (km)</Label>
              <p className="text-sm text-muted-foreground">
                Maximum distance from origin allowed for vehicle when creating a
                trip
              </p>
              <Input
                type="number"
                value={settings.vehicleProximityRadiusKm}
                onChange={(e) =>
                  handleSettingChange("vehicleProximityRadiusKm", e.target.value)
                }
                min="1"
                max="500"
                className="max-w-xs"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Geofence Settings
            </h3>
            <p className="text-sm text-muted-foreground">
              Configure the geofence radius displayed on trip maps for origin
              and destination locations
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Origin Geofence Radius (km)</Label>
                <p className="text-sm text-muted-foreground">
                  Radius of pickup zone shown on map
                </p>
                <Input
                  type="number"
                  step="0.1"
                  value={settings.originGeofenceRadiusKm}
                  onChange={(e) =>
                    handleSettingChange("originGeofenceRadiusKm", e.target.value)
                  }
                  min="0.1"
                  max="50"
                />
              </div>

              <div className="space-y-2">
                <Label>Destination Geofence Radius (km)</Label>
                <p className="text-sm text-muted-foreground">
                  Radius of delivery zone shown on map
                </p>
                <Input
                  type="number"
                  step="0.1"
                  value={settings.destinationGeofenceRadiusKm}
                  onChange={(e) =>
                    handleSettingChange(
                      "destinationGeofenceRadiusKm",
                      e.target.value
                    )
                  }
                  min="0.1"
                  max="50"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Play className="h-5 w-5" />
              Geofence Auto-Start
            </h3>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Geofence Auto-Start</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically start trips when vehicle enters origin geofence
                </p>
              </div>
              <Switch
                checked={settings.geofence_auto_start_enabled === "true"}
                onCheckedChange={(checked) =>
                  handleSwitchChange("geofence_auto_start_enabled", checked)
                }
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <FileWarning className="h-5 w-5" />
              Compliance Alert Settings
            </h3>
            <p className="text-sm text-muted-foreground">
              Configure when to show document expiry alerts
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Warning Threshold (days)</Label>
                <p className="text-sm text-muted-foreground">
                  Days before expiry to show warning
                </p>
                <Input
                  type="number"
                  value={settings.compliance_warning_days || "30"}
                  onChange={(e) =>
                    handleSettingChange("compliance_warning_days", e.target.value)
                  }
                  min="1"
                  max="90"
                />
              </div>

              <div className="space-y-2">
                <Label>Critical Threshold (days)</Label>
                <p className="text-sm text-muted-foreground">
                  Days before expiry to show critical alert
                </p>
                <Input
                  type="number"
                  value={settings.compliance_critical_days || "7"}
                  onChange={(e) =>
                    handleSettingChange("compliance_critical_days", e.target.value)
                  }
                  min="1"
                  max="30"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </SettingsLayout>
  );
};

export default TripSettings;
