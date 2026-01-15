import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Download, Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";

interface ImportResult {
  row: number;
  tripCode: string;
  status: "success" | "error" | "skipped";
  message: string;
}

interface TripBulkImportProps {
  onImportComplete: () => void;
}

interface LocationLookup {
  id: string;
  location_name: string;
}

interface VehicleLookup {
  id: string;
  vehicle_number: string;
}

interface DriverLookup {
  id: string;
  name: string;
  mobile: string;
}

interface TransporterLookup {
  id: string;
  transporter_name: string;
}

interface CustomerLookup {
  id: string;
  display_name: string;
}

interface LaneLookup {
  id: string;
  lane_code: string;
  origin_location_id: string;
  destination_location_id: string;
  distance_km: number | null;
}

const CSV_TEMPLATE_HEADERS = [
  "trip_code",
  "origin_location_name",
  "destination_location_name",
  "vehicle_number",
  "driver_mobile",
  "transporter_name",
  "customer_name",
  "lane_code",
  "consignee_name",
  "planned_start_time",
  "planned_end_time",
  "notes",
];

const CSV_TEMPLATE_EXAMPLE = [
  "TRP-20241224-001",
  "Mumbai Warehouse",
  "Delhi Hub",
  "MH01AB1234",
  "9876543210",
  "FastTrack Logistics",
  "ABC Corp",
  "MUM-DEL-001",
  "John Smith",
  "2024-12-25 08:00",
  "2024-12-26 18:00",
  "Urgent delivery",
];

const generateTripCode = () => {
  const date = new Date();
  const prefix = "TRP";
  const dateStr = date.toISOString().slice(2, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `${prefix}-${dateStr}-${random}`;
};

export function TripBulkImport({ onImportComplete }: TripBulkImportProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  
  // Lookup data
  const [locations, setLocations] = useState<LocationLookup[]>([]);
  const [vehicles, setVehicles] = useState<VehicleLookup[]>([]);
  const [drivers, setDrivers] = useState<DriverLookup[]>([]);
  const [transporters, setTransporters] = useState<TransporterLookup[]>([]);
  const [customers, setCustomers] = useState<CustomerLookup[]>([]);
  const [lanes, setLanes] = useState<LaneLookup[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Load lookup data when dialog opens
  useEffect(() => {
    if (open) {
      loadLookupData();
    }
  }, [open]);

  const loadLookupData = async () => {
    setLookupLoading(true);
    try {
      const [locRes, vehRes, drvRes, trnRes, custRes, laneRes] = await Promise.all([
        supabase.from("locations").select("id, location_name").eq("is_active", true),
        supabase.from("vehicles").select("id, vehicle_number").eq("is_active", true),
        supabase.from("drivers").select("id, name, mobile").eq("is_active", true),
        supabase.from("transporters").select("id, transporter_name").eq("is_active", true),
        supabase.from("customers").select("id, display_name").eq("is_active", true),
        supabase.from("serviceability_lanes").select("id, lane_code, origin_location_id, destination_location_id, distance_km").eq("is_active", true),
      ]);

      setLocations(locRes.data || []);
      setVehicles(vehRes.data || []);
      setDrivers(drvRes.data || []);
      setTransporters(trnRes.data || []);
      setCustomers(custRes.data || []);
      setLanes(laneRes.data || []);
    } catch (error) {
      console.error("Failed to load lookup data:", error);
    } finally {
      setLookupLoading(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = [
      CSV_TEMPLATE_HEADERS.join(","),
      CSV_TEMPLATE_EXAMPLE.join(","),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "trip_import_template.csv";
    link.click();
    URL.revokeObjectURL(link.href);

    toast({ title: "Template downloaded", description: "Fill in the template and upload it back." });
  };

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, "").replace(/ /g, "_"));
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      // Handle commas within quoted fields
      const line = lines[i];
      const values: string[] = [];
      let current = "";
      let inQuotes = false;

      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim().replace(/"/g, ""));
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/"/g, ""));

      if (values.length !== headers.length) continue;

      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx];
      });
      rows.push(row);
    }

    return rows;
  };

  const findLocation = (name: string): string | null => {
    if (!name) return null;
    const location = locations.find(
      (l) => l.location_name.toLowerCase() === name.toLowerCase()
    );
    return location?.id || null;
  };

  const findVehicle = (vehicleNumber: string): VehicleLookup | null => {
    if (!vehicleNumber) return null;
    return vehicles.find(
      (v) => v.vehicle_number.toLowerCase().replace(/\s/g, "") === vehicleNumber.toLowerCase().replace(/\s/g, "")
    ) || null;
  };

  const findDriver = (mobile: string): DriverLookup | null => {
    if (!mobile) return null;
    return drivers.find((d) => d.mobile === mobile) || null;
  };

  const findTransporter = (name: string): string | null => {
    if (!name) return null;
    const transporter = transporters.find(
      (t) => t.transporter_name.toLowerCase() === name.toLowerCase()
    );
    return transporter?.id || null;
  };

  const findCustomer = (name: string): string | null => {
    if (!name) return null;
    const customer = customers.find(
      (c) => c.display_name.toLowerCase() === name.toLowerCase()
    );
    return customer?.id || null;
  };

  const findLane = (laneCode: string): LaneLookup | null => {
    if (!laneCode) return null;
    return lanes.find((l) => l.lane_code.toLowerCase() === laneCode.toLowerCase()) || null;
  };

  const validateRow = (row: Record<string, string>, rowNum: number): { valid: boolean; message: string; warnings: string[] } => {
    const warnings: string[] = [];

    // Trip code validation (optional - will auto-generate if empty)
    if (row.trip_code) {
      const trimmedCode = row.trip_code.trim();
      if (trimmedCode.length < 3) {
        return { valid: false, message: "Trip code must be at least 3 characters", warnings };
      }
    }

    // Origin location is required
    if (!row.origin_location_name || !findLocation(row.origin_location_name)) {
      return { valid: false, message: `Origin location "${row.origin_location_name || 'empty'}" not found in master`, warnings };
    }

    // Destination location is required
    if (!row.destination_location_name || !findLocation(row.destination_location_name)) {
      return { valid: false, message: `Destination location "${row.destination_location_name || 'empty'}" not found in master`, warnings };
    }

    // Vehicle validation (optional but must exist if provided)
    if (row.vehicle_number && !findVehicle(row.vehicle_number)) {
      warnings.push(`Vehicle "${row.vehicle_number}" not found - will be left unassigned`);
    }

    // Driver validation (optional but must exist if provided)
    if (row.driver_mobile && !findDriver(row.driver_mobile)) {
      warnings.push(`Driver with mobile "${row.driver_mobile}" not found - will be left unassigned`);
    }

    // Transporter validation (optional)
    if (row.transporter_name && !findTransporter(row.transporter_name)) {
      warnings.push(`Transporter "${row.transporter_name}" not found`);
    }

    // Customer validation (optional)
    if (row.customer_name && !findCustomer(row.customer_name)) {
      warnings.push(`Customer "${row.customer_name}" not found`);
    }

    // Lane validation (optional but helps with distance/TAT)
    if (row.lane_code && !findLane(row.lane_code)) {
      warnings.push(`Lane "${row.lane_code}" not found`);
    }

    // Date validation
    if (row.planned_start_time) {
      const date = new Date(row.planned_start_time);
      if (isNaN(date.getTime())) {
        warnings.push("Invalid planned_start_time format");
      }
    }

    if (row.planned_end_time) {
      const date = new Date(row.planned_end_time);
      if (isNaN(date.getTime())) {
        warnings.push("Invalid planned_end_time format");
      }
    }

    return { valid: true, message: warnings.length > 0 ? `Valid with ${warnings.length} warning(s)` : "Valid", warnings };
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast({ title: "Invalid file", description: "Please upload a CSV file", variant: "destructive" });
      return;
    }

    setImporting(true);
    setProgress(0);
    setResults([]);
    setShowResults(false);

    try {
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        toast({ title: "Empty file", description: "No data rows found in the CSV", variant: "destructive" });
        setImporting(false);
        return;
      }

      const importResults: ImportResult[] = [];
      const totalRows = rows.length;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // +2 because row 1 is header, and we're 0-indexed
        const tripCode = row.trip_code?.trim() || generateTripCode();

        // Validate row
        const validation = validateRow(row, rowNum);
        if (!validation.valid) {
          importResults.push({
            row: rowNum,
            tripCode,
            status: "error",
            message: validation.message,
          });
          setProgress(Math.round(((i + 1) / totalRows) * 100));
          continue;
        }

        // Check for duplicate trip code
        const { data: existing } = await supabase
          .from("trips")
          .select("id")
          .eq("trip_code", tripCode)
          .maybeSingle();

        if (existing) {
          importResults.push({
            row: rowNum,
            tripCode,
            status: "skipped",
            message: "Trip code already exists",
          });
          setProgress(Math.round(((i + 1) / totalRows) * 100));
          continue;
        }

        // Resolve references
        const originLocationId = findLocation(row.origin_location_name);
        const destinationLocationId = findLocation(row.destination_location_name);
        const vehicle = findVehicle(row.vehicle_number);
        const driver = findDriver(row.driver_mobile);
        const transporterId = findTransporter(row.transporter_name);
        const customerId = findCustomer(row.customer_name);
        const lane = findLane(row.lane_code);

        // Determine tracking type based on vehicle
        let trackingType: 'gps' | 'sim' | 'manual' | 'none' = 'none';
        let trackingAssetId: string | null = null;
        let isTrackable = false;

        if (vehicle?.id) {
          // Check if vehicle has a tracking asset
          const { data: vehicleData } = await supabase
            .from("vehicles")
            .select("tracking_asset_id")
            .eq("id", vehicle.id)
            .maybeSingle();

          if (vehicleData?.tracking_asset_id) {
            trackingAssetId = vehicleData.tracking_asset_id;
            trackingType = 'gps';
            isTrackable = true;
          }
        }

        // Insert trip
        const tripData = {
          trip_code: tripCode,
          origin_location_id: originLocationId,
          destination_location_id: destinationLocationId,
          vehicle_id: vehicle?.id || null,
          driver_id: driver?.id || null,
          transporter_id: transporterId,
          customer_id: customerId,
          lane_id: lane?.id || null,
          tracking_asset_id: trackingAssetId,
          tracking_type: trackingType,
          is_trackable: isTrackable,
          consignee_name: row.consignee_name?.trim() || null,
          planned_start_time: row.planned_start_time ? new Date(row.planned_start_time).toISOString() : null,
          planned_end_time: row.planned_end_time ? new Date(row.planned_end_time).toISOString() : null,
          notes: row.notes?.trim() || null,
          status: 'created' as const,
          total_distance_km: lane?.distance_km || null,
        };

        const { error } = await supabase.from("trips").insert(tripData);

        if (error) {
          importResults.push({
            row: rowNum,
            tripCode,
            status: "error",
            message: error.message,
          });
        } else {
          const warningText = validation.warnings.length > 0 
            ? ` (${validation.warnings.length} warning${validation.warnings.length > 1 ? 's' : ''})`
            : '';
          importResults.push({
            row: rowNum,
            tripCode,
            status: "success",
            message: `Imported successfully${warningText}`,
          });
        }

        setProgress(Math.round(((i + 1) / totalRows) * 100));
      }

      setResults(importResults);
      setShowResults(true);

      const successCount = importResults.filter((r) => r.status === "success").length;
      const errorCount = importResults.filter((r) => r.status === "error").length;
      const skippedCount = importResults.filter((r) => r.status === "skipped").length;

      toast({
        title: "Import complete",
        description: `${successCount} created, ${skippedCount} skipped, ${errorCount} errors`,
      });

      if (successCount > 0) {
        onImportComplete();
      }
    } catch (error: any) {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Bulk Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Import Trips</DialogTitle>
          <DialogDescription>
            Upload a CSV file to create multiple trips at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Loading lookup data */}
          {lookupLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Loading master data...</span>
            </div>
          )}

          {!lookupLoading && (
            <>
              {/* Instructions */}
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Instructions</AlertTitle>
                <AlertDescription>
                  <ol className="list-decimal list-inside space-y-1 mt-2 text-sm">
                    <li>Download the CSV template below</li>
                    <li>Fill in trip details (one trip per row)</li>
                    <li>Use exact names from master data (locations, vehicles, drivers)</li>
                    <li>Trip codes are auto-generated if left empty</li>
                    <li>Duplicate trip codes will be skipped</li>
                  </ol>
                </AlertDescription>
              </Alert>

              {/* Master Data Summary */}
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{locations.length} Locations</Badge>
                <Badge variant="outline">{vehicles.length} Vehicles</Badge>
                <Badge variant="outline">{drivers.length} Drivers</Badge>
                <Badge variant="outline">{transporters.length} Transporters</Badge>
                <Badge variant="outline">{customers.length} Customers</Badge>
                <Badge variant="outline">{lanes.length} Lanes</Badge>
              </div>

              {/* Template Download */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Step 1: Download Template</CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <Button variant="outline" onClick={downloadTemplate} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Download CSV Template
                  </Button>
                </CardContent>
              </Card>

              {/* File Upload */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Step 2: Upload Filled CSV</CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={importing}
                  />
                  <Button
                    variant="default"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                    disabled={importing}
                  >
                    {importing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {importing ? "Importing..." : "Upload CSV File"}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          {/* Progress */}
          {importing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Creating trips...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Results */}
          {showResults && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  Import Results
                  <div className="flex gap-2">
                    <Badge variant="default" className="bg-green-500">
                      {successCount} Created
                    </Badge>
                    <Badge variant="secondary">{skippedCount} Skipped</Badge>
                    <Badge variant="destructive">{errorCount} Errors</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {results.map((result, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-2 p-2 rounded text-sm ${
                          result.status === "success"
                            ? "bg-green-50 dark:bg-green-950/20"
                            : result.status === "error"
                            ? "bg-red-50 dark:bg-red-950/20"
                            : "bg-yellow-50 dark:bg-yellow-950/20"
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {result.status === "success" && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                          {result.status === "error" && (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          {result.status === "skipped" && (
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          )}
                          <span className="whitespace-nowrap">
                            Row {result.row}: {result.tripCode}
                          </span>
                        </div>
                        <span 
                          className="text-muted-foreground text-xs break-words"
                          title={result.message}
                        >
                          {result.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Close Button after results */}
          {showResults && (
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
