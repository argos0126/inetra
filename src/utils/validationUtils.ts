import { supabase } from "@/integrations/supabase/client";

// Email validation
export const isValidEmail = (email: string): boolean => {
  if (!email) return true; // Optional field
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Phone/Mobile validation (Indian format)
export const isValidMobile = (mobile: string): boolean => {
  if (!mobile) return true; // Optional field
  const mobileRegex = /^[6-9]\d{9}$/;
  const cleanMobile = mobile.replace(/[\s\-+]/g, '').replace(/^91/, '');
  return mobileRegex.test(cleanMobile);
};

// GST number validation (Indian format)
export const isValidGST = (gst: string): boolean => {
  if (!gst) return true;
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstRegex.test(gst.toUpperCase());
};

// PAN validation (Indian format)
export const isValidPAN = (pan: string): boolean => {
  if (!pan) return true;
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan.toUpperCase());
};

// Vehicle number validation (Indian format)
// Supports: Standard plates (MH12AB1234), BH series (22BH1234AB)
export const isValidVehicleNumber = (vehicleNumber: string): boolean => {
  if (!vehicleNumber) return false;
  const cleaned = vehicleNumber.replace(/\s/g, '').toUpperCase();
  // Standard format: SS00XXX0000 (e.g., MH12AB1234, KA01A1234)
  const standardRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/;
  // BH (Bharat) series format: 00BH0000XX (e.g., 22BH1234AB)
  const bhRegex = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/;
  return standardRegex.test(cleaned) || bhRegex.test(cleaned);
};

// License number validation
export const isValidLicenseNumber = (license: string): boolean => {
  if (!license) return true;
  // Indian DL format: State code (2) + Year (2/4) + Number (7)
  const licenseRegex = /^[A-Z]{2}[0-9]{2,4}[0-9]{7,11}$/;
  return licenseRegex.test(license.replace(/[\s\-]/g, '').toUpperCase());
};

// Aadhaar validation
export const isValidAadhaar = (aadhaar: string): boolean => {
  if (!aadhaar) return true;
  const aadhaarRegex = /^\d{12}$/;
  return aadhaarRegex.test(aadhaar.replace(/\s/g, ''));
};

// Check if date is expired
export const isDateExpired = (dateString: string | null): boolean => {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date < new Date();
};

// Check if date expires within N days
export const expiresWithinDays = (dateString: string | null, days: number): boolean => {
  if (!dateString) return false;
  const date = new Date(dateString);
  const now = new Date();
  const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return date >= now && date <= futureDate;
};

// Unique validation functions
export const checkUniqueCustomerCode = async (
  integrationCode: string,
  excludeId?: string
): Promise<boolean> => {
  if (!integrationCode) return true;
  
  let query = supabase
    .from("customers")
    .select("id")
    .eq("integration_code", integrationCode);
  
  if (excludeId) {
    query = query.neq("id", excludeId);
  }
  
  const { data } = await query.limit(1);
  return !data || data.length === 0;
};

export const checkUniqueVehicleNumber = async (
  vehicleNumber: string,
  excludeId?: string
): Promise<boolean> => {
  if (!vehicleNumber) return true;
  
  let query = supabase
    .from("vehicles")
    .select("id")
    .ilike("vehicle_number", vehicleNumber.replace(/\s/g, ''));
  
  if (excludeId) {
    query = query.neq("id", excludeId);
  }
  
  const { data } = await query.limit(1);
  return !data || data.length === 0;
};

export const checkUniqueLicenseNumber = async (
  licenseNumber: string,
  excludeId?: string
): Promise<boolean> => {
  if (!licenseNumber) return true;
  
  let query = supabase
    .from("drivers")
    .select("id")
    .ilike("license_number", licenseNumber.replace(/[\s\-]/g, ''));
  
  if (excludeId) {
    query = query.neq("id", excludeId);
  }
  
  const { data } = await query.limit(1);
  return !data || data.length === 0;
};

export const checkUniqueDriverMobile = async (
  mobile: string,
  excludeId?: string
): Promise<boolean> => {
  if (!mobile) return true;
  
  const cleanMobile = mobile.replace(/[\s\-+]/g, '').replace(/^91/, '');
  
  let query = supabase
    .from("drivers")
    .select("id")
    .eq("mobile", cleanMobile);
  
  if (excludeId) {
    query = query.neq("id", excludeId);
  }
  
  const { data } = await query.limit(1);
  return !data || data.length === 0;
};

// Check unique Aadhaar number
export const checkUniqueDriverAadhaar = async (
  aadhaarNumber: string,
  excludeId?: string
): Promise<boolean> => {
  if (!aadhaarNumber) return true;
  
  const cleanAadhaar = aadhaarNumber.replace(/\s/g, '');
  
  let query = supabase
    .from("drivers")
    .select("id")
    .eq("aadhaar_number", cleanAadhaar);
  
  if (excludeId) {
    query = query.neq("id", excludeId);
  }
  
  const { data } = await query.limit(1);
  return !data || data.length === 0;
};

// Check unique PAN number for drivers
export const checkUniqueDriverPAN = async (
  panNumber: string,
  excludeId?: string
): Promise<boolean> => {
  if (!panNumber) return true;
  
  let query = supabase
    .from("drivers")
    .select("id")
    .ilike("pan_number", panNumber.trim().toUpperCase());
  
  if (excludeId) {
    query = query.neq("id", excludeId);
  }
  
  const { data } = await query.limit(1);
  return !data || data.length === 0;
};

// Check unique trip code
export const checkUniqueTripCode = async (
  tripCode: string,
  excludeId?: string
): Promise<boolean> => {
  if (!tripCode) return true;
  
  let query = supabase
    .from("trips")
    .select("id")
    .eq("trip_code", tripCode.trim());
  
  if (excludeId) {
    query = query.neq("id", excludeId);
  }
  
  const { data } = await query.limit(1);
  return !data || data.length === 0;
};

// Check unique shipment code
export const checkUniqueShipmentCode = async (
  shipmentCode: string,
  excludeId?: string
): Promise<boolean> => {
  if (!shipmentCode) return true;
  
  let query = supabase
    .from("shipments")
    .select("id")
    .eq("shipment_code", shipmentCode.trim());
  
  if (excludeId) {
    query = query.neq("id", excludeId);
  }
  
  const { data } = await query.limit(1);
  return !data || data.length === 0;
};

// Check unique transporter code
export const checkUniqueTransporterCode = async (
  code: string,
  excludeId?: string
): Promise<boolean> => {
  if (!code) return true;
  
  let query = supabase
    .from("transporters")
    .select("id")
    .ilike("code", code.trim());
  
  if (excludeId) {
    query = query.neq("id", excludeId);
  }
  
  const { data } = await query.limit(1);
  return !data || data.length === 0;
};

// Check unique transporter GSTIN
export const checkUniqueTransporterGSTIN = async (
  gstin: string,
  excludeId?: string
): Promise<boolean> => {
  if (!gstin) return true;
  
  let query = supabase
    .from("transporters")
    .select("id")
    .ilike("gstin", gstin.trim().toUpperCase());
  
  if (excludeId) {
    query = query.neq("id", excludeId);
  }
  
  const { data } = await query.limit(1);
  return !data || data.length === 0;
};

// Check unique transporter PAN
export const checkUniqueTransporterPAN = async (
  pan: string,
  excludeId?: string
): Promise<boolean> => {
  if (!pan) return true;
  
  let query = supabase
    .from("transporters")
    .select("id")
    .ilike("pan", pan.trim().toUpperCase());
  
  if (excludeId) {
    query = query.neq("id", excludeId);
  }
  
  const { data } = await query.limit(1);
  return !data || data.length === 0;
};

// Check unique tracking asset ID
export const checkUniqueTrackingAssetId = async (
  assetId: string,
  excludeId?: string
): Promise<boolean> => {
  if (!assetId) return true;
  
  let query = supabase
    .from("tracking_assets")
    .select("id")
    .eq("asset_id", assetId.trim());
  
  if (excludeId) {
    query = query.neq("id", excludeId);
  }
  
  const { data } = await query.limit(1);
  return !data || data.length === 0;
};

// Check unique location integration ID
export const checkUniqueLocationIntegrationId = async (
  integrationId: string,
  excludeId?: string
): Promise<boolean> => {
  if (!integrationId) return true;
  
  let query = supabase
    .from("locations")
    .select("id")
    .eq("integration_id", integrationId.trim());
  
  if (excludeId) {
    query = query.neq("id", excludeId);
  }
  
  const { data } = await query.limit(1);
  return !data || data.length === 0;
};

// Check unique lane code
export const checkUniqueLaneCode = async (
  laneCode: string,
  excludeId?: string
): Promise<boolean> => {
  if (!laneCode) return true;
  
  let query = supabase
    .from("serviceability_lanes")
    .select("id")
    .eq("lane_code", laneCode.trim());
  
  if (excludeId) {
    query = query.neq("id", excludeId);
  }
  
  const { data } = await query.limit(1);
  return !data || data.length === 0;
};

// Check unique material SKU code
export const checkUniqueMaterialSKU = async (
  skuCode: string,
  excludeId?: string
): Promise<boolean> => {
  if (!skuCode) return true;
  
  let query = supabase
    .from("materials")
    .select("id")
    .eq("sku_code", skuCode.trim());
  
  if (excludeId) {
    query = query.neq("id", excludeId);
  }
  
  const { data } = await query.limit(1);
  return !data || data.length === 0;
};

// Check unique user email across profiles and entities
export const checkUniqueUserEmail = async (
  email: string,
  excludeUserId?: string
): Promise<boolean> => {
  if (!email) return true;
  
  const normalizedEmail = email.trim().toLowerCase();
  
  // Check in customers table
  let customerQuery = supabase
    .from("customers")
    .select("id")
    .ilike("email", normalizedEmail);
  if (excludeUserId) {
    customerQuery = customerQuery.neq("user_id", excludeUserId);
  }
  const { data: customerData } = await customerQuery.limit(1);
  if (customerData && customerData.length > 0) return false;
  
  // Check in transporters table
  let transporterQuery = supabase
    .from("transporters")
    .select("id")
    .ilike("email", normalizedEmail);
  if (excludeUserId) {
    transporterQuery = transporterQuery.neq("user_id", excludeUserId);
  }
  const { data: transporterData } = await transporterQuery.limit(1);
  if (transporterData && transporterData.length > 0) return false;
  
  // Check in drivers table
  let driverQuery = supabase
    .from("drivers")
    .select("id")
    .ilike("email", normalizedEmail);
  if (excludeUserId) {
    driverQuery = driverQuery.neq("user_id", excludeUserId);
  }
  const { data: driverData } = await driverQuery.limit(1);
  if (driverData && driverData.length > 0) return false;
  
  return true;
};

// Check unique phone/mobile across entities
export const checkUniquePhone = async (
  phone: string,
  entityType: 'customer' | 'transporter' | 'driver',
  excludeId?: string
): Promise<boolean> => {
  if (!phone) return true;
  
  const cleanPhone = phone.replace(/[\s\-+]/g, '').replace(/^91/, '');
  
  let query;
  if (entityType === 'customer') {
    query = supabase.from("customers").select("id").eq("phone", cleanPhone);
  } else if (entityType === 'transporter') {
    query = supabase.from("transporters").select("id").eq("mobile", cleanPhone);
  } else {
    query = supabase.from("drivers").select("id").eq("mobile", cleanPhone);
  }
  
  if (excludeId) {
    query = query.neq("id", excludeId);
  }
  
  const { data } = await query.limit(1);
  return !data || data.length === 0;
};

// Check unique customer email
export const checkUniqueCustomerEmail = async (
  email: string,
  excludeId?: string
): Promise<boolean> => {
  if (!email) return true;
  
  let query = supabase
    .from("customers")
    .select("id")
    .ilike("email", email.trim().toLowerCase());
  
  if (excludeId) {
    query = query.neq("id", excludeId);
  }
  
  const { data } = await query.limit(1);
  return !data || data.length === 0;
};

// Check unique transporter email
export const checkUniqueTransporterEmail = async (
  email: string,
  excludeId?: string
): Promise<boolean> => {
  if (!email) return true;
  
  let query = supabase
    .from("transporters")
    .select("id")
    .ilike("email", email.trim().toLowerCase());
  
  if (excludeId) {
    query = query.neq("id", excludeId);
  }
  
  const { data } = await query.limit(1);
  return !data || data.length === 0;
};

// Check unique transporter mobile
export const checkUniqueTransporterMobile = async (
  mobile: string,
  excludeId?: string
): Promise<boolean> => {
  if (!mobile) return true;
  
  const cleanMobile = mobile.replace(/[\s\-+]/g, '').replace(/^91/, '');
  
  let query = supabase
    .from("transporters")
    .select("id")
    .eq("mobile", cleanMobile);
  
  if (excludeId) {
    query = query.neq("id", excludeId);
  }
  
  const { data } = await query.limit(1);
  return !data || data.length === 0;
};

// Check unique driver email
export const checkUniqueDriverEmail = async (
  email: string,
  excludeId?: string
): Promise<boolean> => {
  if (!email) return true;
  
  let query = supabase
    .from("drivers")
    .select("id")
    .ilike("email", email.trim().toLowerCase());
  
  if (excludeId) {
    query = query.neq("id", excludeId);
  }
  
  const { data } = await query.limit(1);
  return !data || data.length === 0;
};

export const checkTrackingAssetNotMappedToActiveVehicle = async (
  trackingAssetId: string,
  excludeVehicleId?: string
): Promise<{ isValid: boolean; mappedVehicle?: string }> => {
  if (!trackingAssetId) return { isValid: true };
  
  let query = supabase
    .from("vehicles")
    .select("id, vehicle_number")
    .eq("tracking_asset_id", trackingAssetId)
    .eq("is_active", true);
  
  if (excludeVehicleId) {
    query = query.neq("id", excludeVehicleId);
  }
  
  const { data } = await query.limit(1);
  
  if (data && data.length > 0) {
    return { isValid: false, mappedVehicle: data[0].vehicle_number };
  }
  
  return { isValid: true };
};

// Compliance validation for vehicles
export interface VehicleComplianceResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

export const validateVehicleCompliance = (vehicle: {
  insurance_expiry_date?: string | null;
  fitness_expiry_date?: string | null;
  permit_expiry_date?: string | null;
  puc_expiry_date?: string | null;
  rc_expiry_date?: string | null;
}): VehicleComplianceResult => {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Insurance check
  if (vehicle.insurance_expiry_date) {
    if (isDateExpired(vehicle.insurance_expiry_date)) {
      errors.push("Vehicle insurance has expired");
    } else if (expiresWithinDays(vehicle.insurance_expiry_date, 30)) {
      warnings.push("Vehicle insurance expires within 30 days");
    }
  }

  // Fitness check
  if (vehicle.fitness_expiry_date) {
    if (isDateExpired(vehicle.fitness_expiry_date)) {
      errors.push("Vehicle fitness certificate has expired");
    } else if (expiresWithinDays(vehicle.fitness_expiry_date, 30)) {
      warnings.push("Vehicle fitness certificate expires within 30 days");
    }
  }

  // Permit check
  if (vehicle.permit_expiry_date) {
    if (isDateExpired(vehicle.permit_expiry_date)) {
      errors.push("Vehicle permit has expired");
    } else if (expiresWithinDays(vehicle.permit_expiry_date, 30)) {
      warnings.push("Vehicle permit expires within 30 days");
    }
  }

  // PUC check
  if (vehicle.puc_expiry_date) {
    if (isDateExpired(vehicle.puc_expiry_date)) {
      errors.push("Vehicle PUC has expired");
    } else if (expiresWithinDays(vehicle.puc_expiry_date, 15)) {
      warnings.push("Vehicle PUC expires within 15 days");
    }
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors
  };
};

// Compliance validation for drivers
export interface DriverComplianceResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

export const validateDriverCompliance = (driver: {
  license_expiry_date?: string | null;
  police_verification_expiry?: string | null;
}): DriverComplianceResult => {
  const warnings: string[] = [];
  const errors: string[] = [];

  // License check
  if (driver.license_expiry_date) {
    if (isDateExpired(driver.license_expiry_date)) {
      errors.push("Driver license has expired");
    } else if (expiresWithinDays(driver.license_expiry_date, 30)) {
      warnings.push("Driver license expires within 30 days");
    }
  }

  // Police verification check
  if (driver.police_verification_expiry) {
    if (isDateExpired(driver.police_verification_expiry)) {
      warnings.push("Police verification has expired");
    } else if (expiresWithinDays(driver.police_verification_expiry, 30)) {
      warnings.push("Police verification expires within 30 days");
    }
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors
  };
};

// Form field error type
export type ValidationErrors = Record<string, string>;

// Validation result with async checks
export interface AsyncValidationResult {
  isValid: boolean;
  errors: ValidationErrors;
  warnings: string[];
}
