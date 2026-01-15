import { useState, useEffect } from "react";
import { LiveMapView } from "./LiveMapView";
import { supabase } from "@/integrations/supabase/client";
import { useWheelseyeTracking } from "@/hooks/useWheelseyeTracking";
import { useIntegrationSettings } from "@/hooks/useIntegrationSettings";
import { toast } from "sonner";

interface FleetLocation {
  id: string;
  name: string;
  type: "vehicle" | "driver" | "asset";
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  timestamp?: string;
  status?: "active" | "idle" | "offline";
}

interface FleetMapViewProps {
  tripId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // Can still be overridden via props
}

export function FleetMapView({
  tripId,
  autoRefresh = true,
  refreshInterval: propRefreshInterval,
}: FleetMapViewProps) {
  const [locations, setLocations] = useState<FleetLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const { getBulkLocations } = useWheelseyeTracking();
  const { settings: integrationSettings, loading: settingsLoading } = useIntegrationSettings();

  // Use prop override if provided, otherwise use setting from database
  const refreshInterval = propRefreshInterval || (integrationSettings.fleetMapRefreshIntervalSeconds * 1000);

  const fetchLocations = async () => {
    try {
      // Fetch active trips with vehicles
      let query = supabase
        .from("trips")
        .select(`
          id,
          trip_code,
          vehicle:vehicles(id, vehicle_number),
          driver:drivers(id, name, mobile),
          tracking_asset:tracking_assets(id, asset_id, asset_type)
        `)
        .eq("status", "ongoing");

      if (tripId) {
        query = query.eq("id", tripId);
      }

      const { data: trips, error } = await query;

      if (error) throw error;

      if (!trips || trips.length === 0) {
        setLocations([]);
        setLoading(false);
        return;
      }

      // Get vehicle numbers for GPS tracking
      const vehicleNumbers = trips
        .filter((t) => t.vehicle?.vehicle_number)
        .map((t) => t.vehicle!.vehicle_number);

      if (vehicleNumbers.length === 0) {
        setLocations([]);
        setLoading(false);
        return;
      }

      // Fetch bulk locations from Wheelseye
      const result = await getBulkLocations(vehicleNumbers, tripId);

      if (result?.data) {
        const fleetLocations: FleetLocation[] = result.data
          .filter((loc: any) => loc.latitude && loc.longitude)
          .map((loc: any) => {
            const trip = trips.find(
              (t) => t.vehicle?.vehicle_number === loc.vehicleNumber
            );
            return {
              id: loc.vehicleNumber,
              name: loc.vehicleNumber,
              type: "vehicle" as const,
              latitude: parseFloat(loc.latitude),
              longitude: parseFloat(loc.longitude),
              speed: loc.speed,
              heading: loc.heading,
              timestamp: loc.timestamp,
              status: getVehicleStatus(loc.speed, loc.timestamp),
            };
          });

        setLocations(fleetLocations);
      }
    } catch (error) {
      console.error("Error fetching fleet locations:", error);
      toast.error("Failed to fetch fleet locations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, [tripId]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLocations, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, tripId]);

  const handleLocationClick = (location: FleetLocation) => {
    console.log("Location clicked:", location);
  };

  return (
    <LiveMapView
      locations={locations}
      autoRefresh={autoRefresh}
      refreshInterval={refreshInterval}
      onLocationClick={handleLocationClick}
    />
  );
}

function getVehicleStatus(
  speed?: number,
  timestamp?: string
): "active" | "idle" | "offline" {
  if (!timestamp) return "offline";

  const lastUpdate = new Date(timestamp);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastUpdate.getTime()) / 1000 / 60;

  if (diffMinutes > 30) return "offline";
  if (speed && speed > 0) return "active";
  return "idle";
}
