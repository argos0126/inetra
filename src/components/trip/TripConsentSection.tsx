import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, XCircle, Clock, Send, RefreshCw, Smartphone, MapPin, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Driver {
  id: string;
  name: string;
  mobile: string;
}

interface Vehicle {
  id: string;
  vehicle_number: string;
  tracking_asset_id: string | null;
}

interface TrackingAsset {
  id: string;
  display_name: string;
  asset_type: 'gps' | 'sim' | 'whatsapp' | 'driver_app';
  is_active: boolean;
}

interface ConsentRecord {
  id: string;
  consent_status: 'pending' | 'allowed' | 'not_allowed' | 'expired';
  entity_id: string | null;
  msisdn: string;
  consent_requested_at: string | null;
}

interface TripConsentSectionProps {
  driverId: string | null;
  vehicleId: string | null;
  drivers: Driver[];
  vehicles: Vehicle[];
  onConsentReady: (consentId: string | null, trackingType: 'gps' | 'sim' | null) => void;
}

type TrackingType = 'gps' | 'sim' | null;

export function TripConsentSection({ 
  driverId, 
  vehicleId, 
  drivers, 
  vehicles,
  onConsentReady 
}: TripConsentSectionProps) {
  const { toast } = useToast();
  const [trackingType, setTrackingType] = useState<TrackingType>(null);
  const [trackingAsset, setTrackingAsset] = useState<TrackingAsset | null>(null);
  const [consentRecord, setConsentRecord] = useState<ConsentRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingConsent, setCheckingConsent] = useState(false);

  const selectedDriver = drivers.find(d => d.id === driverId);
  const selectedVehicle = vehicles.find(v => v.id === vehicleId);

  // Determine tracking type when vehicle changes
  useEffect(() => {
    const determineTrackingType = async () => {
      if (!vehicleId) {
        setTrackingType(null);
        setTrackingAsset(null);
        onConsentReady(null, null);
        return;
      }

      const vehicle = vehicles.find(v => v.id === vehicleId);
      if (!vehicle?.tracking_asset_id) {
        // No GPS on vehicle, will need SIM tracking
        setTrackingType('sim');
        setTrackingAsset(null);
        // Check if driver has existing consent
        if (driverId) {
          await checkExistingConsent();
        }
        return;
      }

      // Vehicle has tracking asset, check its type
      const { data: asset, error } = await supabase
        .from('tracking_assets')
        .select('id, display_name, asset_type, is_active')
        .eq('id', vehicle.tracking_asset_id)
        .single();

      if (error || !asset) {
        setTrackingType('sim');
        setTrackingAsset(null);
        return;
      }

      setTrackingAsset(asset);
      
      if (asset.asset_type === 'gps' && asset.is_active) {
        setTrackingType('gps');
        onConsentReady(null, 'gps');
      } else if (asset.asset_type === 'sim') {
        setTrackingType('sim');
        if (driverId) {
          await checkExistingConsent();
        }
      } else {
        setTrackingType('sim');
      }
    };

    determineTrackingType();
  }, [vehicleId, vehicles]);

  // Check consent when driver changes
  useEffect(() => {
    if (trackingType === 'sim' && driverId) {
      // Reset consent state immediately when driver changes
      setConsentRecord(null);
      onConsentReady(null, 'sim');
      // Then check for existing consent
      checkExistingConsent();
    } else if (!driverId) {
      setConsentRecord(null);
      if (trackingType === 'sim') {
        onConsentReady(null, 'sim');
      }
    }
  }, [driverId, trackingType]);

  const checkExistingConsent = async () => {
    if (!driverId || !selectedDriver) {
      onConsentReady(null, 'sim');
      return;
    }

    try {
      // Check for existing valid consent for this driver
      const { data: existingConsent, error } = await supabase
        .from('driver_consents')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && existingConsent) {
        setConsentRecord(existingConsent);
        
        if (existingConsent.consent_status === 'allowed') {
          onConsentReady(existingConsent.id, 'sim');
        } else {
          // Consent exists but not allowed - notify parent
          onConsentReady(null, 'sim');
        }
      } else {
        setConsentRecord(null);
        // No consent record - notify parent that SIM tracking needs consent
        onConsentReady(null, 'sim');
      }
    } catch (error) {
      console.error('Error checking existing consent:', error);
      onConsentReady(null, 'sim');
    }
  };

  const handleRequestConsent = async () => {
    if (!selectedDriver) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('telenity-tracking/import', {
        body: {
          msisdn: selectedDriver.mobile,
          driverName: selectedDriver.name,
          driverId: selectedDriver.id
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to send consent SMS. Please try again.');
      }

      if (!data) {
        throw new Error('No response from consent service');
      }

      const status = data.status || 'pending';
      const consentRecordData = data.consentRecord;

      if (consentRecordData) {
        setConsentRecord(consentRecordData);
      }

      // If consent is already allowed, notify parent immediately
      if (status === 'allowed') {
        toast({
          title: "Consent Already Active",
          description: data.message || "Driver has already granted location tracking consent.",
        });
        if (consentRecordData) {
          onConsentReady(consentRecordData.id, 'sim');
        }
      } else if (data.alreadyExists) {
        toast({
          title: "Consent Pending",
          description: data.message || "Waiting for driver to approve consent via SMS. Driver will receive an SMS from the tracking service.",
        });
      } else {
        toast({
          title: "Consent SMS Sent",
          description: "Driver will receive an SMS from the tracking service to approve location sharing.",
        });
      }
    } catch (error: any) {
      console.error('Consent request error:', error);
      const errorMessage = error.message?.includes('token') 
        ? 'Tracking service authentication failed. Please contact support.'
        : error.message || "Failed to send consent request. Please try again.";
      toast({
        title: "Consent Request Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckConsent = async () => {
    if (!consentRecord || !selectedDriver) return;

    setCheckingConsent(true);
    try {
      const params = new URLSearchParams({
        msisdn: selectedDriver.mobile,
        consentId: consentRecord.id
      });
      if (consentRecord.entity_id) {
        params.append('entityId', consentRecord.entity_id);
      }

      const { data, error } = await supabase.functions.invoke(
        `telenity-tracking/check-consent?${params.toString()}`,
        { method: 'GET' }
      );

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to check consent status');
      }

      if (!data) {
        throw new Error('No response from consent service');
      }

      // Refresh consent record from database
      const { data: updatedConsent, error: fetchError } = await supabase
        .from('driver_consents')
        .select('*')
        .eq('id', consentRecord.id)
        .single();

      if (fetchError) {
        console.error('Error fetching updated consent:', fetchError);
      }

      if (updatedConsent) {
        setConsentRecord(updatedConsent);
        
        if (updatedConsent.consent_status === 'allowed') {
          toast({
            title: "Consent Granted",
            description: "Driver has approved location tracking. You can now create the trip.",
          });
          onConsentReady(updatedConsent.id, 'sim');
        } else if (updatedConsent.consent_status === 'not_allowed') {
          toast({
            title: "Consent Denied",
            description: "Driver has denied location tracking consent.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Consent Status",
            description: `Current status: ${data.status || 'Pending'}. The driver has not yet responded to the SMS.`,
          });
        }
      } else {
        // Use API response status if DB fetch failed
        toast({
          title: "Consent Status",
          description: `Current status: ${data.status || 'Unknown'}`,
        });
      }
    } catch (error: any) {
      console.error('Consent check error:', error);
      const errorMessage = error.message?.includes('token') 
        ? 'Tracking service authentication failed. Please contact support.'
        : error.message || "Failed to check consent status. Please try again.";
      toast({
        title: "Status Check Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setCheckingConsent(false);
    }
  };

  const getConsentStatusBadge = () => {
    if (!consentRecord) return null;

    const statusConfig = {
      pending: { variant: 'secondary' as const, icon: Clock, label: 'Pending' },
      allowed: { variant: 'default' as const, icon: CheckCircle, label: 'Allowed' },
      not_allowed: { variant: 'destructive' as const, icon: XCircle, label: 'Not Allowed' },
      expired: { variant: 'outline' as const, icon: Clock, label: 'Expired' }
    };

    const config = statusConfig[consentRecord.consent_status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // Don't show anything if no vehicle selected
  if (!vehicleId) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Tracking Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tracking Type Info */}
        <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
          {trackingType === 'gps' ? (
            <>
              <div className="p-2 rounded-full bg-primary/10">
                <Truck className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">GPS Tracking Active</p>
                <p className="text-sm text-muted-foreground">
                  Vehicle has GPS device: {trackingAsset?.display_name || 'Unknown'}
                </p>
              </div>
              <Badge variant="default" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                Ready
              </Badge>
            </>
          ) : trackingType === 'sim' ? (
            <>
              <div className="p-2 rounded-full bg-orange-500/10">
                <Smartphone className="h-5 w-5 text-orange-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium">SIM-Based Tracking</p>
                <p className="text-sm text-muted-foreground">
                  Requires driver consent for location tracking
                </p>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Select a vehicle to configure tracking</p>
          )}
        </div>

        {/* SIM Consent Flow */}
        {trackingType === 'sim' && (
          <>
            {!driverId ? (
              <Alert>
                <AlertDescription>
                  Please select a driver to request location tracking consent.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{selectedDriver?.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedDriver?.mobile}</p>
                  </div>
                  {getConsentStatusBadge()}
                </div>

                {/* Consent Actions */}
                <div className="flex gap-2">
                  {!consentRecord || consentRecord.consent_status === 'expired' || consentRecord.consent_status === 'not_allowed' ? (
                    <Button 
                      onClick={handleRequestConsent} 
                      disabled={loading}
                      className="flex-1"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      {consentRecord ? 'Resend Consent SMS' : 'Send Consent SMS'}
                    </Button>
                  ) : null}

                  {consentRecord && consentRecord.consent_status !== 'allowed' && (
                    <Button 
                      variant="outline" 
                      onClick={handleCheckConsent}
                      disabled={checkingConsent}
                    >
                      {checkingConsent ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Check Status
                    </Button>
                  )}
                </div>

                {/* Status Messages */}
                {consentRecord?.consent_status === 'pending' && (
                  <Alert>
                    <Clock className="h-4 w-4" />
                    <AlertDescription>
                      Waiting for driver to approve consent via SMS. Click "Check Status" to refresh.
                    </AlertDescription>
                  </Alert>
                )}

                {consentRecord?.consent_status === 'allowed' && (
                  <Alert className="border-green-500/50 bg-green-500/10">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <AlertDescription className="text-green-700 dark:text-green-400">
                      Driver has granted location tracking consent. Ready to create trip.
                    </AlertDescription>
                  </Alert>
                )}

                {consentRecord?.consent_status === 'not_allowed' && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      Driver denied consent. Please contact the driver or try requesting again.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
