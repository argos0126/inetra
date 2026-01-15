import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TrackingSettings {
  // Trip Settings
  vehicleProximityRadiusKm: string;
  originGeofenceRadiusKm: string;
  destinationGeofenceRadiusKm: string;
  defaultTripDurationHours: string;
  autoAssignDrivers: string;
  requireTripApproval: string;
  geofence_auto_start_enabled: string;
  // Compliance Settings
  compliance_warning_days: string;
  compliance_critical_days: string;
  // Security Settings
  sessionTimeoutMinutes: string;
  passwordExpiryDays: string;
  // Notification Settings
  emailNotifications: string;
  smsNotifications: string;
  pushNotifications: string;
  maintenanceAlerts: string;
  delayAlerts: string;
  fuelAlerts: string;
  // System Settings
  timezone: string;
  dateFormat: string;
  currency: string;
  language: string;
  // Integration Settings
  telenityUpdateIntervalSeconds: string;
  wheelseyeUpdateIntervalSeconds: string;
  googleMapsRateLimitPerMinute: string;
  resendDailyEmailLimit: string;
  fleetMapRefreshIntervalSeconds: string;
  enableTelenityTracking: string;
  enableWheelseyeTracking: string;
  enableGoogleMapsRouting: string;
  enableResendEmails: string;
}

export const defaultSettings: TrackingSettings = {
  vehicleProximityRadiusKm: "50",
  originGeofenceRadiusKm: "0.5",
  destinationGeofenceRadiusKm: "0.5",
  defaultTripDurationHours: "8",
  autoAssignDrivers: "true",
  requireTripApproval: "false",
  geofence_auto_start_enabled: "false",
  compliance_warning_days: "30",
  compliance_critical_days: "7",
  sessionTimeoutMinutes: "30",
  passwordExpiryDays: "90",
  emailNotifications: "true",
  smsNotifications: "false",
  pushNotifications: "false",
  maintenanceAlerts: "true",
  delayAlerts: "true",
  fuelAlerts: "true",
  timezone: "Asia/Kolkata",
  dateFormat: "DD/MM/YYYY",
  currency: "INR",
  language: "en",
  // Integration defaults
  telenityUpdateIntervalSeconds: "900",
  wheelseyeUpdateIntervalSeconds: "300",
  googleMapsRateLimitPerMinute: "50",
  resendDailyEmailLimit: "100",
  fleetMapRefreshIntervalSeconds: "60",
  enableTelenityTracking: "true",
  enableWheelseyeTracking: "true",
  enableGoogleMapsRouting: "true",
  enableResendEmails: "true",
};

const settingDescriptions: Record<string, string> = {
  vehicleProximityRadiusKm: "Maximum distance (km) from origin allowed for vehicle at trip creation",
  originGeofenceRadiusKm: "Geofence radius around origin location in kilometers",
  destinationGeofenceRadiusKm: "Geofence radius around destination location in kilometers",
  defaultTripDurationHours: "Default trip duration in hours",
  autoAssignDrivers: "Automatically assign available drivers to new trips",
  requireTripApproval: "All trips must be approved before starting",
  sessionTimeoutMinutes: "Session timeout in minutes",
  passwordExpiryDays: "Password expiry in days",
  emailNotifications: "Receive notifications via email",
  smsNotifications: "Receive notifications via SMS",
  pushNotifications: "Receive push notifications in browser",
  maintenanceAlerts: "Receive maintenance alerts",
  delayAlerts: "Receive delay alerts",
  fuelAlerts: "Receive fuel alerts",
  timezone: "Application timezone",
  dateFormat: "Date display format",
  currency: "Default currency for the application",
  language: "Application language",
  // Integration descriptions
  telenityUpdateIntervalSeconds: "Telenity SIM tracking poll interval in seconds",
  wheelseyeUpdateIntervalSeconds: "WheelsEye GPS tracking poll interval in seconds",
  googleMapsRateLimitPerMinute: "Maximum Google Maps API requests per minute",
  resendDailyEmailLimit: "Maximum emails to send per day via Resend",
  fleetMapRefreshIntervalSeconds: "Fleet map UI refresh interval in seconds",
  enableTelenityTracking: "Enable or disable Telenity SIM-based tracking",
  enableWheelseyeTracking: "Enable or disable WheelsEye GPS tracking",
  enableGoogleMapsRouting: "Enable or disable Google Maps route calculations",
  enableResendEmails: "Enable or disable email notifications via Resend",
};

export const useSettings = () => {
  const [settings, setSettings] = useState<TrackingSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tracking_settings")
        .select("setting_key, setting_value");

      if (error) throw error;

      if (data && data.length > 0) {
        const loadedSettings = { ...defaultSettings };
        data.forEach((setting) => {
          const key = setting.setting_key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()) as keyof TrackingSettings;
          if (key in loadedSettings) {
            loadedSettings[key] = setting.setting_value;
          }
        });
        setSettings(loadedSettings);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSettingChange = (key: keyof TrackingSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSwitchChange = (key: keyof TrackingSettings, checked: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: checked ? "true" : "false" }));
  };

  const saveSettings = async (keys?: (keyof TrackingSettings)[]) => {
    setSaving(true);
    try {
      const settingsToSave = Object.entries(settings)
        .filter(([key]) => !keys || keys.includes(key as keyof TrackingSettings))
        .map(([key, value]) => ({
          setting_key: key.replace(/([A-Z])/g, "_$1").toLowerCase(),
          setting_value: value,
          description: settingDescriptions[key] || "",
        }));

      for (const setting of settingsToSave) {
        const { error } = await supabase
          .from("tracking_settings")
          .upsert(setting, { onConflict: "setting_key" });
        if (error) throw error;
      }

      toast.success("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = (keys?: (keyof TrackingSettings)[]) => {
    if (keys) {
      setSettings((prev) => {
        const newSettings = { ...prev };
        keys.forEach((key) => {
          newSettings[key] = defaultSettings[key];
        });
        return newSettings;
      });
    } else {
      setSettings(defaultSettings);
    }
    toast.info("Settings reset to defaults. Click Save to apply.");
  };

  return {
    settings,
    loading,
    saving,
    handleSettingChange,
    handleSwitchChange,
    saveSettings,
    resetSettings,
    loadSettings,
  };
};
