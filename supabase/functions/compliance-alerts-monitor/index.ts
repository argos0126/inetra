import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ComplianceSettings {
  warningDays: number;
  criticalDays: number;
}

interface ExpiringDocument {
  entityType: 'vehicle' | 'driver';
  entityId: string;
  documentType: string;
  expiryDate: string;
  alertLevel: 'warning' | 'critical' | 'expired';
}

async function getComplianceSettings(supabase: any): Promise<ComplianceSettings> {
  const { data } = await supabase
    .from('tracking_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['compliance_warning_days', 'compliance_critical_days']);

  const settings: ComplianceSettings = {
    warningDays: 30,
    criticalDays: 7
  };

  if (data) {
    for (const item of data) {
      if (item.setting_key === 'compliance_warning_days') {
        settings.warningDays = parseInt(item.setting_value) || 30;
      } else if (item.setting_key === 'compliance_critical_days') {
        settings.criticalDays = parseInt(item.setting_value) || 7;
      }
    }
  }

  return settings;
}

function getAlertLevel(expiryDate: string, settings: ComplianceSettings): 'warning' | 'critical' | 'expired' | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  
  const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiry < 0) {
    return 'expired';
  } else if (daysUntilExpiry <= settings.criticalDays) {
    return 'critical';
  } else if (daysUntilExpiry <= settings.warningDays) {
    return 'warning';
  }
  
  return null;
}

async function checkVehicleDocuments(supabase: any, settings: ComplianceSettings): Promise<ExpiringDocument[]> {
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('id, vehicle_number, rc_expiry_date, insurance_expiry_date, permit_expiry_date, fitness_expiry_date, puc_expiry_date')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching vehicles:', error);
    return [];
  }

  const expiringDocs: ExpiringDocument[] = [];

  const documentTypes = [
    { key: 'rc_expiry_date', name: 'RC' },
    { key: 'insurance_expiry_date', name: 'Insurance' },
    { key: 'permit_expiry_date', name: 'Permit' },
    { key: 'fitness_expiry_date', name: 'Fitness' },
    { key: 'puc_expiry_date', name: 'PUC' }
  ];

  for (const vehicle of vehicles || []) {
    for (const docType of documentTypes) {
      const expiryDate = vehicle[docType.key];
      if (expiryDate) {
        const alertLevel = getAlertLevel(expiryDate, settings);
        if (alertLevel) {
          expiringDocs.push({
            entityType: 'vehicle',
            entityId: vehicle.id,
            documentType: docType.name,
            expiryDate,
            alertLevel
          });
        }
      }
    }
  }

  return expiringDocs;
}

async function checkDriverDocuments(supabase: any, settings: ComplianceSettings): Promise<ExpiringDocument[]> {
  const { data: drivers, error } = await supabase
    .from('drivers')
    .select('id, name, license_expiry_date, police_verification_expiry')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching drivers:', error);
    return [];
  }

  const expiringDocs: ExpiringDocument[] = [];

  const documentTypes = [
    { key: 'license_expiry_date', name: 'License' },
    { key: 'police_verification_expiry', name: 'Police Verification' }
  ];

  for (const driver of drivers || []) {
    for (const docType of documentTypes) {
      const expiryDate = driver[docType.key];
      if (expiryDate) {
        const alertLevel = getAlertLevel(expiryDate, settings);
        if (alertLevel) {
          expiringDocs.push({
            entityType: 'driver',
            entityId: driver.id,
            documentType: docType.name,
            expiryDate,
            alertLevel
          });
        }
      }
    }
  }

  return expiringDocs;
}

async function upsertAlerts(supabase: any, documents: ExpiringDocument[]): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const doc of documents) {
    // Check if alert already exists
    const { data: existing } = await supabase
      .from('compliance_alerts')
      .select('id, alert_level, status')
      .eq('entity_type', doc.entityType)
      .eq('entity_id', doc.entityId)
      .eq('document_type', doc.documentType)
      .neq('status', 'resolved')
      .maybeSingle();

    if (existing) {
      // Update if alert level changed
      if (existing.alert_level !== doc.alertLevel) {
        await supabase
          .from('compliance_alerts')
          .update({
            alert_level: doc.alertLevel,
            expiry_date: doc.expiryDate,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
        updated++;
      }
    } else {
      // Create new alert
      await supabase
        .from('compliance_alerts')
        .insert({
          entity_type: doc.entityType,
          entity_id: doc.entityId,
          document_type: doc.documentType,
          expiry_date: doc.expiryDate,
          alert_level: doc.alertLevel
        });
      created++;
    }
  }

  return { created, updated };
}

async function resolveStaleAlerts(supabase: any, settings: ComplianceSettings): Promise<number> {
  // Get all active alerts
  const { data: activeAlerts } = await supabase
    .from('compliance_alerts')
    .select('id, entity_type, entity_id, document_type, expiry_date')
    .eq('status', 'active');

  if (!activeAlerts || activeAlerts.length === 0) return 0;

  let resolved = 0;
  const now = new Date().toISOString();

  for (const alert of activeAlerts) {
    // Check if the document is no longer expiring (e.g., renewed)
    let currentExpiryDate: string | null = null;

    if (alert.entity_type === 'vehicle') {
      const docKeyMap: Record<string, string> = {
        'RC': 'rc_expiry_date',
        'Insurance': 'insurance_expiry_date',
        'Permit': 'permit_expiry_date',
        'Fitness': 'fitness_expiry_date',
        'PUC': 'puc_expiry_date'
      };
      
      const column = docKeyMap[alert.document_type];
      if (column) {
        const { data: vehicle } = await supabase
          .from('vehicles')
          .select(column)
          .eq('id', alert.entity_id)
          .maybeSingle();
        
        currentExpiryDate = vehicle?.[column];
      }
    } else if (alert.entity_type === 'driver') {
      const docKeyMap: Record<string, string> = {
        'License': 'license_expiry_date',
        'Police Verification': 'police_verification_expiry'
      };
      
      const column = docKeyMap[alert.document_type];
      if (column) {
        const { data: driver } = await supabase
          .from('drivers')
          .select(column)
          .eq('id', alert.entity_id)
          .maybeSingle();
        
        currentExpiryDate = driver?.[column];
      }
    }

    // If document was renewed (new expiry date is different and not triggering alert)
    if (currentExpiryDate && currentExpiryDate !== alert.expiry_date) {
      const newAlertLevel = getAlertLevel(currentExpiryDate, settings);
      if (!newAlertLevel) {
        // Document is no longer expiring, resolve the alert
        await supabase
          .from('compliance_alerts')
          .update({
            status: 'resolved',
            resolved_at: now,
            updated_at: now
          })
          .eq('id', alert.id);
        resolved++;
      }
    }
  }

  return resolved;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting compliance alerts monitor...');

    // Get settings
    const settings = await getComplianceSettings(supabase);
    console.log('Settings:', settings);

    // Check all documents
    const vehicleDocs = await checkVehicleDocuments(supabase, settings);
    const driverDocs = await checkDriverDocuments(supabase, settings);
    const allDocs = [...vehicleDocs, ...driverDocs];

    console.log(`Found ${vehicleDocs.length} vehicle alerts, ${driverDocs.length} driver alerts`);

    // Upsert alerts
    const { created, updated } = await upsertAlerts(supabase, allDocs);

    // Resolve stale alerts (documents that were renewed)
    const resolved = await resolveStaleAlerts(supabase, settings);

    const summary = {
      vehicleAlerts: vehicleDocs.length,
      driverAlerts: driverDocs.length,
      alertsCreated: created,
      alertsUpdated: updated,
      alertsResolved: resolved,
      byLevel: {
        expired: allDocs.filter(d => d.alertLevel === 'expired').length,
        critical: allDocs.filter(d => d.alertLevel === 'critical').length,
        warning: allDocs.filter(d => d.alertLevel === 'warning').length
      }
    };

    console.log('Compliance check completed:', summary);

    return new Response(
      JSON.stringify({ success: true, summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in compliance alerts monitor:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});