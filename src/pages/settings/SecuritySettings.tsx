import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SettingsLayout } from "./SettingsLayout";
import { useSettings } from "@/hooks/useSettings";

const SecuritySettings = () => {
  const {
    settings,
    loading,
    saving,
    handleSettingChange,
    saveSettings,
    resetSettings,
  } = useSettings();

  const securitySettingKeys = ["sessionTimeoutMinutes", "passwordExpiryDays"] as const;

  const handleSave = () => saveSettings([...securitySettingKeys]);
  const handleReset = () => resetSettings([...securitySettingKeys]);

  if (loading) {
    return (
      <SettingsLayout
        title="Security Settings"
        description="Configure security and authentication preferences"
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
      title="Security Settings"
      description="Configure security and authentication preferences"
      onSave={handleSave}
      onReset={handleReset}
      saving={saving}
    >
      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Session Timeout</Label>
              <Select
                value={settings.sessionTimeoutMinutes}
                onValueChange={(value) =>
                  handleSettingChange("sessionTimeoutMinutes", value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Password Expiry</Label>
              <Select
                value={settings.passwordExpiryDays}
                onValueChange={(value) =>
                  handleSettingChange("passwordExpiryDays", value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">180 days</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </SettingsLayout>
  );
};

export default SecuritySettings;
