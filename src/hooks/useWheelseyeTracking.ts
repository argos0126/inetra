import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface LocationParams {
  vehicleNumber: string;
  tripId?: string;
  vehicleId?: string;
  trackingAssetId?: string;
}

interface HistoryParams {
  vehicleNumber: string;
  fromDate: string;
  toDate: string;
}

export function useWheelseyeTracking() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const getLocation = async (params: LocationParams) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({ vehicleNumber: params.vehicleNumber });
      if (params.tripId) queryParams.append("tripId", params.tripId);
      if (params.vehicleId) queryParams.append("vehicleId", params.vehicleId);
      if (params.trackingAssetId) queryParams.append("trackingAssetId", params.trackingAssetId);

      const { data, error } = await supabase.functions.invoke(
        `wheelseye-tracking/location?${queryParams.toString()}`,
        { method: "GET" }
      );

      if (error) throw error;
      return data;
    } catch (error: any) {
      toast({
        title: "Error fetching GPS location",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getLocationHistory = async (params: HistoryParams) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        vehicleNumber: params.vehicleNumber,
        fromDate: params.fromDate,
        toDate: params.toDate,
      });

      const { data, error } = await supabase.functions.invoke(
        `wheelseye-tracking/history?${queryParams.toString()}`,
        { method: "GET" }
      );

      if (error) throw error;
      return data;
    } catch (error: any) {
      toast({
        title: "Error fetching location history",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getBulkLocations = async (vehicleNumbers: string[], tripId?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("wheelseye-tracking/bulk-location", {
        body: { vehicleNumbers, tripId },
      });

      if (error) throw error;
      return data;
    } catch (error: any) {
      toast({
        title: "Error fetching bulk locations",
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
    getLocation,
    getLocationHistory,
    getBulkLocations,
  };
}
