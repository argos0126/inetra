import { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

export type ShipmentStatus = Database["public"]["Enums"]["shipment_status"];

// Sub-status definitions per main status
export const subStatusConfig: Record<string, { statuses: string[]; labels: Record<string, string> }> = {
  in_pickup: {
    statuses: ["vehicle_placed", "loading_started", "loading_completed", "ready_for_dispatch"],
    labels: {
      vehicle_placed: "Vehicle Placed",
      loading_started: "Loading Started",
      loading_completed: "Loading Completed",
      ready_for_dispatch: "Ready for Dispatch",
    },
  },
  in_transit: {
    statuses: ["on_time", "delayed"],
    labels: {
      on_time: "On Time",
      delayed: "Delayed",
    },
  },
  delivered: {
    statuses: ["pod_pending", "pod_cleaned", "billed", "paid"],
    labels: {
      pod_pending: "POD Pending",
      pod_cleaned: "POD Cleaned",
      billed: "Billed",
      paid: "Paid",
    },
  },
};

// Main status flow (linear progression)
export const statusFlow: ShipmentStatus[] = [
  "created",
  "confirmed",
  "mapped",
  "in_pickup",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "success",
];

// Allowed transitions for each status
export const allowedTransitions: Record<ShipmentStatus, ShipmentStatus[]> = {
  created: ["confirmed"],
  confirmed: ["mapped", "created"],
  mapped: ["in_pickup", "confirmed"],
  in_pickup: ["in_transit", "mapped"],
  in_transit: ["out_for_delivery", "in_pickup"],
  out_for_delivery: ["delivered", "ndr", "in_transit"],
  delivered: ["success", "ndr"],
  ndr: ["out_for_delivery", "returned"],
  returned: [],
  success: [],
};

// Status configuration with icons and colors
export const statusConfig: Record<ShipmentStatus, { label: string; color: string; bgColor: string }> = {
  created: { label: "Created", color: "text-gray-500", bgColor: "bg-gray-100" },
  confirmed: { label: "Confirmed", color: "text-blue-500", bgColor: "bg-blue-100" },
  mapped: { label: "Mapped", color: "text-purple-500", bgColor: "bg-purple-100" },
  in_pickup: { label: "In Pickup", color: "text-orange-500", bgColor: "bg-orange-100" },
  in_transit: { label: "In Transit", color: "text-indigo-500", bgColor: "bg-indigo-100" },
  out_for_delivery: { label: "Out for Delivery", color: "text-cyan-500", bgColor: "bg-cyan-100" },
  delivered: { label: "Delivered", color: "text-green-500", bgColor: "bg-green-100" },
  ndr: { label: "NDR", color: "text-red-500", bgColor: "bg-red-100" },
  returned: { label: "Returned", color: "text-rose-500", bgColor: "bg-rose-100" },
  success: { label: "Success", color: "text-emerald-600", bgColor: "bg-emerald-100" },
};

// Mandatory fields for shipment confirmation
export const mandatoryFields = ["shipment_code", "consignee_code", "material_id", "pickup_location_id", "drop_location_id"];

/**
 * Validate if a status transition is allowed
 */
export function validateStatusTransition(
  currentStatus: ShipmentStatus,
  newStatus: ShipmentStatus
): { valid: boolean; message?: string } {
  const allowed = allowedTransitions[currentStatus];
  
  if (!allowed.includes(newStatus)) {
    return {
      valid: false,
      message: `Cannot transition from ${statusConfig[currentStatus].label} to ${statusConfig[newStatus].label}`,
    };
  }
  
  return { valid: true };
}

/**
 * Validate sub-status progression within a main status
 */
export function validateSubStatusProgression(
  status: ShipmentStatus,
  currentSubStatus: string | null,
  newSubStatus: string
): { valid: boolean; message?: string } {
  const config = subStatusConfig[status];
  
  if (!config) {
    return { valid: true }; // No sub-statuses for this status
  }
  
  const currentIndex = currentSubStatus ? config.statuses.indexOf(currentSubStatus) : -1;
  const newIndex = config.statuses.indexOf(newSubStatus);
  
  if (newIndex === -1) {
    return { valid: false, message: `Invalid sub-status: ${newSubStatus}` };
  }
  
  // Allow progressing forward or staying at current position
  if (newIndex < currentIndex) {
    return {
      valid: false,
      message: `Cannot go back from ${config.labels[currentSubStatus!]} to ${config.labels[newSubStatus]}`,
    };
  }
  
  return { valid: true };
}

/**
 * Check if shipment has all mandatory fields for confirmation
 */
export function validateMandatoryFields(shipment: any): { valid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];
  
  mandatoryFields.forEach((field) => {
    if (!shipment[field]) {
      missingFields.push(field);
    }
  });
  
  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Check if shipment is not already mapped to another active trip
 */
export async function checkUniqueMapping(
  shipmentId: string,
  tripId?: string
): Promise<{ valid: boolean; existingTrip?: string }> {
  const { data, error } = await supabase
    .from("trip_shipment_map")
    .select(`
      id,
      trip:trips(id, trip_code, status)
    `)
    .eq("shipment_id", shipmentId);
  
  if (error) {
    console.error("Error checking mapping:", error);
    return { valid: false };
  }
  
  // Check if mapped to another active trip
  const activeMappings = data?.filter(
    (m: any) => m.trip && m.trip.status !== "completed" && m.trip.status !== "cancelled"
  );
  
  if (activeMappings && activeMappings.length > 0) {
    const existingTrip = activeMappings[0]?.trip;
    if (tripId && existingTrip?.id === tripId) {
      return { valid: true }; // Same trip is fine
    }
    return { valid: false, existingTrip: existingTrip?.trip_code };
  }
  
  return { valid: true };
}

/**
 * Validate capacity for PTL shipments
 */
export async function validateCapacity(
  tripId: string,
  newShipmentWeight: number,
  newShipmentVolume: number
): Promise<{ valid: boolean; message?: string; utilization?: { weight: number; volume: number } }> {
  // Get trip with vehicle info
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select(`
      id,
      vehicle:vehicles(
        id,
        vehicle_type:vehicle_types(weight_capacity_kg, volume_capacity_cbm)
      )
    `)
    .eq("id", tripId)
    .maybeSingle();
  
  if (tripError || !trip) {
    return { valid: true }; // Skip validation if can't fetch trip
  }
  
  const vehicleType = (trip.vehicle as any)?.vehicle_type;
  if (!vehicleType) {
    return { valid: true }; // Skip if no vehicle type info
  }
  
  // Get existing shipments on this trip
  const { data: mappings, error: mappingError } = await supabase
    .from("trip_shipment_map")
    .select(`
      shipment:shipments(weight_kg, volume_cbm)
    `)
    .eq("trip_id", tripId);
  
  if (mappingError) {
    return { valid: true };
  }
  
  const totalWeight = (mappings || []).reduce(
    (sum: number, m: any) => sum + (m.shipment?.weight_kg || 0),
    0
  ) + (newShipmentWeight || 0);
  
  const totalVolume = (mappings || []).reduce(
    (sum: number, m: any) => sum + (m.shipment?.volume_cbm || 0),
    0
  ) + (newShipmentVolume || 0);
  
  const weightCapacity = vehicleType.weight_capacity_kg || Infinity;
  const volumeCapacity = vehicleType.volume_capacity_cbm || Infinity;
  
  const weightUtilization = (totalWeight / weightCapacity) * 100;
  const volumeUtilization = (totalVolume / volumeCapacity) * 100;
  
  if (totalWeight > weightCapacity) {
    return {
      valid: false,
      message: `Weight capacity exceeded: ${totalWeight.toFixed(1)}kg / ${weightCapacity}kg`,
      utilization: { weight: weightUtilization, volume: volumeUtilization },
    };
  }
  
  if (totalVolume > volumeCapacity) {
    return {
      valid: false,
      message: `Volume capacity exceeded: ${totalVolume.toFixed(3)}CBM / ${volumeCapacity}CBM`,
      utilization: { weight: weightUtilization, volume: volumeUtilization },
    };
  }
  
  return {
    valid: true,
    utilization: { weight: weightUtilization, volume: volumeUtilization },
  };
}

/**
 * Check if trip has vehicle linked (for in_pickup transition)
 */
export async function checkTripVehicleLinkage(tripId: string): Promise<{ valid: boolean; message?: string }> {
  const { data: trip, error } = await supabase
    .from("trips")
    .select("id, vehicle_id")
    .eq("id", tripId)
    .maybeSingle();
  
  if (error || !trip) {
    return { valid: false, message: "Trip not found" };
  }
  
  if (!trip.vehicle_id) {
    return { valid: false, message: "Trip must have a vehicle assigned before pickup" };
  }
  
  return { valid: true };
}

/**
 * Calculate delay percentage based on planned vs actual time
 */
export function calculateDelayPercentage(
  plannedTime: Date | string,
  actualTime: Date | string,
  standardTatHours?: number
): number {
  const planned = new Date(plannedTime).getTime();
  const actual = new Date(actualTime).getTime();
  
  const tatMs = standardTatHours ? standardTatHours * 60 * 60 * 1000 : planned - Date.now();
  
  if (tatMs <= 0) return 0;
  
  const delayMs = actual - planned;
  const delayPercentage = (delayMs / tatMs) * 100;
  
  return Math.round(delayPercentage * 100) / 100;
}

/**
 * Check if delay exceeds threshold (15%)
 */
export function shouldAutoFlagDelay(delayPercentage: number, threshold: number = 15): boolean {
  return delayPercentage > threshold;
}

/**
 * Get timestamp field name for a status
 */
export function getTimestampFieldForStatus(status: ShipmentStatus): string | null {
  const mapping: Record<string, string> = {
    confirmed: "confirmed_at",
    mapped: "mapped_at",
    in_pickup: "in_pickup_at",
    in_transit: "in_transit_at",
    out_for_delivery: "out_for_delivery_at",
    delivered: "delivered_at",
    ndr: "ndr_at",
    returned: "returned_at",
    success: "success_at",
  };
  
  return mapping[status] || null;
}

/**
 * Get sub-status timestamp field
 */
export function getSubStatusTimestampField(subStatus: string): string | null {
  const mapping: Record<string, string> = {
    loading_started: "loading_started_at",
    loading_completed: "loading_completed_at",
    pod_cleaned: "pod_cleaned_at",
    billed: "billed_at",
    paid: "paid_at",
  };
  
  return mapping[subStatus] || null;
}
