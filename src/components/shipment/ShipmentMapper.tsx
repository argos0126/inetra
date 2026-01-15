import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Package, Search, Plus, Trash2, AlertTriangle, CheckCircle, Weight, Box, Loader2, MapPin, Route, TrendingUp } from "lucide-react";

interface Shipment {
  id: string;
  shipment_code: string;
  order_id: string | null;
  lr_number: string | null;
  waybill_number: string | null;
  weight_kg: number | null;
  volume_cbm: number | null;
  quantity: number | null;
  status: string;
  pickup_location_id?: string | null;
  drop_location_id?: string | null;
  pickup_location?: { id: string; location_name: string } | null;
  drop_location?: { id: string; location_name: string } | null;
  customer?: { id: string; display_name: string } | null;
  material?: { id: string; name: string } | null;
}

interface MappedShipment {
  id: string;
  shipment_id: string;
  sequence_order: number;
  shipment: Shipment;
}

interface VehicleCapacity {
  weight_capacity_kg: number | null;
  volume_capacity_cbm: number | null;
}

interface TripRoute {
  origin_location_id: string | null;
  destination_location_id: string | null;
  origin_location?: { id: string; location_name: string } | null;
  destination_location?: { id: string; location_name: string } | null;
  waypoints: string[]; // Array of location IDs in route order
}

interface ShipmentMapperProps {
  tripId: string;
  freightType: string;
  vehicleCapacity?: VehicleCapacity | null;
  onMappingChange?: () => void;
}

type RouteCompatibility = "compatible" | "partial" | "incompatible";

interface ShipmentWithCompatibility extends Shipment {
  compatibility: RouteCompatibility;
  compatibilityReason: string;
}

export function ShipmentMapper({ tripId, freightType, vehicleCapacity, onMappingChange }: ShipmentMapperProps) {
  const { toast } = useToast();
  const [availableShipments, setAvailableShipments] = useState<ShipmentWithCompatibility[]>([]);
  const [mappedShipments, setMappedShipments] = useState<MappedShipment[]>([]);
  const [selectedShipments, setSelectedShipments] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [mapping, setMapping] = useState(false);
  const [tripRoute, setTripRoute] = useState<TripRoute | null>(null);
  const [showIncompatibleWarning, setShowIncompatibleWarning] = useState(false);

  useEffect(() => {
    fetchData();
  }, [tripId]);

  // Check for incompatible selections
  useEffect(() => {
    const selectedList = availableShipments.filter(s => selectedShipments.has(s.id));
    const hasIncompatible = selectedList.some(s => s.compatibility === "incompatible");
    setShowIncompatibleWarning(hasIncompatible);
  }, [selectedShipments, availableShipments]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch trip details with route info
      const { data: tripData, error: tripError } = await supabase
        .from("trips")
        .select(`
          origin_location_id,
          destination_location_id,
          origin_location:locations!trips_origin_location_id_fkey(id, location_name),
          destination_location:locations!trips_destination_location_id_fkey(id, location_name),
          lane_id
        `)
        .eq("id", tripId)
        .maybeSingle();

      if (tripError) throw tripError;

      // Get waypoints if they exist
      let waypointIds: string[] = [];
      if (tripData) {
        const { data: waypointsData } = await supabase
          .from("trip_waypoints")
          .select("location_id")
          .eq("trip_id", tripId)
          .order("sequence_order");
        
        waypointIds = (waypointsData || [])
          .map(w => w.location_id)
          .filter((id): id is string => id !== null);
      }

      const route: TripRoute = {
        origin_location_id: tripData?.origin_location_id || null,
        destination_location_id: tripData?.destination_location_id || null,
        origin_location: tripData?.origin_location as { id: string; location_name: string } | null,
        destination_location: tripData?.destination_location as { id: string; location_name: string } | null,
        waypoints: waypointIds,
      };
      setTripRoute(route);

      // Fetch already mapped shipments
      const { data: mapped, error: mappedError } = await supabase
        .from("trip_shipment_map")
        .select(`
          id,
          shipment_id,
          sequence_order,
          shipment:shipments(
            id, shipment_code, order_id, lr_number, waybill_number,
            weight_kg, volume_cbm, quantity, status,
            pickup_location_id, drop_location_id,
            pickup_location:locations!shipments_pickup_location_id_fkey(id, location_name),
            drop_location:locations!shipments_drop_location_id_fkey(id, location_name),
            customer:customers(id, display_name),
            material:materials(id, name)
          )
        `)
        .eq("trip_id", tripId)
        .order("sequence_order");

      if (mappedError) throw mappedError;

      // Fetch available shipments (not mapped to any active trip)
      const { data: available, error: availableError } = await supabase
        .from("shipments")
        .select(`
          id, shipment_code, order_id, lr_number, waybill_number,
          weight_kg, volume_cbm, quantity, status,
          pickup_location_id, drop_location_id,
          pickup_location:locations!shipments_pickup_location_id_fkey(id, location_name),
          drop_location:locations!shipments_drop_location_id_fkey(id, location_name),
          customer:customers(id, display_name),
          material:materials(id, name)
        `)
        .in("status", ["created", "confirmed"])
        .is("trip_id", null)
        .order("created_at", { ascending: false });

      if (availableError) throw availableError;

      // Filter out shipments already mapped to active trips
      const mappedIds = new Set((mapped || []).map((m: any) => m.shipment_id));
      const filteredAvailable = (available || []).filter((s: Shipment) => !mappedIds.has(s.id));

      // Add route compatibility info
      const shipmentsWithCompatibility: ShipmentWithCompatibility[] = filteredAvailable.map((s: any) => {
        const { compatibility, reason } = checkRouteCompatibility(s, route);
        return { ...s, compatibility, compatibilityReason: reason };
      });

      // Sort: compatible first, then partial, then incompatible
      shipmentsWithCompatibility.sort((a, b) => {
        const order = { compatible: 0, partial: 1, incompatible: 2 };
        return order[a.compatibility] - order[b.compatibility];
      });

      setMappedShipments((mapped || []).map((m: any) => ({
        ...m,
        shipment: m.shipment
      })));
      setAvailableShipments(shipmentsWithCompatibility);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const checkRouteCompatibility = (shipment: Shipment, route: TripRoute): { compatibility: RouteCompatibility; reason: string } => {
    if (!route.origin_location_id || !route.destination_location_id) {
      return { compatibility: "compatible", reason: "Trip route not defined" };
    }

    const pickupId = shipment.pickup_location_id;
    const dropId = shipment.drop_location_id;

    if (!pickupId || !dropId) {
      return { compatibility: "partial", reason: "Shipment locations not set" };
    }

    // Build full route: origin + waypoints + destination
    const fullRoute = [route.origin_location_id, ...route.waypoints, route.destination_location_id];

    const pickupIndex = fullRoute.indexOf(pickupId);
    const dropIndex = fullRoute.indexOf(dropId);

    // Perfect match: pickup is origin, drop is destination
    if (pickupId === route.origin_location_id && dropId === route.destination_location_id) {
      return { compatibility: "compatible", reason: "Perfect match: Pickup = Origin, Drop = Destination" };
    }

    // Both locations are on the route and in correct order
    if (pickupIndex !== -1 && dropIndex !== -1 && pickupIndex < dropIndex) {
      return { compatibility: "compatible", reason: "On route: Locations match trip waypoints" };
    }

    // Pickup matches origin or drop matches destination
    if (pickupId === route.origin_location_id) {
      return { compatibility: "partial", reason: `Drop (${shipment.drop_location?.location_name || 'Unknown'}) not on route` };
    }
    if (dropId === route.destination_location_id) {
      return { compatibility: "partial", reason: `Pickup (${shipment.pickup_location?.location_name || 'Unknown'}) not on route` };
    }

    // No match
    return { 
      compatibility: "incompatible", 
      reason: `Route mismatch: ${shipment.pickup_location?.location_name || 'Unknown'} → ${shipment.drop_location?.location_name || 'Unknown'}` 
    };
  };

  const calculateTotals = () => {
    const shipments = mappedShipments.map(m => m.shipment);
    return {
      totalWeight: shipments.reduce((sum, s) => sum + (s.weight_kg || 0), 0),
      totalVolume: shipments.reduce((sum, s) => sum + (s.volume_cbm || 0), 0),
      totalQuantity: shipments.reduce((sum, s) => sum + (s.quantity || 0), 0),
    };
  };

  const validateCapacity = (additionalShipments: Shipment[] = []) => {
    if (freightType !== "ptl" || !vehicleCapacity) return { valid: true, errors: [] };

    const currentTotals = calculateTotals();
    const additionalWeight = additionalShipments.reduce((sum, s) => sum + (s.weight_kg || 0), 0);
    const additionalVolume = additionalShipments.reduce((sum, s) => sum + (s.volume_cbm || 0), 0);

    const errors: string[] = [];

    if (vehicleCapacity.weight_capacity_kg) {
      const totalWeight = currentTotals.totalWeight + additionalWeight;
      if (totalWeight > vehicleCapacity.weight_capacity_kg) {
        errors.push(`Weight exceeds capacity: ${totalWeight.toFixed(1)}kg / ${vehicleCapacity.weight_capacity_kg}kg`);
      }
    }

    if (vehicleCapacity.volume_capacity_cbm) {
      const totalVolume = currentTotals.totalVolume + additionalVolume;
      if (totalVolume > vehicleCapacity.volume_capacity_cbm) {
        errors.push(`Volume exceeds capacity: ${totalVolume.toFixed(2)}cbm / ${vehicleCapacity.volume_capacity_cbm}cbm`);
      }
    }

    return { valid: errors.length === 0, errors };
  };

  const handleMapShipments = async () => {
    if (selectedShipments.size === 0) return;

    const shipmentsToMap = availableShipments.filter(s => selectedShipments.has(s.id));

    // Validate PTL capacity
    const validation = validateCapacity(shipmentsToMap);
    if (!validation.valid) {
      toast({
        title: "Capacity Exceeded",
        description: validation.errors.join(". "),
        variant: "destructive"
      });
      return;
    }

    setMapping(true);
    try {
      const maxSequence = mappedShipments.length > 0 
        ? Math.max(...mappedShipments.map(m => m.sequence_order)) 
        : 0;

      // Create mapping entries
      const mappingEntries = shipmentsToMap.map((shipment, index) => ({
        trip_id: tripId,
        shipment_id: shipment.id,
        sequence_order: maxSequence + index + 1,
      }));

      const { error: mapError } = await supabase
        .from("trip_shipment_map")
        .insert(mappingEntries);

      if (mapError) throw mapError;

      // Update shipment status to mapped and set trip_id
      const { error: updateError } = await supabase
        .from("shipments")
        .update({ status: "mapped", trip_id: tripId })
        .in("id", shipmentsToMap.map(s => s.id));

      if (updateError) throw updateError;

      toast({ title: "Success", description: `${shipmentsToMap.length} shipment(s) mapped to trip` });
      setSelectedShipments(new Set());
      fetchData();
      onMappingChange?.();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setMapping(false);
    }
  };

  const handleUnmapShipment = async (mappingId: string, shipmentId: string) => {
    try {
      // Remove mapping
      const { error: deleteError } = await supabase
        .from("trip_shipment_map")
        .delete()
        .eq("id", mappingId);

      if (deleteError) throw deleteError;

      // Revert shipment status
      const { error: updateError } = await supabase
        .from("shipments")
        .update({ status: "confirmed", trip_id: null })
        .eq("id", shipmentId);

      if (updateError) throw updateError;

      toast({ title: "Success", description: "Shipment unmapped from trip" });
      fetchData();
      onMappingChange?.();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const toggleShipmentSelection = (shipmentId: string) => {
    const newSelection = new Set(selectedShipments);
    if (newSelection.has(shipmentId)) {
      newSelection.delete(shipmentId);
    } else {
      newSelection.add(shipmentId);
    }
    setSelectedShipments(newSelection);
  };

  const filteredAvailable = availableShipments.filter(s =>
    s.shipment_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.lr_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.customer?.display_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totals = calculateTotals();
  const capacityValidation = validateCapacity();

  // Calculate capacity percentages for visual meters
  const getCapacityPercentage = (current: number, max: number | null) => {
    if (!max || max === 0) return 0;
    return Math.min(100, (current / max) * 100);
  };

  const weightPercentage = vehicleCapacity?.weight_capacity_kg 
    ? getCapacityPercentage(totals.totalWeight, vehicleCapacity.weight_capacity_kg)
    : 0;
  const volumePercentage = vehicleCapacity?.volume_capacity_cbm 
    ? getCapacityPercentage(totals.totalVolume, vehicleCapacity.volume_capacity_cbm)
    : 0;

  const getCapacityColor = (percentage: number) => {
    if (percentage >= 100) return "bg-destructive";
    if (percentage >= 80) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getCompatibilityBadge = (compatibility: RouteCompatibility) => {
    switch (compatibility) {
      case "compatible":
        return <Badge variant="default" className="bg-green-600 text-xs"><CheckCircle className="h-3 w-3 mr-1" />Match</Badge>;
      case "partial":
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Partial</Badge>;
      case "incompatible":
        return <Badge variant="destructive" className="text-xs"><MapPin className="h-3 w-3 mr-1" />Mismatch</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Trip Route Info */}
      {tripRoute && (tripRoute.origin_location_id || tripRoute.destination_location_id) && (
        <Alert>
          <Route className="h-4 w-4" />
          <AlertTitle>Trip Route</AlertTitle>
          <AlertDescription className="flex items-center gap-2">
            <span className="font-medium">{tripRoute.origin_location?.location_name || "Not set"}</span>
            <span>→</span>
            {tripRoute.waypoints.length > 0 && (
              <>
                <span className="text-muted-foreground">({tripRoute.waypoints.length} stops)</span>
                <span>→</span>
              </>
            )}
            <span className="font-medium">{tripRoute.destination_location?.location_name || "Not set"}</span>
          </AlertDescription>
        </Alert>
      )}

      {/* Visual Capacity Meters (PTL only) */}
      {freightType === "ptl" && vehicleCapacity && (vehicleCapacity.weight_capacity_kg || vehicleCapacity.volume_capacity_cbm) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Vehicle Capacity Utilization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Weight Capacity Meter */}
            {vehicleCapacity.weight_capacity_kg && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Weight className="h-4 w-4 text-muted-foreground" />
                    Weight Capacity
                  </span>
                  <span className="font-medium">
                    {totals.totalWeight.toFixed(1)} / {vehicleCapacity.weight_capacity_kg} kg
                    <span className="text-muted-foreground ml-1">({weightPercentage.toFixed(0)}%)</span>
                  </span>
                </div>
                <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${getCapacityColor(weightPercentage)}`}
                    style={{ width: `${Math.min(100, weightPercentage)}%` }}
                  />
                </div>
                {weightPercentage >= 80 && weightPercentage < 100 && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Approaching weight capacity limit
                  </p>
                )}
                {weightPercentage >= 100 && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Weight capacity exceeded!
                  </p>
                )}
              </div>
            )}

            {/* Volume Capacity Meter */}
            {vehicleCapacity.volume_capacity_cbm && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Box className="h-4 w-4 text-muted-foreground" />
                    Volume Capacity
                  </span>
                  <span className="font-medium">
                    {totals.totalVolume.toFixed(2)} / {vehicleCapacity.volume_capacity_cbm} cbm
                    <span className="text-muted-foreground ml-1">({volumePercentage.toFixed(0)}%)</span>
                  </span>
                </div>
                <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${getCapacityColor(volumePercentage)}`}
                    style={{ width: `${Math.min(100, volumePercentage)}%` }}
                  />
                </div>
                {volumePercentage >= 80 && volumePercentage < 100 && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Approaching volume capacity limit
                  </p>
                )}
                {volumePercentage >= 100 && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Volume capacity exceeded!
                  </p>
                )}
              </div>
            )}

            {/* Summary */}
            <div className="flex items-center gap-4 pt-2 border-t text-xs text-muted-foreground">
              <span>{mappedShipments.length} shipment(s) mapped</span>
              <span>•</span>
              <span>{totals.totalQuantity} total items</span>
              {!capacityValidation.valid && (
                <>
                  <span>•</span>
                  <Badge variant="destructive" className="text-xs">Over Capacity</Badge>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mapped Shipments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Mapped Shipments
              <Badge variant="secondary">{mappedShipments.length}</Badge>
            </span>
            {freightType === "ptl" && vehicleCapacity && (
              <div className="flex gap-4 text-sm font-normal">
                <span className="flex items-center gap-1">
                  <Weight className="h-4 w-4" />
                  {totals.totalWeight.toFixed(1)}kg / {vehicleCapacity.weight_capacity_kg || "∞"}kg
                </span>
                <span className="flex items-center gap-1">
                  <Box className="h-4 w-4" />
                  {totals.totalVolume.toFixed(2)}cbm / {vehicleCapacity.volume_capacity_cbm || "∞"}cbm
                </span>
              </div>
            )}
          </CardTitle>
          {freightType === "ptl" && !capacityValidation.valid && (
            <Alert variant="destructive" className="mt-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Capacity Warning</AlertTitle>
              <AlertDescription>{capacityValidation.errors.join(". ")}</AlertDescription>
            </Alert>
          )}
        </CardHeader>
        <CardContent>
          {mappedShipments.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No shipments mapped to this trip yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shipment Code</TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>LR / Waybill</TableHead>
                  <TableHead>Pickup</TableHead>
                  <TableHead>Drop</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappedShipments.map((mapped) => (
                  <TableRow key={mapped.id} className="bg-green-50 dark:bg-green-950/20">
                    <TableCell className="font-mono">{mapped.shipment.shipment_code}</TableCell>
                    <TableCell>{mapped.shipment.order_id || "-"}</TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <div>LR: {mapped.shipment.lr_number || "-"}</div>
                        <div>WB: {mapped.shipment.waybill_number || "-"}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{mapped.shipment.pickup_location?.location_name || "-"}</TableCell>
                    <TableCell className="text-xs">{mapped.shipment.drop_location?.location_name || "-"}</TableCell>
                    <TableCell>{mapped.shipment.weight_kg ? `${mapped.shipment.weight_kg}kg` : "-"}</TableCell>
                    <TableCell>{mapped.shipment.volume_cbm ? `${mapped.shipment.volume_cbm}cbm` : "-"}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnmapShipment(mapped.id, mapped.shipment.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Available Shipments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Shipments
          </CardTitle>
          <CardDescription>Select shipments to map to this trip. Green = route match, Yellow = partial match, Red = route mismatch</CardDescription>
          
          {showIncompatibleWarning && (
            <Alert variant="destructive" className="mt-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Route Mismatch Warning</AlertTitle>
              <AlertDescription>
                Some selected shipments have pickup/drop locations that don't match the trip route. 
                Mapping these shipments may cause delivery issues.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="flex items-center gap-4 pt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code, order ID, LR, or customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              onClick={handleMapShipments}
              disabled={selectedShipments.size === 0 || mapping}
              variant={showIncompatibleWarning ? "destructive" : "default"}
            >
              {mapping ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Map Selected ({selectedShipments.size})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAvailable.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              {searchTerm ? "No matching shipments found" : "No available shipments to map"}
            </p>
          ) : (
            <ScrollArea className="h-80">
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Shipment Code</TableHead>
                      <TableHead>Route Match</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Pickup</TableHead>
                      <TableHead>Drop</TableHead>
                      <TableHead>Weight</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAvailable.map((shipment) => (
                      <TableRow
                        key={shipment.id}
                        className={`
                          ${selectedShipments.has(shipment.id) ? "bg-primary/5" : ""}
                          ${shipment.compatibility === "incompatible" ? "opacity-70" : ""}
                        `}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedShipments.has(shipment.id)}
                            onCheckedChange={() => toggleShipmentSelection(shipment.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono">{shipment.shipment_code}</TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>{getCompatibilityBadge(shipment.compatibility)}</div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{shipment.compatibilityReason}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-xs">{shipment.customer?.display_name || "-"}</TableCell>
                        <TableCell className="text-xs">
                          <span className={shipment.pickup_location_id === tripRoute?.origin_location_id ? "text-green-600 font-medium" : ""}>
                            {shipment.pickup_location?.location_name || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className={shipment.drop_location_id === tripRoute?.destination_location_id ? "text-green-600 font-medium" : ""}>
                            {shipment.drop_location?.location_name || "-"}
                          </span>
                        </TableCell>
                        <TableCell>{shipment.weight_kg ? `${shipment.weight_kg}kg` : "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{shipment.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TooltipProvider>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
