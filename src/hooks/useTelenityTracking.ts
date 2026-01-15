import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ImportDriverParams {
  msisdn: string;
  driverName: string;
  driverId: string;
  tripId?: string;
}

interface LocationParams {
  msisdn: string;
  tripId?: string;
  driverId?: string;
}

interface TokenStatus {
  type: string;
  expires_at: string;
  updated_at: string;
  is_valid: boolean;
}

export function useTelenityTracking() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const importDriver = async (params: ImportDriverParams) => {
    setLoading(true);
    try {
      // Format msisdn - ensure it has country code prefix
      const formattedMsisdn = params.msisdn.startsWith('91') 
        ? params.msisdn 
        : `91${params.msisdn.replace(/^0+/, '')}`;

      const { data, error } = await supabase.functions.invoke("telenity-tracking/import", {
        body: { ...params, msisdn: formattedMsisdn },
      });

      if (error) throw error;

      // Check if response indicates an error
      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Consent SMS sent",
        description: "Driver will receive an SMS to grant location tracking consent.",
      });

      return data;
    } catch (error: any) {
      toast({
        title: "Error sending consent request",
        description: error.message || "Failed to send consent SMS",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const checkConsent = async (msisdn: string, consentId?: string, entityId?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ msisdn });
      if (consentId) params.append("consentId", consentId);
      if (entityId) params.append("entityId", entityId);

      const { data, error } = await supabase.functions.invoke(
        `telenity-tracking/check-consent?${params.toString()}`,
        { method: "GET" }
      );

      if (error) throw error;

      // Show toast with current status
      const statusMessage = data?.status === 'allowed' 
        ? 'Consent has been granted by the driver.' 
        : data?.status === 'pending'
        ? 'Consent is still pending. Driver has not yet responded.'
        : data?.status === 'not_allowed'
        ? 'Consent was denied by the driver.'
        : `Status: ${data?.status || 'Unknown'}`;

      toast({
        title: "Consent Status Checked",
        description: statusMessage,
        variant: data?.status === 'allowed' ? 'default' : 'default',
      });

      return data;
    } catch (error: any) {
      toast({
        title: "Error checking consent",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const searchEntity = async (msisdn: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        `telenity-tracking/search?msisdn=${encodeURIComponent(msisdn)}`,
        { method: "GET" }
      );

      if (error) throw error;
      return data;
    } catch (error: any) {
      toast({
        title: "Error searching entity",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getLocation = async (params: LocationParams) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({ msisdn: params.msisdn });
      if (params.tripId) queryParams.append("tripId", params.tripId);
      if (params.driverId) queryParams.append("driverId", params.driverId);

      const { data, error } = await supabase.functions.invoke(
        `telenity-tracking/location?${queryParams.toString()}`,
        { method: "GET" }
      );

      if (error) throw error;
      return data;
    } catch (error: any) {
      toast({
        title: "Error fetching location",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getTokenStatus = async (): Promise<TokenStatus[]> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "telenity-tracking/token-status",
        { method: "GET" }
      );

      if (error) throw error;
      return data.tokens || [];
    } catch (error: any) {
      toast({
        title: "Error fetching token status",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const refreshTokens = async (type?: 'authentication' | 'access' | 'all') => {
    setLoading(true);
    try {
      const endpoint = type === 'all' || !type 
        ? 'telenity-token-refresh/refresh-all'
        : `telenity-token-refresh/refresh-${type}`;

      const { data, error } = await supabase.functions.invoke(endpoint, {
        method: "POST"
      });

      if (error) throw error;

      toast({
        title: "Tokens refreshed",
        description: "Telenity API tokens have been refreshed successfully.",
      });

      return data;
    } catch (error: any) {
      toast({
        title: "Error refreshing tokens",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    importDriver,
    checkConsent,
    searchEntity,
    getLocation,
    getTokenStatus,
    refreshTokens,
  };
}
