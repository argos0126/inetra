import { useState, useEffect } from "react";
import { SettingsLayout } from "./SettingsLayout";
import { usePermissions } from "@/contexts/PermissionContext";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Radio, Satellite, MapPin, Mail } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { IntegrationCard, IntegrationSetting } from "@/components/settings/IntegrationCard";
import { useTelenityTracking } from "@/hooks/useTelenityTracking";
import { supabase } from "@/integrations/supabase/client";

interface TokenInfo {
  token_type: string;
  expires_at: string;
}

const IntegrationSettings = () => {
  const { isSuperAdmin } = usePermissions();
  const { settings, loading, saving, handleSettingChange, handleSwitchChange, saveSettings, resetSettings } = useSettings();
  const { refreshTokens } = useTelenityTracking();
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [refreshingTelenity, setRefreshingTelenity] = useState(false);

  // Redirect non-super admins
  if (!isSuperAdmin) {
    return <Navigate to="/settings/trips" replace />;
  }

  useEffect(() => {
    fetchTokenStatus();
  }, []);

  const fetchTokenStatus = async () => {
    try {
      const { data, error } = await supabase
        .from("integration_tokens")
        .select("token_type, expires_at");
      
      if (error) throw error;
      setTokens(data || []);
    } catch (error) {
      console.error("Failed to fetch token status:", error);
    }
  };

  const getTokenExpiry = (tokenType: string) => {
    const token = tokens.find(t => t.token_type === tokenType);
    if (!token) return undefined;
    
    const expiresAt = new Date(token.expires_at);
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();
    
    if (diffMs <= 0) return "Expired";
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const handleRefreshTelenityToken = async () => {
    setRefreshingTelenity(true);
    try {
      await refreshTokens("all");
      await fetchTokenStatus();
      toast.success("Telenity tokens refreshed");
    } catch (error) {
      toast.error("Failed to refresh tokens");
    } finally {
      setRefreshingTelenity(false);
    }
  };

  const handleSave = async () => {
    await saveSettings([
      "telenityUpdateIntervalSeconds",
      "wheelseyeUpdateIntervalSeconds",
      "googleMapsRateLimitPerMinute",
      "resendDailyEmailLimit",
      "fleetMapRefreshIntervalSeconds",
      "enableTelenityTracking",
      "enableWheelseyeTracking",
      "enableGoogleMapsRouting",
      "enableResendEmails",
    ]);
  };

  const handleReset = () => {
    resetSettings([
      "telenityUpdateIntervalSeconds",
      "wheelseyeUpdateIntervalSeconds",
      "googleMapsRateLimitPerMinute",
      "resendDailyEmailLimit",
      "fleetMapRefreshIntervalSeconds",
      "enableTelenityTracking",
      "enableWheelseyeTracking",
      "enableGoogleMapsRouting",
      "enableResendEmails",
    ]);
  };

  // Telenity settings
  const telenitySettings: IntegrationSetting[] = [
    {
      key: "telenityUpdateIntervalSeconds",
      label: "Location Update Interval",
      type: "number",
      value: settings.telenityUpdateIntervalSeconds,
      description: "How often to poll for SIM-based location updates",
      suffix: "seconds",
    },
  ];

  // WheelsEye settings
  const wheelseyeSettings: IntegrationSetting[] = [
    {
      key: "wheelseyeUpdateIntervalSeconds",
      label: "GPS Update Interval",
      type: "number",
      value: settings.wheelseyeUpdateIntervalSeconds,
      description: "How often to poll for GPS location updates",
      suffix: "seconds",
    },
    {
      key: "fleetMapRefreshIntervalSeconds",
      label: "Fleet Map Refresh Rate",
      type: "number",
      value: settings.fleetMapRefreshIntervalSeconds,
      description: "How often the fleet map UI refreshes",
      suffix: "seconds",
    },
  ];

  // Google Maps settings
  const googleMapsSettings: IntegrationSetting[] = [
    {
      key: "googleMapsRateLimitPerMinute",
      label: "Rate Limit",
      type: "number",
      value: settings.googleMapsRateLimitPerMinute,
      description: "Maximum API requests allowed per minute",
      suffix: "req/min",
    },
  ];

  // Resend settings
  const resendSettings: IntegrationSetting[] = [
    {
      key: "resendDailyEmailLimit",
      label: "Daily Email Limit",
      type: "number",
      value: settings.resendDailyEmailLimit,
      description: "Maximum emails to send per day",
      suffix: "emails/day",
    },
  ];

  if (loading) {
    return (
      <SettingsLayout
        title="API Integrations"
        description="Manage external API tokens and integrations"
        onSave={handleSave}
        onReset={handleReset}
        saving={saving}
      >
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout
      title="API Integrations"
      description="Manage external API tokens and integrations"
      onSave={handleSave}
      onReset={handleReset}
      saving={saving}
    >
      <div className="space-y-4">
        <IntegrationCard
          title="Telenity API"
          description="SIM-based location tracking service"
          icon={Radio}
          isEnabled={settings.enableTelenityTracking === "true"}
          onEnabledChange={(enabled) => handleSwitchChange("enableTelenityTracking", enabled)}
          settings={telenitySettings}
          onSettingChange={handleSettingChange}
          status="connected"
          tokenExpiry={getTokenExpiry("access")}
          onRefreshToken={handleRefreshTelenityToken}
          isRefreshing={refreshingTelenity}
        />

        <IntegrationCard
          title="WheelsEye API"
          description="GPS vehicle tracking service"
          icon={Satellite}
          isEnabled={settings.enableWheelseyeTracking === "true"}
          onEnabledChange={(enabled) => handleSwitchChange("enableWheelseyeTracking", enabled)}
          settings={wheelseyeSettings}
          onSettingChange={handleSettingChange}
          status="connected"
        />

        <IntegrationCard
          title="Google Maps API"
          description="Route calculation & geocoding"
          icon={MapPin}
          isEnabled={settings.enableGoogleMapsRouting === "true"}
          onEnabledChange={(enabled) => handleSwitchChange("enableGoogleMapsRouting", enabled)}
          settings={googleMapsSettings}
          onSettingChange={handleSettingChange}
          status="connected"
        />

        <IntegrationCard
          title="Resend Email API"
          description="Email notifications service"
          icon={Mail}
          isEnabled={settings.enableResendEmails === "true"}
          onEnabledChange={(enabled) => handleSwitchChange("enableResendEmails", enabled)}
          settings={resendSettings}
          onSettingChange={handleSettingChange}
          status="connected"
        />
      </div>
    </SettingsLayout>
  );
};

export default IntegrationSettings;
