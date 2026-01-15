import { supabase } from "@/integrations/supabase/client";
import { ShipmentStatus, getTimestampFieldForStatus, getSubStatusTimestampField } from "./shipmentValidations";

export type ChangeSource = "manual" | "geofence" | "api" | "system";

export interface StatusChangePayload {
  shipmentId: string;
  previousStatus: ShipmentStatus | null;
  newStatus: ShipmentStatus;
  previousSubStatus?: string | null;
  newSubStatus?: string | null;
  changeSource?: ChangeSource;
  notes?: string;
  metadata?: Record<string, any>;
}

/**
 * Log a status change to the shipment_status_history table
 */
export async function logStatusChange(payload: StatusChangePayload): Promise<{ success: boolean; error?: string }> {
  const {
    shipmentId,
    previousStatus,
    newStatus,
    previousSubStatus,
    newSubStatus,
    changeSource = "manual",
    notes,
    metadata = {},
  } = payload;

  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    // Insert history record
    const { error } = await supabase.from("shipment_status_history").insert({
      shipment_id: shipmentId,
      previous_status: previousStatus,
      new_status: newStatus,
      previous_sub_status: previousSubStatus,
      new_sub_status: newSubStatus,
      changed_by: user?.id,
      change_source: changeSource,
      notes,
      metadata,
    });

    if (error) {
      console.error("Error logging status change:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error in logStatusChange:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Update shipment status with timestamp and history logging
 */
export async function updateShipmentStatus(
  shipmentId: string,
  currentStatus: ShipmentStatus,
  newStatus: ShipmentStatus,
  currentSubStatus?: string | null,
  newSubStatus?: string | null,
  options?: {
    changeSource?: ChangeSource;
    notes?: string;
    metadata?: Record<string, any>;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Build update payload
    const updatePayload: Record<string, any> = {
      status: newStatus,
    };

    // Add timestamp for the new status
    const timestampField = getTimestampFieldForStatus(newStatus);
    if (timestampField) {
      updatePayload[timestampField] = new Date().toISOString();
    }

    // Handle sub-status updates
    if (newSubStatus !== undefined) {
      updatePayload.sub_status = newSubStatus;
      
      // Add sub-status specific timestamp
      const subTimestampField = getSubStatusTimestampField(newSubStatus || "");
      if (subTimestampField) {
        updatePayload[subTimestampField] = new Date().toISOString();
      }
    }

    // Update the shipment
    const { error: updateError } = await supabase
      .from("shipments")
      .update(updatePayload)
      .eq("id", shipmentId);

    if (updateError) {
      console.error("Error updating shipment:", updateError);
      return { success: false, error: updateError.message };
    }

    // Log the status change
    await logStatusChange({
      shipmentId,
      previousStatus: currentStatus,
      newStatus,
      previousSubStatus: currentSubStatus,
      newSubStatus,
      changeSource: options?.changeSource,
      notes: options?.notes,
      metadata: options?.metadata,
    });

    return { success: true };
  } catch (err: any) {
    console.error("Error in updateShipmentStatus:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Update only the sub-status (within the same main status)
 */
export async function updateShipmentSubStatus(
  shipmentId: string,
  currentStatus: ShipmentStatus,
  currentSubStatus: string | null,
  newSubStatus: string,
  options?: {
    changeSource?: ChangeSource;
    notes?: string;
    metadata?: Record<string, any>;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const updatePayload: Record<string, any> = {
      sub_status: newSubStatus,
    };

    // Add sub-status specific timestamp
    const subTimestampField = getSubStatusTimestampField(newSubStatus);
    if (subTimestampField) {
      updatePayload[subTimestampField] = new Date().toISOString();
    }

    // Update the shipment
    const { error: updateError } = await supabase
      .from("shipments")
      .update(updatePayload)
      .eq("id", shipmentId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Log the sub-status change
    await logStatusChange({
      shipmentId,
      previousStatus: currentStatus,
      newStatus: currentStatus, // Same status
      previousSubStatus: currentSubStatus,
      newSubStatus,
      changeSource: options?.changeSource,
      notes: options?.notes,
      metadata: options?.metadata,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch status history for a shipment
 */
export async function getShipmentStatusHistory(shipmentId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("shipment_status_history")
    .select("*")
    .eq("shipment_id", shipmentId)
    .order("changed_at", { ascending: false });

  if (error) {
    console.error("Error fetching status history:", error);
    return [];
  }

  return data || [];
}

/**
 * Update delay tracking for a shipment
 */
export async function updateDelayTracking(
  shipmentId: string,
  delayPercentage: number,
  isDelayed: boolean
): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from("shipments")
    .update({
      delay_percentage: delayPercentage,
      is_delayed: isDelayed,
    })
    .eq("id", shipmentId);

  return { success: !error };
}
