import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SettingsLayout } from "./SettingsLayout";
import { useSettings } from "@/hooks/useSettings";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Bell, BellOff, Send, AlertCircle } from "lucide-react";

const NotificationSettings = () => {
  const {
    settings,
    loading,
    saving,
    handleSwitchChange,
    saveSettings,
    resetSettings,
  } = useSettings();

  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading: pushLoading,
    subscribe,
    unsubscribe,
    sendTestNotification,
  } = usePushNotifications();

  const notificationSettingKeys = [
    "emailNotifications",
    "smsNotifications",
    "pushNotifications",
    "maintenanceAlerts",
    "delayAlerts",
    "fuelAlerts",
  ] as const;

  const handleSave = () => saveSettings([...notificationSettingKeys]);
  const handleReset = () => resetSettings([...notificationSettingKeys]);

  const handlePushToggle = async (checked: boolean) => {
    if (checked) {
      const success = await subscribe();
      if (success) {
        handleSwitchChange("pushNotifications", true);
      }
    } else {
      const success = await unsubscribe();
      if (success) {
        handleSwitchChange("pushNotifications", false);
      }
    }
  };

  const getPermissionBadge = () => {
    if (!isSupported) {
      return <Badge variant="destructive">Not Supported</Badge>;
    }
    switch (permission) {
      case 'granted':
        return <Badge variant="default" className="bg-green-600">Enabled</Badge>;
      case 'denied':
        return <Badge variant="destructive">Blocked</Badge>;
      default:
        return <Badge variant="secondary">Not Set</Badge>;
    }
  };

  if (loading) {
    return (
      <SettingsLayout
        title="Notification Preferences"
        description="Configure how you receive notifications and alerts"
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
      title="Notification Preferences"
      description="Configure how you receive notifications and alerts"
      onSave={handleSave}
      onReset={handleReset}
      saving={saving}
    >
      <div className="space-y-6">
        {/* Push Notifications Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  {isSubscribed ? (
                    <Bell className="h-6 w-6 text-primary" />
                  ) : (
                    <BellOff className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-medium">Browser Push Notifications</Label>
                    {getPermissionBadge()}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Receive real-time alerts even when the app is not open
                  </p>
                  {!isSupported && (
                    <p className="text-sm text-destructive flex items-center gap-1 mt-2">
                      <AlertCircle className="h-4 w-4" />
                      Your browser doesn't support push notifications
                    </p>
                  )}
                  {permission === 'denied' && (
                    <p className="text-sm text-destructive flex items-center gap-1 mt-2">
                      <AlertCircle className="h-4 w-4" />
                      Notifications are blocked. Please enable them in browser settings.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isSubscribed && permission === 'granted' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={sendTestNotification}
                    disabled={pushLoading}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Test
                  </Button>
                )}
                <Switch
                  checked={isSubscribed && permission === 'granted'}
                  onCheckedChange={handlePushToggle}
                  disabled={pushLoading || !isSupported || permission === 'denied'}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Other Notification Channels */}
        <Card>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Notification Channels</h3>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via email
                  </p>
                </div>
                <Switch
                  checked={settings.emailNotifications === "true"}
                  onCheckedChange={(checked) =>
                    handleSwitchChange("emailNotifications", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>SMS Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via SMS
                  </p>
                </div>
                <Switch
                  checked={settings.smsNotifications === "true"}
                  onCheckedChange={(checked) =>
                    handleSwitchChange("smsNotifications", checked)
                  }
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Alert Types</h3>
              <p className="text-sm text-muted-foreground">
                Choose which types of alerts you want to receive
              </p>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Maintenance Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Vehicle maintenance and service reminders
                  </p>
                </div>
                <Switch
                  checked={settings.maintenanceAlerts === "true"}
                  onCheckedChange={(checked) =>
                    handleSwitchChange("maintenanceAlerts", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Delay Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Trip delays and ETA changes
                  </p>
                </div>
                <Switch
                  checked={settings.delayAlerts === "true"}
                  onCheckedChange={(checked) =>
                    handleSwitchChange("delayAlerts", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Fuel Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Low fuel and fuel theft detection
                  </p>
                </div>
                <Switch
                  checked={settings.fuelAlerts === "true"}
                  onCheckedChange={(checked) =>
                    handleSwitchChange("fuelAlerts", checked)
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SettingsLayout>
  );
};

export default NotificationSettings;
