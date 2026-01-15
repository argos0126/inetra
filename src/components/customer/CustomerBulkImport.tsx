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
import { validateCustomerRow } from "@/schemas/validation.schemas";

interface ImportResult {
  row: number;
  name: string;
  status: "success" | "error" | "skipped";
  message: string;
}

interface CustomerBulkImportProps {
  onImportComplete: () => void;
}

const CSV_TEMPLATE_HEADERS = [
  "display_name",
  "company_name",
  "email",
  "phone",
  "address",
  "city",
  "state",
  "pincode",
  "gst_number",
  "pan_number",
  "integration_code",
  "is_active",
];

const CSV_TEMPLATE_EXAMPLE = [
  "Acme Corporation",
  "Acme Corp Pvt Ltd",
  "contact@acme.com",
  "9876543210",
  "123 Business Park",
  "Mumbai",
  "Maharashtra",
  "400001",
  "27AABCU9603R1ZM",
  "AABCU9603R",
  "ACME001",
  "true",
];

export function CustomerBulkImport({ onImportComplete }: CustomerBulkImportProps) {
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
    link.download = "customer_import_template.csv";
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
    if (!row.display_name || row.display_name.trim().length < 2) {
      return { valid: false, message: "Display name is required (min 2 characters)" };
    }

    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      return { valid: false, message: "Invalid email format" };
    }

    if (row.phone && !/^[6-9]\d{9}$/.test(row.phone)) {
      return { valid: false, message: "Phone must be a valid 10-digit Indian number" };
    }

    if (row.gst_number && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/i.test(row.gst_number)) {
      return { valid: false, message: "Invalid GST number format" };
    }

    if (row.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(row.pan_number)) {
      return { valid: false, message: "Invalid PAN format" };
    }

    if (row.pincode && !/^\d{6}$/.test(row.pincode)) {
      return { valid: false, message: "Pincode must be 6 digits" };
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
        const validation = validateCustomerRow(row);
        if (!validation.success) {
          importResults.push({
            row: rowNum,
            name: row.display_name || "Unknown",
            status: "error",
            message: validation.error || "Validation failed",
          });
          setProgress(Math.round(((i + 1) / totalRows) * 100));
          continue;
        }

        const validatedData = validation.data!;

        // Check for duplicate by display_name and email combo (if email provided)
        let query = supabase.from("customers").select("id").eq("display_name", validatedData.display_name);
        if (validatedData.email) {
          query = query.eq("email", validatedData.email.toLowerCase());
        }
        const { data: existing } = await query.maybeSingle();

        if (existing) {
          importResults.push({
            row: rowNum,
            name: validatedData.display_name,
            status: "skipped",
            message: "Customer with this name/email already exists",
          });
          setProgress(Math.round(((i + 1) / totalRows) * 100));
          continue;
        }

        const customerData = {
          display_name: validatedData.display_name,
          company_name: validatedData.company_name?.trim() || null,
          email: validatedData.email?.toLowerCase() || null,
          phone: validatedData.phone || null,
          address: validatedData.address?.trim() || null,
          city: validatedData.city?.trim() || null,
          state: validatedData.state?.trim() || null,
          pincode: validatedData.pincode || null,
          gst_number: validatedData.gst_number || null,
          pan_number: validatedData.pan_number || null,
          integration_code: validatedData.integration_code?.trim() || null,
          is_active: validatedData.is_active,
        };

        const { error } = await supabase.from("customers").insert(customerData);

        if (error) {
          importResults.push({
            row: rowNum,
            name: validatedData.display_name,
            status: "error",
            message: error.message,
          });
        } else {
          importResults.push({
            row: rowNum,
            name: validatedData.display_name,
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
          <DialogTitle>Bulk Import Customers</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple customers at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Instructions</AlertTitle>
            <AlertDescription>
              <ol className="list-decimal list-inside space-y-1 mt-2 text-sm">
                <li>Download the CSV template below</li>
                <li>Fill in customer details (one customer per row)</li>
                <li>Save the file and upload it back</li>
                <li>Duplicate customers (same name + email) will be skipped</li>
              </ol>
            </AlertDescription>
          </Alert>

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

          {importing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Importing customers...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

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
