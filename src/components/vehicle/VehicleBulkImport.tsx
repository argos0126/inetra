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
import { validateVehicleRow } from "@/schemas/validation.schemas";

interface ImportResult {
  row: number;
  vehicleNumber: string;
  status: "success" | "error" | "skipped";
  message: string;
}

interface VehicleBulkImportProps {
  onImportComplete: () => void;
}

const CSV_TEMPLATE_HEADERS = [
  "vehicle_number",
  "vehicle_type",
  "make",
  "model",
  "year",
  "rc_number",
  "rc_issue_date",
  "rc_expiry_date",
  "insurance_number",
  "insurance_issue_date",
  "insurance_expiry_date",
  "fitness_number",
  "fitness_issue_date",
  "fitness_expiry_date",
  "permit_number",
  "permit_issue_date",
  "permit_expiry_date",
  "puc_number",
  "puc_issue_date",
  "puc_expiry_date",
  "location_code",
  "integration_code",
  "is_dedicated",
  "is_active",
];

const CSV_TEMPLATE_EXAMPLE = [
  "MH12AB1234",
  "32 FT MXL",
  "Tata",
  "Prima",
  "2022",
  "RC123456",
  "2022-01-15",
  "2037-01-14",
  "INS123456",
  "2024-01-15",
  "2025-01-14",
  "FIT123456",
  "2024-01-15",
  "2025-01-14",
  "PER123456",
  "2024-01-15",
  "2029-01-14",
  "PUC123456",
  "2024-06-15",
  "2024-12-14",
  "LOC001",
  "INT001",
  "true",
  "true",
];

interface VehicleType {
  id: string;
  type_name: string;
}

export function VehicleBulkImport({ onImportComplete }: VehicleBulkImportProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);

  // Fetch vehicle types when dialog opens
  const fetchVehicleTypes = async () => {
    const { data } = await supabase.from("vehicle_types").select("id, type_name").eq("is_active", true);
    if (data) setVehicleTypes(data);
  };

  const downloadTemplate = () => {
    const csvContent = [
      CSV_TEMPLATE_HEADERS.join(","),
      CSV_TEMPLATE_EXAMPLE.join(","),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "vehicle_import_template.csv";
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
      const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""));
      if (values.length !== headers.length) continue;

      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx];
      });
      rows.push(row);
    }

    return rows;
  };

  const validateRow = (row: Record<string, string>): { valid: boolean; message: string } => {
    if (!row.vehicle_number || row.vehicle_number.trim().length < 4) {
      return { valid: false, message: "Vehicle number is required (min 4 characters)" };
    }

    // Validate vehicle number format (basic Indian format)
    const vehicleNumberRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$/i;
    if (!vehicleNumberRegex.test(row.vehicle_number.replace(/\s/g, ""))) {
      return { valid: false, message: "Invalid vehicle number format" };
    }

    // Validate year if provided
    if (row.year) {
      const year = parseInt(row.year);
      const currentYear = new Date().getFullYear();
      if (isNaN(year) || year < 1900 || year > currentYear + 1) {
        return { valid: false, message: "Invalid year" };
      }
    }

    return { valid: true, message: "Valid" };
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
        const rowNum = i + 2;

        // Use Zod schema validation
        const validation = validateVehicleRow(row);
        if (!validation.success) {
          importResults.push({
            row: rowNum,
            vehicleNumber: row.vehicle_number || "Unknown",
            status: "error",
            message: validation.error || "Validation failed",
          });
          setProgress(Math.round(((i + 1) / totalRows) * 100));
          continue;
        }

        const validatedData = validation.data!;

        // Check for duplicate vehicle number
        const { data: existing } = await supabase
          .from("vehicles")
          .select("id")
          .eq("vehicle_number", validatedData.vehicle_number)
          .maybeSingle();

        if (existing) {
          importResults.push({
            row: rowNum,
            vehicleNumber: validatedData.vehicle_number,
            status: "skipped",
            message: "Vehicle with this number already exists",
          });
          setProgress(Math.round(((i + 1) / totalRows) * 100));
          continue;
        }

        // Match vehicle type by name (case-insensitive)
        let vehicleTypeId: string | null = null;
        const vehicleTypeName = row.vehicle_type?.trim();
        if (vehicleTypeName) {
          const matchedType = vehicleTypes.find(
            vt => vt.type_name.toLowerCase() === vehicleTypeName.toLowerCase()
          );
          if (matchedType) {
            vehicleTypeId = matchedType.id;
          } else {
            importResults.push({
              row: rowNum,
              vehicleNumber: validatedData.vehicle_number,
              status: "error",
              message: `Vehicle type "${vehicleTypeName}" not found`,
            });
            setProgress(Math.round(((i + 1) / totalRows) * 100));
            continue;
          }
        }

        // Insert vehicle
        const vehicleData = {
          vehicle_number: validatedData.vehicle_number,
          vehicle_type_id: vehicleTypeId,
          make: validatedData.make || null,
          model: validatedData.model || null,
          year: validatedData.year || null,
          rc_number: validatedData.rc_number || null,
          rc_issue_date: validatedData.rc_issue_date || null,
          rc_expiry_date: validatedData.rc_expiry_date || null,
          insurance_number: validatedData.insurance_number || null,
          insurance_issue_date: validatedData.insurance_issue_date || null,
          insurance_expiry_date: validatedData.insurance_expiry_date || null,
          fitness_number: validatedData.fitness_number || null,
          fitness_issue_date: validatedData.fitness_issue_date || null,
          fitness_expiry_date: validatedData.fitness_expiry_date || null,
          permit_number: validatedData.permit_number || null,
          permit_issue_date: validatedData.permit_issue_date || null,
          permit_expiry_date: validatedData.permit_expiry_date || null,
          puc_number: validatedData.puc_number || null,
          puc_issue_date: validatedData.puc_issue_date || null,
          puc_expiry_date: validatedData.puc_expiry_date || null,
          location_code: validatedData.location_code || null,
          integration_code: validatedData.integration_code || null,
          is_dedicated: validatedData.is_dedicated,
          is_active: validatedData.is_active,
        };

        const { error } = await supabase.from("vehicles").insert(vehicleData);

        if (error) {
          importResults.push({
            row: rowNum,
            vehicleNumber: validatedData.vehicle_number,
            status: "error",
            message: error.message,
          });
        } else {
          importResults.push({
            row: rowNum,
            vehicleNumber: validatedData.vehicle_number,
            status: "success",
            message: "Imported successfully",
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
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (isOpen) fetchVehicleTypes();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Bulk Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Import Vehicles</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple vehicles at once
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
                <li>Fill in vehicle details (one vehicle per row)</li>
                <li>Dates should be in YYYY-MM-DD format</li>
                <li>Vehicles with duplicate numbers will be skipped</li>
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
                <span>Importing vehicles...</span>
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
                            Row {result.row}: {result.vehicleNumber}
                          </span>
                        </div>
                        <span className="text-muted-foreground text-xs">
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