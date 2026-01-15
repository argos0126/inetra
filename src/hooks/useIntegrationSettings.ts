import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface IntegrationSettings {
  telenityUpdateIntervalSeconds: number;
  wheelseyeUpdateIntervalSeconds: number;
  googleMapsRateLimitPerMinute: number;
  resendDailyEmailLimit: number;
  fleetMapRefreshIntervalSeconds: number;
  enableTelenityTracking: boolean;
  enableWheelseyeTracking: boolean;
  enableGoogleMapsRouting: boolean;
  enableResendEmails: boolean;
}

const defaultIntegrationSettings: IntegrationSettings = {
  telenityUpdateIntervalSeconds: 900,
  wheelseyeUpdateIntervalSeconds: 300,
  googleMapsRateLimitPerMinute: 50,
  resendDailyEmailLimit: 100,
  fleetMapRefreshIntervalSeconds: 60,
  enableTelenityTracking: true,
  enableWheelseyeTracking: true,
  enableGoogleMapsRouting: true,
  enableResendEmails: true,
};

export function useIntegrationSettings() {
  const [settings, setSettings] = useState<IntegrationSettings>(defaultIntegrationSettings);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("tracking_settings")
        .select("setting_key, setting_value")
        .in("setting_key", [
          "telenity_update_interval_seconds",
          "wheelseye_update_interval_seconds",
          "google_maps_rate_limit_per_minute",
          "resend_daily_email_limit",
          "fleet_map_refresh_interval_seconds",
          "enable_telenity_tracking",
          "enable_wheelseye_tracking",
          "enable_google_maps_routing",
          "enable_resend_emails",
        ]);

      if (error) throw error;

      if (data && data.length > 0) {
        const loadedSettings = { ...defaultIntegrationSettings };
        
        data.forEach((setting) => {
          switch (setting.setting_key) {
            case "telenity_update_interval_seconds":
              loadedSettings.telenityUpdateIntervalSeconds = parseInt(setting.setting_value, 10);
              break;
            case "wheelseye_update_interval_seconds":
              loadedSettings.wheelseyeUpdateIntervalSeconds = parseInt(setting.setting_value, 10);
              break;
            case "google_maps_rate_limit_per_minute":
              loadedSettings.googleMapsRateLimitPerMinute = parseInt(setting.setting_value, 10);
              break;
            case "resend_daily_email_limit":
              loadedSettings.resendDailyEmailLimit = parseInt(setting.setting_value, 10);
              break;
            case "fleet_map_refresh_interval_seconds":
              loadedSettings.fleetMapRefreshIntervalSeconds = parseInt(setting.setting_value, 10);
              break;
            case "enable_telenity_tracking":
              loadedSettings.enableTelenityTracking = setting.setting_value === "true";
              break;
            case "enable_wheelseye_tracking":
              loadedSettings.enableWheelseyeTracking = setting.setting_value === "true";
              break;
            case "enable_google_maps_routing":
              loadedSettings.enableGoogleMapsRouting = setting.setting_value === "true";
              break;
            case "enable_resend_emails":
              loadedSettings.enableResendEmails = setting.setting_value === "true";
              break;
          }
        });
        
        setSettings(loadedSettings);
      }
    } catch (error) {
      console.error("Error loading integration settings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    loading,
    refresh: loadSettings,
  };
}
