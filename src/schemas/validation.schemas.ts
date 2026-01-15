import { z } from 'zod';

// Indian phone number regex
const indianPhoneRegex = /^[6-9]\d{9}$/;

// GST number regex
const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// PAN number regex
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

// Aadhaar number regex
const aadhaarRegex = /^\d{12}$/;

// Indian vehicle number regex
const vehicleNumberRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$/i;

// Email regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Pincode regex
const pincodeRegex = /^\d{6}$/;

// Customer schema for bulk import validation
export const customerBulkImportSchema = z.object({
  display_name: z.string()
    .min(2, "Display name must be at least 2 characters")
    .max(200, "Display name must be less than 200 characters")
    .transform(val => val.trim()),
  company_name: z.string().max(200).optional().nullable(),
  email: z.string()
    .regex(emailRegex, "Invalid email format")
    .max(100, "Email must be less than 100 characters")
    .optional()
    .nullable()
    .or(z.literal('')),
  phone: z.string()
    .regex(indianPhoneRegex, "Phone must be a valid 10-digit Indian number")
    .optional()
    .nullable()
    .or(z.literal('')),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  pincode: z.string()
    .regex(pincodeRegex, "Pincode must be 6 digits")
    .optional()
    .nullable()
    .or(z.literal('')),
  gst_number: z.string()
    .regex(gstRegex, "Invalid GST number format")
    .optional()
    .nullable()
    .or(z.literal('')),
  pan_number: z.string()
    .regex(panRegex, "Invalid PAN format")
    .optional()
    .nullable()
    .or(z.literal('')),
  integration_code: z.string().max(50).optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

// Driver schema for bulk import validation
export const driverBulkImportSchema = z.object({
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(200, "Name must be less than 200 characters")
    .transform(val => val.trim()),
  mobile: z.string()
    .regex(indianPhoneRegex, "Valid 10-digit Indian mobile number required"),
  license_number: z.string().max(50).optional().nullable(),
  license_issue_date: z.string().optional().nullable(),
  license_expiry_date: z.string().optional().nullable(),
  aadhaar_number: z.string()
    .regex(aadhaarRegex, "Aadhaar must be 12 digits")
    .optional()
    .nullable()
    .or(z.literal('')),
  pan_number: z.string()
    .regex(panRegex, "Invalid PAN format")
    .optional()
    .nullable()
    .or(z.literal('')),
  voter_id: z.string().max(50).optional().nullable(),
  passport_number: z.string().max(50).optional().nullable(),
  location_code: z.string().max(50).optional().nullable(),
  is_dedicated: z.boolean().optional().default(false),
  is_active: z.boolean().optional().default(true),
});

// Vehicle schema for bulk import validation
export const vehicleBulkImportSchema = z.object({
  vehicle_number: z.string()
    .min(4, "Vehicle number is required (min 4 characters)")
    .max(20, "Vehicle number must be less than 20 characters")
    .regex(vehicleNumberRegex, "Invalid vehicle number format")
    .transform(val => val.toUpperCase().replace(/\s/g, '')),
  make: z.string().max(50).optional().nullable(),
  model: z.string().max(50).optional().nullable(),
  year: z.number()
    .int()
    .min(1900, "Year must be after 1900")
    .max(new Date().getFullYear() + 1, "Year cannot be in the future")
    .optional()
    .nullable(),
  rc_number: z.string().max(50).optional().nullable(),
  rc_issue_date: z.string().optional().nullable(),
  rc_expiry_date: z.string().optional().nullable(),
  insurance_number: z.string().max(50).optional().nullable(),
  insurance_issue_date: z.string().optional().nullable(),
  insurance_expiry_date: z.string().optional().nullable(),
  fitness_number: z.string().max(50).optional().nullable(),
  fitness_issue_date: z.string().optional().nullable(),
  fitness_expiry_date: z.string().optional().nullable(),
  permit_number: z.string().max(50).optional().nullable(),
  permit_issue_date: z.string().optional().nullable(),
  permit_expiry_date: z.string().optional().nullable(),
  puc_number: z.string().max(50).optional().nullable(),
  puc_issue_date: z.string().optional().nullable(),
  puc_expiry_date: z.string().optional().nullable(),
  location_code: z.string().max(50).optional().nullable(),
  integration_code: z.string().max(50).optional().nullable(),
  is_dedicated: z.boolean().optional().default(false),
  is_active: z.boolean().optional().default(true),
});

// Shipment schema for bulk import validation
export const shipmentBulkImportSchema = z.object({
  shipment_code: z.string()
    .min(1, "Shipment code is required")
    .max(50, "Shipment code must be less than 50 characters")
    .transform(val => val.trim()),
  lr_number: z.string().max(50).optional().nullable(),
  waybill_number: z.string().max(50).optional().nullable(),
  order_id: z.string().max(50).optional().nullable(),
  consignee_code: z.string().max(50).optional().nullable(),
  shipment_type: z.string()
    .transform(val => val?.toLowerCase().replace(/[\s-]/g, '_') || 'single_single')
    .pipe(z.enum(['single_single', 'single_multi', 'multi_single', 'multi_multi']))
    .optional()
    .default('single_single'),
  customer_display_name: z.string().min(1, "Customer is required").optional(),
  pickup_location_name: z.string().min(1, "Pickup location is required").optional(),
  drop_location_name: z.string().min(1, "Drop location is required").optional(),
  quantity: z.number().int().positive("Quantity must be positive").optional().nullable(),
  weight_kg: z.number().positive("Weight must be positive").optional().nullable(),
  volume_cbm: z.number().positive("Volume must be positive").optional().nullable(),
  length_cm: z.number().positive("Length must be positive").optional().nullable(),
  breadth_cm: z.number().positive("Breadth must be positive").optional().nullable(),
  height_cm: z.number().positive("Height must be positive").optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

// Trip schema for bulk import validation
export const tripBulkImportSchema = z.object({
  trip_code: z.string()
    .min(3, "Trip code must be at least 3 characters")
    .max(50, "Trip code must be less than 50 characters")
    .transform(val => val.trim())
    .optional(),
  consignee_name: z.string().max(200).optional().nullable(),
  planned_start_time: z.string().optional().nullable(),
  planned_end_time: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

// Helper function to validate and transform CSV row data for customer
export function validateCustomerRow(row: Record<string, string>): { 
  success: boolean; 
  data?: z.infer<typeof customerBulkImportSchema>; 
  error?: string 
} {
  try {
    const data = customerBulkImportSchema.parse({
      display_name: row.display_name,
      company_name: row.company_name || null,
      email: row.email || null,
      phone: row.phone || null,
      address: row.address || null,
      city: row.city || null,
      state: row.state || null,
      pincode: row.pincode || null,
      gst_number: row.gst_number?.toUpperCase() || null,
      pan_number: row.pan_number?.toUpperCase() || null,
      integration_code: row.integration_code || null,
      is_active: row.is_active?.toLowerCase() !== 'false',
    });
    return { success: true, data };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.errors[0].message };
    }
    return { success: false, error: 'Validation failed' };
  }
}

// Helper function to validate and transform CSV row data for driver
export function validateDriverRow(row: Record<string, string>): { 
  success: boolean; 
  data?: z.infer<typeof driverBulkImportSchema>; 
  error?: string 
} {
  try {
    const data = driverBulkImportSchema.parse({
      name: row.name,
      mobile: row.mobile,
      license_number: row.license_number || null,
      license_issue_date: row.license_issue_date || null,
      license_expiry_date: row.license_expiry_date || null,
      aadhaar_number: row.aadhaar_number || null,
      pan_number: row.pan_number?.toUpperCase() || null,
      voter_id: row.voter_id || null,
      passport_number: row.passport_number || null,
      location_code: row.location_code || null,
      is_dedicated: row.is_dedicated?.toLowerCase() === 'true',
      is_active: row.is_active?.toLowerCase() !== 'false',
    });
    return { success: true, data };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.errors[0].message };
    }
    return { success: false, error: 'Validation failed' };
  }
}

// Helper function to validate and transform CSV row data for vehicle
export function validateVehicleRow(row: Record<string, string>): { 
  success: boolean; 
  data?: z.infer<typeof vehicleBulkImportSchema>; 
  error?: string 
} {
  try {
    const data = vehicleBulkImportSchema.parse({
      vehicle_number: row.vehicle_number,
      make: row.make || null,
      model: row.model || null,
      year: row.year ? parseInt(row.year) : null,
      rc_number: row.rc_number || null,
      rc_issue_date: row.rc_issue_date || null,
      rc_expiry_date: row.rc_expiry_date || null,
      insurance_number: row.insurance_number || null,
      insurance_issue_date: row.insurance_issue_date || null,
      insurance_expiry_date: row.insurance_expiry_date || null,
      fitness_number: row.fitness_number || null,
      fitness_issue_date: row.fitness_issue_date || null,
      fitness_expiry_date: row.fitness_expiry_date || null,
      permit_number: row.permit_number || null,
      permit_issue_date: row.permit_issue_date || null,
      permit_expiry_date: row.permit_expiry_date || null,
      puc_number: row.puc_number || null,
      puc_issue_date: row.puc_issue_date || null,
      puc_expiry_date: row.puc_expiry_date || null,
      location_code: row.location_code || null,
      integration_code: row.integration_code || null,
      is_dedicated: row.is_dedicated?.toLowerCase() === 'true',
      is_active: row.is_active?.toLowerCase() !== 'false',
    });
    return { success: true, data };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.errors[0].message };
    }
    return { success: false, error: 'Validation failed' };
  }
}

// Helper function to validate and transform CSV row data for shipment
export function validateShipmentRow(row: Record<string, string>): { 
  success: boolean; 
  data?: z.infer<typeof shipmentBulkImportSchema>; 
  error?: string 
} {
  try {
    const data = shipmentBulkImportSchema.parse({
      shipment_code: row.shipment_code,
      lr_number: row.lr_number || null,
      waybill_number: row.waybill_number || null,
      order_id: row.order_id || null,
      consignee_code: row.consignee_code || null,
      shipment_type: row.shipment_type || 'single_single',
      customer_display_name: row.customer_display_name || undefined,
      pickup_location_name: row.pickup_location_name || undefined,
      drop_location_name: row.drop_location_name || undefined,
      quantity: row.quantity ? parseInt(row.quantity) : null,
      weight_kg: row.weight_kg ? parseFloat(row.weight_kg) : null,
      volume_cbm: row.volume_cbm ? parseFloat(row.volume_cbm) : null,
      length_cm: row.length_cm ? parseFloat(row.length_cm) : null,
      breadth_cm: row.breadth_cm ? parseFloat(row.breadth_cm) : null,
      height_cm: row.height_cm ? parseFloat(row.height_cm) : null,
      notes: row.notes || null,
    });
    return { success: true, data };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.errors[0].message };
    }
    return { success: false, error: 'Validation failed' };
  }
}
