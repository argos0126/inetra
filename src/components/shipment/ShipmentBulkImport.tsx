import { useState, useRef } from "react";
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
import { validateShipmentRow } from "@/schemas/validation.schemas";

interface ImportResult {
  row: number;
  shipmentCode: string;
  status: "success" | "error" | "skipped";
  message: string;
}

interface ShipmentBulkImportProps {
  onImportComplete: () => void;
}

const CSV_TEMPLATE_HEADERS = [
  "shipment_code",
  "lr_number",
  "waybill_number",
  "order_id",
  "consignee_code",
  "shipment_type",
  "customer_display_name",
  "pickup_location_name",
  "drop_location_name",
  "material_name",
  "quantity",
  "weight_kg",
  "volume_cbm",
  "length_cm",
  "breadth_cm",
  "height_cm",
  "notes",
];

const CSV_TEMPLATE_EXAMPLE = [
  "SHP-001",
  "LR123456",
  "WB789012",
  "ORD-001",
  "CONS-001",
  "single_single",
  "Acme Corp",
  "Mumbai Warehouse",
  "Delhi Hub",
  "Electronics",
  "10",
  "150.5",
  "2.5",
  "100",
  "80",
  "60",
  "Handle with care",
];

const VALID_SHIPMENT_TYPES = ["single_single", "single_multi", "multi_single", "multi_multi"];

export function ShipmentBulkImport({ onImportComplete }: ShipmentBulkImportProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Cache for lookups
  const [customerCache, setCustomerCache] = useState<Map<string, string>>(new Map());
  const [locationCache, setLocationCache] = useState<Map<string, string>>(new Map());
  const [materialCache, setMaterialCache] = useState<Map<string, string>>(new Map());

  const downloadTemplate = () => {
    const csvContent = [
      CSV_TEMPLATE_HEADERS.join(","),
      CSV_TEMPLATE_EXAMPLE.join(","),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "shipment_import_template.csv";
    link.click();
    URL.revokeObjectURL(link.href);

    toast({ title: "Template downloaded", description: "Fill in the template and upload it back." });
  };

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      // Handle CSV with quoted fields that may contain commas
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      
      for (const char of lines[i]) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      if (values.length !== headers.length) continue;

      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx].replace(/"/g, "");
      });
      rows.push(row);
    }

    return rows;
  };

  const validateRow = (row: Record<string, string>): { valid: boolean; message: string } => {
    if (!row.shipment_code || row.shipment_code.trim().length < 1) {
      return { valid: false, message: "Shipment code is required" };
    }

    if (row.shipment_type && !VALID_SHIPMENT_TYPES.includes(row.shipment_type.toLowerCase())) {
      return { valid: false, message: `Invalid shipment type. Valid: ${VALID_SHIPMENT_TYPES.join(", ")}` };
    }

    if (row.quantity && isNaN(parseInt(row.quantity))) {
      return { valid: false, message: "Quantity must be a number" };
    }

    if (row.weight_kg && isNaN(parseFloat(row.weight_kg))) {
      return { valid: false, message: "Weight must be a number" };
    }

    if (row.volume_cbm && isNaN(parseFloat(row.volume_cbm))) {
      return { valid: false, message: "Volume must be a number" };
    }

    return { valid: true, message: "Valid" };
  };

  const loadLookupCaches = async () => {
    const [customersRes, locationsRes, materialsRes] = await Promise.all([
      supabase.from("customers").select("id, display_name"),
      supabase.from("locations").select("id, location_name"),
      supabase.from("materials").select("id, name"),
    ]);

    const custMap = new Map<string, string>();
    (customersRes.data || []).forEach((c) => custMap.set(c.display_name.toLowerCase(), c.id));
    setCustomerCache(custMap);

    const locMap = new Map<string, string>();
    (locationsRes.data || []).forEach((l) => locMap.set(l.location_name.toLowerCase(), l.id));
    setLocationCache(locMap);

    const matMap = new Map<string, string>();
    (materialsRes.data || []).forEach((m) => matMap.set(m.name.toLowerCase(), m.id));
    setMaterialCache(matMap);

    return { custMap, locMap, matMap };
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
      // Load lookup caches
      const { custMap, locMap, matMap } = await loadLookupCaches();

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
        const rowNum = i + 2;

        // Use Zod schema validation
        const validation = validateShipmentRow(row);
        if (!validation.success) {
          importResults.push({
            row: rowNum,
            shipmentCode: row.shipment_code || "Unknown",
            status: "error",
            message: validation.error || "Validation failed",
          });
          setProgress(Math.round(((i + 1) / totalRows) * 100));
          continue;
        }

        const validatedData = validation.data!;

        // Check for duplicate shipment code
        const { data: existing } = await supabase
          .from("shipments")
          .select("id")
          .eq("shipment_code", validatedData.shipment_code)
          .maybeSingle();

        if (existing) {
          importResults.push({
            row: rowNum,
            shipmentCode: validatedData.shipment_code,
            status: "skipped",
            message: "Shipment code already exists",
          });
          setProgress(Math.round(((i + 1) / totalRows) * 100));
          continue;
        }

        // Resolve references
        const customerId = row.customer_display_name 
          ? custMap.get(row.customer_display_name.toLowerCase()) || null 
          : null;
        const pickupLocationId = row.pickup_location_name 
          ? locMap.get(row.pickup_location_name.toLowerCase()) || null 
          : null;
        const dropLocationId = row.drop_location_name 
          ? locMap.get(row.drop_location_name.toLowerCase()) || null 
          : null;
        const materialId = row.material_name 
          ? matMap.get(row.material_name.toLowerCase()) || null 
          : null;

        // Insert shipment
        const shipmentData = {
          shipment_code: validatedData.shipment_code,
          lr_number: validatedData.lr_number || null,
          waybill_number: validatedData.waybill_number || null,
          order_id: validatedData.order_id || null,
          consignee_code: validatedData.consignee_code || null,
          shipment_type: validatedData.shipment_type || "single_single",
          customer_id: customerId,
          pickup_location_id: pickupLocationId,
          drop_location_id: dropLocationId,
          material_id: materialId,
          quantity: validatedData.quantity || null,
          weight_kg: validatedData.weight_kg || null,
          volume_cbm: validatedData.volume_cbm || null,
          length_cm: validatedData.length_cm || null,
          breadth_cm: validatedData.breadth_cm || null,
          height_cm: validatedData.height_cm || null,
          notes: validatedData.notes || null,
          status: "created" as const,
        };

        const { error } = await supabase.from("shipments").insert(shipmentData);

        if (error) {
          importResults.push({
            row: rowNum,
            shipmentCode: validatedData.shipment_code,
            status: "error",
            message: error.message,
          });
        } else {
          let warnings: string[] = [];
          if (row.customer_display_name && !customerId) warnings.push("customer not found");
          if (row.pickup_location_name && !pickupLocationId) warnings.push("pickup location not found");
          if (row.drop_location_name && !dropLocationId) warnings.push("drop location not found");
          if (row.material_name && !materialId) warnings.push("material not found");

          // Check if required lookups failed - treat as error
          if ((row.customer_display_name && !customerId) || 
              (row.pickup_location_name && !pickupLocationId) || 
              (row.drop_location_name && !dropLocationId)) {
            importResults.push({
              row: rowNum,
              shipmentCode: validatedData.shipment_code,
              status: "error",
              message: `Failed: ${warnings.join(", ")}`,
            });
            setProgress(Math.round(((i + 1) / totalRows) * 100));
            continue;
          }

          importResults.push({
            row: rowNum,
            shipmentCode: validatedData.shipment_code,
            status: "success",
            message: warnings.length > 0 ? `Imported (${warnings.join(", ")})` : "Imported successfully",
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
        description: `${successCount} added, ${skippedCount} skipped, ${errorCount} errors`,
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
          <DialogTitle>Bulk Import Shipments</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple shipments at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instructions */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Instructions</AlertTitle>
            <AlertDescription>
              <ol className="list-decimal list-inside space-y-1 mt-2 text-sm">
                <li>Download the CSV template below</li>
                <li>Fill in shipment details (one shipment per row)</li>
                <li><strong>Required fields:</strong> shipment_code, customer_display_name, pickup_location_name, drop_location_name</li>
                <li>Use exact names for Customer, Locations, and Material to auto-link</li>
                <li>Shipments with duplicate codes will be skipped</li>
                <li>Valid shipment types: single_single, single_multi, multi_single, multi_multi (or with spaces/dashes)</li>
              </ol>
            </AlertDescription>
          </Alert>

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

          {/* Progress */}
          {importing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Importing shipments...</span>
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
                      {successCount} Added
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
                        className={`flex items-center justify-between p-2 rounded text-sm ${
                          result.status === "success"
                            ? "bg-green-50 dark:bg-green-950/20"
                            : result.status === "error"
                            ? "bg-red-50 dark:bg-red-950/20"
                            : "bg-yellow-50 dark:bg-yellow-950/20"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {result.status === "success" && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                          {result.status === "error" && (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          {result.status === "skipped" && (
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          )}
                          <span>
                            Row {result.row}: {result.shipmentCode}
                          </span>
                        </div>
                        <span className="text-muted-foreground text-xs max-w-[200px] truncate">
                          {result.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
