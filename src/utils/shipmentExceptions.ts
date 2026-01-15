import { supabase } from "@/integrations/supabase/client";

export type ExceptionType = 
  | 'duplicate_mapping'
  | 'capacity_exceeded'
  | 'vehicle_not_arrived'
  | 'loading_discrepancy'
  | 'tracking_unavailable'
  | 'ndr_consignee_unavailable'
  | 'pod_rejected'
  | 'invoice_dispute'
  | 'delay_exceeded'
  | 'weight_mismatch'
  | 'other';

export type ExceptionStatus = 'open' | 'acknowledged' | 'resolved' | 'escalated';

export type ExceptionSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ShipmentException {
  id: string;
  shipment_id: string;
  exception_type: ExceptionType;
  status: ExceptionStatus;
  severity: ExceptionSeverity;
  description: string;
  resolution_path?: string;
  resolution_notes?: string;
  detected_at: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  resolved_at?: string;
  resolved_by?: string;
  escalated_at?: string;
  escalated_to?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Exception type configurations with default descriptions and resolution paths
export const exceptionConfig: Record<ExceptionType, {
  label: string;
  defaultSeverity: ExceptionSeverity;
  resolutionPath: string;
  icon: string;
}> = {
  duplicate_mapping: {
    label: 'Duplicate Mapping',
    defaultSeverity: 'high',
    resolutionPath: 'Ops fixes duplicate, system logs error',
    icon: 'Copy'
  },
  capacity_exceeded: {
    label: 'Vehicle Over-Capacity',
    defaultSeverity: 'high',
    resolutionPath: 'Suggest alternative vehicle or split shipment',
    icon: 'Scale'
  },
  vehicle_not_arrived: {
    label: 'Vehicle Not Arrived at Pickup',
    defaultSeverity: 'medium',
    resolutionPath: 'Alert Ops, escalate to transporter',
    icon: 'Truck'
  },
  loading_discrepancy: {
    label: 'Loading Discrepancy',
    defaultSeverity: 'medium',
    resolutionPath: 'Ops to adjust shipment record before dispatch',
    icon: 'Scale'
  },
  tracking_unavailable: {
    label: 'GPS/SIM Tracking Not Available',
    defaultSeverity: 'medium',
    resolutionPath: 'Switch to manual location update via UI',
    icon: 'MapPinOff'
  },
  ndr_consignee_unavailable: {
    label: 'Consignee Not Available (NDR)',
    defaultSeverity: 'medium',
    resolutionPath: 'Reschedule or return',
    icon: 'UserX'
  },
  pod_rejected: {
    label: 'POD Rejected',
    defaultSeverity: 'medium',
    resolutionPath: 'Ops to re-upload correct POD',
    icon: 'FileX'
  },
  invoice_dispute: {
    label: 'Invoice Dispute',
    defaultSeverity: 'high',
    resolutionPath: 'Finance resolves; no closure until resolved',
    icon: 'Receipt'
  },
  delay_exceeded: {
    label: 'Delay Threshold Exceeded',
    defaultSeverity: 'medium',
    resolutionPath: 'Investigate delay reason, update ETA',
    icon: 'Clock'
  },
  weight_mismatch: {
    label: 'Weight Mismatch',
    defaultSeverity: 'medium',
    resolutionPath: 'Verify actual weight, update shipment',
    icon: 'Scale'
  },
  other: {
    label: 'Other Exception',
    defaultSeverity: 'low',
    resolutionPath: 'Review and take appropriate action',
    icon: 'AlertCircle'
  }
};

// Log a new exception
export async function logException(
  shipmentId: string,
  exceptionType: ExceptionType,
  description: string,
  options?: {
    severity?: ExceptionSeverity;
    metadata?: Record<string, any>;
    resolutionPath?: string;
  }
): Promise<{ success: boolean; exception?: ShipmentException; error?: string }> {
  const config = exceptionConfig[exceptionType];
  
  const { data, error } = await supabase
    .from('shipment_exceptions')
    .insert({
      shipment_id: shipmentId,
      exception_type: exceptionType,
      status: 'open',
      severity: options?.severity || config.defaultSeverity,
      description,
      resolution_path: options?.resolutionPath || config.resolutionPath,
      metadata: options?.metadata || {}
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to log exception:', error);
    return { success: false, error: error.message };
  }

  // Update shipment exception counts
  await updateShipmentExceptionCounts(shipmentId);

  return { success: true, exception: data as ShipmentException };
}

// Update exception status
export async function updateExceptionStatus(
  exceptionId: string,
  newStatus: ExceptionStatus,
  options?: {
    resolutionNotes?: string;
    escalatedTo?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const updateData: Record<string, any> = { status: newStatus };

  if (newStatus === 'acknowledged') {
    updateData.acknowledged_at = new Date().toISOString();
  } else if (newStatus === 'resolved') {
    updateData.resolved_at = new Date().toISOString();
    if (options?.resolutionNotes) {
      updateData.resolution_notes = options.resolutionNotes;
    }
  } else if (newStatus === 'escalated') {
    updateData.escalated_at = new Date().toISOString();
    if (options?.escalatedTo) {
      updateData.escalated_to = options.escalatedTo;
    }
  }

  const { data, error } = await supabase
    .from('shipment_exceptions')
    .update(updateData)
    .eq('id', exceptionId)
    .select('shipment_id')
    .single();

  if (error) {
    console.error('Failed to update exception:', error);
    return { success: false, error: error.message };
  }

  // Update shipment exception counts
  if (data?.shipment_id) {
    await updateShipmentExceptionCounts(data.shipment_id);
  }

  return { success: true };
}

// Get exceptions for a shipment
export async function getShipmentExceptions(
  shipmentId: string
): Promise<ShipmentException[]> {
  const { data, error } = await supabase
    .from('shipment_exceptions')
    .select('*')
    .eq('shipment_id', shipmentId)
    .order('detected_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch exceptions:', error);
    return [];
  }

  return data as ShipmentException[];
}

// Update exception counts on shipment
async function updateShipmentExceptionCounts(shipmentId: string): Promise<void> {
  const { data, error } = await supabase
    .from('shipment_exceptions')
    .select('status')
    .eq('shipment_id', shipmentId);

  if (error) {
    console.error('Failed to count exceptions:', error);
    return;
  }

  const exceptionCount = data?.length || 0;
  const hasOpenException = data?.some(e => e.status === 'open' || e.status === 'escalated') || false;

  await supabase
    .from('shipments')
    .update({
      exception_count: exceptionCount,
      has_open_exception: hasOpenException
    })
    .eq('id', shipmentId);
}

// Check for duplicate mapping exception
export async function checkDuplicateMapping(
  shipmentId: string,
  tripId: string
): Promise<{ isDuplicate: boolean; existingTripId?: string }> {
  const { data } = await supabase
    .from('trip_shipment_map')
    .select('trip_id')
    .eq('shipment_id', shipmentId)
    .neq('trip_id', tripId);

  if (data && data.length > 0) {
    await logException(shipmentId, 'duplicate_mapping', 
      `Shipment already mapped to trip. Rejected mapping to trip ${tripId}.`,
      { metadata: { attempted_trip_id: tripId, existing_trip_id: data[0].trip_id } }
    );
    return { isDuplicate: true, existingTripId: data[0].trip_id };
  }

  return { isDuplicate: false };
}

// Check for capacity exceeded exception
export async function checkCapacityExceeded(
  tripId: string,
  newShipmentWeight: number,
  newShipmentVolume: number
): Promise<{ exceeded: boolean; details?: any }> {
  // Get trip vehicle capacity
  const { data: trip } = await supabase
    .from('trips')
    .select(`
      vehicle_id,
      vehicles!trips_vehicle_id_fkey (
        vehicle_type_id,
        vehicle_types!vehicles_vehicle_type_id_fkey (
          weight_capacity_kg,
          volume_capacity_cbm
        )
      )
    `)
    .eq('id', tripId)
    .single();

  if (!trip?.vehicles?.vehicle_types) {
    return { exceeded: false };
  }

  const vehicleType = trip.vehicles.vehicle_types;
  
  // Get current shipments on trip
  const { data: mappedShipments } = await supabase
    .from('shipments')
    .select('weight_kg, volume_cbm')
    .eq('trip_id', tripId);

  const currentWeight = mappedShipments?.reduce((sum, s) => sum + (s.weight_kg || 0), 0) || 0;
  const currentVolume = mappedShipments?.reduce((sum, s) => sum + (s.volume_cbm || 0), 0) || 0;

  const totalWeight = currentWeight + newShipmentWeight;
  const totalVolume = currentVolume + newShipmentVolume;

  const weightExceeded = vehicleType.weight_capacity_kg && totalWeight > vehicleType.weight_capacity_kg;
  const volumeExceeded = vehicleType.volume_capacity_cbm && totalVolume > vehicleType.volume_capacity_cbm;

  if (weightExceeded || volumeExceeded) {
    return {
      exceeded: true,
      details: {
        weightCapacity: vehicleType.weight_capacity_kg,
        volumeCapacity: vehicleType.volume_capacity_cbm,
        currentWeight,
        currentVolume,
        newWeight: newShipmentWeight,
        newVolume: newShipmentVolume,
        totalWeight,
        totalVolume
      }
    };
  }

  return { exceeded: false };
}

// Detect and log vehicle not arrived exception
export async function detectVehicleNotArrived(
  shipmentId: string,
  pickupPlannedTime: string,
  thresholdMinutes: number = 60
): Promise<boolean> {
  const plannedTime = new Date(pickupPlannedTime);
  const now = new Date();
  const diffMinutes = (now.getTime() - plannedTime.getTime()) / (1000 * 60);

  if (diffMinutes > thresholdMinutes) {
    await logException(shipmentId, 'vehicle_not_arrived',
      `Vehicle has not arrived at pickup point. Planned time was ${plannedTime.toLocaleString()}, now ${Math.round(diffMinutes)} minutes overdue.`,
      { 
        severity: diffMinutes > 120 ? 'high' : 'medium',
        metadata: { plannedTime: pickupPlannedTime, overdueMinutes: diffMinutes }
      }
    );
    return true;
  }

  return false;
}

// Log tracking unavailable exception
export async function logTrackingUnavailable(
  shipmentId: string,
  reason: string
): Promise<void> {
  await logException(shipmentId, 'tracking_unavailable',
    `GPS/SIM tracking not available: ${reason}. Trip is untracked.`,
    { metadata: { reason } }
  );
}

// Log NDR (Non-Delivery Report) exception
export async function logNDRException(
  shipmentId: string,
  ndrReason: string
): Promise<void> {
  await logException(shipmentId, 'ndr_consignee_unavailable',
    `Delivery attempted but failed: ${ndrReason}`,
    { 
      severity: 'medium',
      metadata: { ndr_reason: ndrReason }
    }
  );
}

// Log delay exceeded exception
export async function logDelayException(
  shipmentId: string,
  delayPercentage: number,
  plannedTime: string,
  actualTime: string
): Promise<void> {
  await logException(shipmentId, 'delay_exceeded',
    `Shipment delayed by ${delayPercentage.toFixed(1)}%. Planned: ${new Date(plannedTime).toLocaleString()}, Actual: ${new Date(actualTime).toLocaleString()}`,
    {
      severity: delayPercentage > 30 ? 'high' : 'medium',
      metadata: { delay_percentage: delayPercentage, planned_time: plannedTime, actual_time: actualTime }
    }
  );
}
