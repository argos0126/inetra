import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Download, Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { validateDriverRow } from "@/schemas/validation.schemas";

interface ImportResult {
  row: number;
  name: string;
  status: "success" | "error" | "skipped";
  message: string;
}

interface DriverBulkImportProps {
  onImportComplete: () => void;
}

const CSV_TEMPLATE_HEADERS = [
  "name",
  "mobile",
  "license_number",
  "license_issue_date",
  "license_expiry_date",
  "aadhaar_number",
  "pan_number",
  "voter_id",
  "passport_number",
  "location_code",
  "is_dedicated",
  "is_active",
];

const CSV_TEMPLATE_EXAMPLE = [
  "John Doe",
  "9876543210",
  "DL1234567890",
  "2020-01-15",
  "2030-01-14",
  "123456789012",
  "ABCDE1234F",
  "ABC1234567",
  "P1234567",
  "LOC001",
  "true",
  "true",
];

export function DriverBulkImport({ onImportComplete }: DriverBulkImportProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const downloadTemplate = () => {
    const csvContent = [
      CSV_TEMPLATE_HEADERS.join(","),
      CSV_TEMPLATE_EXAMPLE.join(","),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "driver_import_template.csv";
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

  const validateRow = (row: Record<string, string>, rowNum: number): { valid: boolean; message: string } => {
    if (!row.name || row.name.trim().length < 2) {
      return { valid: false, message: "Name is required (min 2 characters)" };
    }

    if (!row.mobile || !/^[6-9]\d{9}$/.test(row.mobile)) {
      return { valid: false, message: "Valid 10-digit Indian mobile number required" };
    }

    if (row.aadhaar_number && !/^\d{12}$/.test(row.aadhaar_number)) {
      return { valid: false, message: "Aadhaar must be 12 digits" };
    }

    if (row.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(row.pan_number)) {
      return { valid: false, message: "Invalid PAN format" };
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
        const rowNum = i + 2; // +2 because row 1 is header, and we're 0-indexed

        // Use Zod schema validation
        const validation = validateDriverRow(row);
        if (!validation.success) {
          importResults.push({
            row: rowNum,
            name: row.name || "Unknown",
            status: "error",
            message: validation.error || "Validation failed",
          });
          setProgress(Math.round(((i + 1) / totalRows) * 100));
          continue;
        }

        const validatedData = validation.data!;

        // Check for duplicate mobile
        const { data: existing } = await supabase
          .from("drivers")
          .select("id")
          .eq("mobile", validatedData.mobile)
          .maybeSingle();

        if (existing) {
          importResults.push({
            row: rowNum,
            name: validatedData.name,
            status: "skipped",
            message: "Driver with this mobile already exists",
          });
          setProgress(Math.round(((i + 1) / totalRows) * 100));
          continue;
        }

        // Insert driver
        const driverData = {
          name: validatedData.name,
          mobile: validatedData.mobile,
          license_number: validatedData.license_number || null,
          license_issue_date: validatedData.license_issue_date || null,
          license_expiry_date: validatedData.license_expiry_date || null,
          aadhaar_number: validatedData.aadhaar_number || null,
          pan_number: validatedData.pan_number || null,
          voter_id: validatedData.voter_id || null,
          passport_number: validatedData.passport_number || null,
          location_code: validatedData.location_code || null,
          is_dedicated: validatedData.is_dedicated,
          is_active: validatedData.is_active,
        };

        const { error } = await supabase.from("drivers").insert(driverData);

        if (error) {
          importResults.push({
            row: rowNum,
            name: validatedData.name,
            status: "error",
            message: error.message,
          });
        } else {
          importResults.push({
            row: rowNum,
            name: validatedData.name,
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Bulk Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Import Drivers</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple drivers at once
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
                <li>Fill in driver details (one driver per row)</li>
                <li>Save the file and upload it back</li>
                <li>Drivers with duplicate mobile numbers will be skipped</li>
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
                <span>Importing drivers...</span>
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
                            Row {result.row}: {result.name}
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