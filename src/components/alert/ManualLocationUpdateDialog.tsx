import { useState } from 'react';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AddressAutocomplete, PlaceData } from '@/components/location/LocationSearchMap';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ManualLocationUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  tripCode: string;
  alertId?: string; // Optional - only provided when resolving an alert
  onSuccess?: () => void;
}

export default function ManualLocationUpdateDialog({
  open,
  onOpenChange,
  tripId,
  tripCode,
  alertId,
  onSuccess
}: ManualLocationUpdateDialogProps) {
  const [selectedPlace, setSelectedPlace] = useState<PlaceData | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePlaceSelect = (place: PlaceData) => {
    setSelectedPlace(place);
  };

  const handleSubmit = async () => {
    if (!selectedPlace) {
      toast.error('Please select a location');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get the next sequence number for this trip
      const { data: existingHistory } = await supabase
        .from('location_history')
        .select('id')
        .eq('trip_id', tripId)
        .order('event_time', { ascending: false })
        .limit(1);

      // Insert manual location into location_history
      const { error: insertError } = await supabase
        .from('location_history')
        .insert({
          trip_id: tripId,
          latitude: selectedPlace.latitude,
          longitude: selectedPlace.longitude,
          event_time: new Date().toISOString(),
          source: 'manual',
          raw_response: {
            address: selectedPlace.address,
            city: selectedPlace.city,
            state: selectedPlace.state,
            pincode: selectedPlace.pincode,
            notes: notes,
            manual_update: true,
            ...(alertId && { alert_id: alertId })
          }
        });

      if (insertError) throw insertError;

      // Update trip's last_ping_at
      await supabase
        .from('trips')
        .update({ last_ping_at: new Date().toISOString() })
        .eq('id', tripId);

      // Resolve the alert if alertId is provided
      if (alertId) {
        await supabase
          .from('trip_alerts')
          .update({ 
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            metadata: {
              manual_location_update: true,
              location: {
                latitude: selectedPlace.latitude,
                longitude: selectedPlace.longitude,
                address: selectedPlace.address
              }
            }
          })
          .eq('id', alertId);
        toast.success('Location updated and alert resolved');
      } else {
        toast.success('Location updated successfully');
      }
      onOpenChange(false);
      setSelectedPlace(null);
      setNotes('');
      onSuccess?.();
    } catch (error) {
      console.error('Error updating location:', error);
      toast.error('Failed to update location');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedPlace(null);
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Manual Location Update
          </DialogTitle>
          <DialogDescription>
            Update location for trip <span className="font-medium">{tripCode}</span>. 
            Search and select the current vehicle location.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Search Location</Label>
            <AddressAutocomplete
              onPlaceSelect={handlePlaceSelect}
              placeholder="Search for current vehicle location..."
            />
          </div>

          {selectedPlace && (
            <>
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-primary" />
                  <div className="text-sm">
                    <p className="font-medium">{selectedPlace.address}</p>
                    <p className="text-muted-foreground text-xs">
                      {[selectedPlace.city, selectedPlace.state, selectedPlace.pincode]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                    <p className="text-muted-foreground text-xs mt-1">
                      Coordinates: {selectedPlace.latitude.toFixed(6)}, {selectedPlace.longitude.toFixed(6)}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this manual update..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!selectedPlace || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <MapPin className="h-4 w-4 mr-2" />
                Update Location
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
