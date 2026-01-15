import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RouteData } from "@/components/lane/LaneRouteCalculator";
import { Json } from "@/integrations/supabase/types";

interface Waypoint {
  sequence: number;
  lat: number | null;
  lng: number | null;
  name: string;
  type: string;
  location_id?: string | null;
}

interface LaneRouteCalculation {
  id: string;
  lane_id: string;
  encoded_polyline: string | null;
  total_distance_meters: number | null;
  total_duration_seconds: number | null;
  route_summary: string | null;
  calculated_at: string | null;
  waypoints: Waypoint[] | null;
}

export const useLaneRouteCalculation = (laneId?: string) => {
  const [routeCalculation, setRouteCalculation] = useState<LaneRouteCalculation | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (laneId) {
      fetchRouteCalculation(laneId);
    }
  }, [laneId]);

  const fetchRouteCalculation = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("lane_route_calculations")
        .select("*")
        .eq("lane_id", id)
        .maybeSingle();

      if (error) throw error;
      
      // Parse waypoints from JSONB
      if (data) {
        setRouteCalculation({
          ...data,
          waypoints: Array.isArray(data.waypoints) ? (data.waypoints as unknown as Waypoint[]) : null,
        });
      } else {
        setRouteCalculation(null);
      }
    } catch (error) {
      console.error("Error fetching lane route calculation:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveRouteCalculation = async (laneId: string, routeData: RouteData) => {
    try {
      // Convert waypointCoordinates to waypoints JSON format
      const waypoints: Waypoint[] = routeData.waypointCoordinates?.map((wp, index) => ({
        sequence: index + 1,
        lat: wp.lat,
        lng: wp.lng,
        name: wp.name || `Waypoint ${index + 1}`,
        type: 'via',
      })) || [];

      const { error } = await supabase
        .from("lane_route_calculations")
        .upsert([{
          lane_id: laneId,
          encoded_polyline: routeData.encodedPolyline,
          total_distance_meters: routeData.totalDistanceMeters,
          total_duration_seconds: routeData.totalDurationSeconds,
          route_summary: routeData.routeSummary,
          waypoints: JSON.parse(JSON.stringify(waypoints)) as Json,
          calculated_at: new Date().toISOString(),
        }], {
          onConflict: "lane_id",
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error saving lane route calculation:", error);
      return false;
    }
  };

  const getRouteDataFromCalculation = (): RouteData | null => {
    if (!routeCalculation?.encoded_polyline) return null;

    // Convert waypoints JSON back to waypointCoordinates format
    const waypointCoordinates = routeCalculation.waypoints
      ?.filter(wp => wp.lat != null && wp.lng != null)
      ?.map(wp => ({
        lat: wp.lat!,
        lng: wp.lng!,
        name: wp.name,
      })) || [];

    return {
      encodedPolyline: routeCalculation.encoded_polyline,
      totalDistanceMeters: routeCalculation.total_distance_meters || 0,
      totalDurationSeconds: routeCalculation.total_duration_seconds || 0,
      routeSummary: routeCalculation.route_summary || "",
      waypointCoordinates,
    };
  };

  return {
    routeCalculation,
    loading,
    saveRouteCalculation,
    getRouteDataFromCalculation,
    fetchRouteCalculation,
  };
};
