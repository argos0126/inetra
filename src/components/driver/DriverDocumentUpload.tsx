import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, Trash2, Eye, Loader2, Check, X, Save, ShieldCheck } from "lucide-react";

interface DriverDocument {
  id: string;
  document_type: string;
  file_path: string;
  file_name: string;
  uploaded_at: string;
}

interface DriverDocumentUploadProps {
  driverId: string;
  driverName: string;
  onVerificationChange?: () => void;
}

const DOCUMENT_TYPES = [
  { type: "license", label: "License Scan", description: "Upload driving license copy", dbField: "license_number" },
  { type: "aadhaar", label: "Aadhaar Card", description: "Upload Aadhaar card copy", dbField: "aadhaar_number", verifyField: "aadhaar_verified", pattern: /^\d{12}$/, placeholder: "12-digit Aadhaar" },
  { type: "pan", label: "PAN Card", description: "Upload PAN card copy", dbField: "pan_number", verifyField: "pan_verified", pattern: /^[A-Z]{5}\d{4}[A-Z]$/, placeholder: "e.g., ABCDE1234F" },
];

export function DriverDocumentUpload({ driverId, driverName, onVerificationChange }: DriverDocumentUploadProps) {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [savingNumber, setSavingNumber] = useState<string | null>(null);
  
  // Document numbers from database
  const [docNumbers, setDocNumbers] = useState<Record<string, string>>({
    license: "",
    aadhaar: "",
    pan: "",
  });
  
  // Local edits
  const [editedNumbers, setEditedNumbers] = useState<Record<string, string>>({
    license: "",
    aadhaar: "",
    pan: "",
  });

  // Verification status
  const [verified, setVerified] = useState<Record<string, boolean>>({
    aadhaar: false,
    pan: false,
  });

  useEffect(() => {
    fetchData();
  }, [driverId]);

  const fetchData = async () => {
    try {
      // Fetch documents
      const { data: docs, error: docsError } = await supabase
        .from("driver_documents")
        .select("*")
        .eq("driver_id", driverId);
      
      if (docsError) throw docsError;
      setDocuments(docs || []);

      // Fetch driver data for document numbers
      const { data: driver, error: driverError } = await supabase
        .from("drivers")
        .select("license_number, aadhaar_number, aadhaar_verified, pan_number, pan_verified")
        .eq("id", driverId)
        .maybeSingle();

      if (driverError) throw driverError;

      if (driver) {
        const numbers = {
          license: driver.license_number || "",
          aadhaar: driver.aadhaar_number || "",
          pan: driver.pan_number || "",
        };
        setDocNumbers(numbers);
        setEditedNumbers(numbers);
        setVerified({
          aadhaar: driver.aadhaar_verified || false,
          pan: driver.pan_verified || false,
        });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (docType: string, file: File) => {
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload JPG, PNG, WebP or PDF files only", variant: "destructive" });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 5MB", variant: "destructive" });
      return;
    }

    setUploading(docType);
    
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${driverId}/${docType}.${fileExt}`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("driver-documents")
        .upload(filePath, file, { upsert: true });
      
      if (uploadError) throw uploadError;

      // Check if document record exists
      const existingDoc = documents.find(d => d.document_type === docType);
      
      if (existingDoc) {
        // Update existing record
        const { error: updateError } = await supabase
          .from("driver_documents")
          .update({
            file_path: filePath,
            file_name: file.name,
            uploaded_at: new Date().toISOString(),
          })
          .eq("id", existingDoc.id);
        
        if (updateError) throw updateError;
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from("driver_documents")
          .insert({
            driver_id: driverId,
            document_type: docType,
            file_path: filePath,
            file_name: file.name,
          });
        
        if (insertError) throw insertError;
      }

      // Auto-verify if document number exists
      const docConfig = DOCUMENT_TYPES.find(d => d.type === docType);
      if (docConfig?.verifyField && editedNumbers[docType]) {
        await updateVerification(docType, true);
      }

      toast({ title: "Success", description: "Document uploaded successfully" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  const handleSaveNumber = async (docType: string) => {
    const value = editedNumbers[docType].trim().toUpperCase();
    const docConfig = DOCUMENT_TYPES.find(d => d.type === docType);
    
    if (!docConfig) return;

    // Validate format if pattern exists
    if (value && docConfig.pattern && !docConfig.pattern.test(value)) {
      toast({ 
        title: "Invalid Format", 
        description: `Please enter a valid ${docConfig.label} number`, 
        variant: "destructive" 
      });
      return;
    }

    setSavingNumber(docType);
    
    try {
      const updateData: Record<string, any> = {
        [docConfig.dbField]: value || null,
      };

      // Auto-verify if document is uploaded and number is provided
      if (docConfig.verifyField) {
        const hasDocument = documents.some(d => d.document_type === docType);
        const shouldVerify = hasDocument && !!value;
        updateData[docConfig.verifyField] = shouldVerify;
      }

      const { error } = await supabase
        .from("drivers")
        .update(updateData)
        .eq("id", driverId);

      if (error) throw error;

      setDocNumbers({ ...docNumbers, [docType]: value });
      
      if (docConfig.verifyField) {
        const hasDocument = documents.some(d => d.document_type === docType);
        setVerified({ ...verified, [docType]: hasDocument && !!value });
      }

      toast({ title: "Saved", description: `${docConfig.label} number updated` });
      onVerificationChange?.();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingNumber(null);
    }
  };

  const updateVerification = async (docType: string, isVerified: boolean) => {
    const docConfig = DOCUMENT_TYPES.find(d => d.type === docType);
    if (!docConfig?.verifyField) return;

    try {
      const { error } = await supabase
        .from("drivers")
        .update({ [docConfig.verifyField]: isVerified })
        .eq("id", driverId);

      if (error) throw error;
      
      setVerified({ ...verified, [docType]: isVerified });
      onVerificationChange?.();
    } catch (error: any) {
      console.error("Verification update error:", error);
    }
  };

  const handleDelete = async (doc: DriverDocument) => {
    setDeleting(doc.id);
    
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("driver-documents")
        .remove([doc.file_path]);
      
      if (storageError) throw storageError;

      // Delete record
      const { error: dbError } = await supabase
        .from("driver_documents")
        .delete()
        .eq("id", doc.id);
      
      if (dbError) throw dbError;

      // Remove verification when document is deleted
      const docConfig = DOCUMENT_TYPES.find(d => d.type === doc.document_type);
      if (docConfig?.verifyField) {
        await updateVerification(doc.document_type, false);
      }

      toast({ title: "Success", description: "Document deleted" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const handleView = async (doc: DriverDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from("driver-documents")
        .createSignedUrl(doc.file_path, 3600);
      
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const getDocumentForType = (type: string) => {
    return documents.find(d => d.document_type === type);
  };

  const hasNumberChanged = (type: string) => {
    return editedNumbers[type] !== docNumbers[type];
  };

  // Calculate KYC completion
  const kycComplete = verified.aadhaar && verified.pan;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Documents & KYC
          <Badge variant={kycComplete ? "default" : "secondary"} className={kycComplete ? "bg-green-600" : ""}>
            {kycComplete ? (
              <><ShieldCheck className="h-3 w-3 mr-1" />KYC Complete</>
            ) : (
              `${documents.length}/${DOCUMENT_TYPES.length} Uploaded`
            )}
          </Badge>
        </CardTitle>
        <CardDescription>
          Upload documents and enter document numbers. KYC is verified when both document and number are provided.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {DOCUMENT_TYPES.map((docType) => {
            const existingDoc = getDocumentForType(docType.type);
            const isUploading = uploading === docType.type;
            const isDeleting = deleting === existingDoc?.id;
            const isSaving = savingNumber === docType.type;
            const isVerified = docType.verifyField ? verified[docType.type] : null;
            const hasDoc = !!existingDoc;
            const hasNumber = !!editedNumbers[docType.type];
            
            return (
              <div
                key={docType.type}
                className={`p-4 rounded-lg border ${
                  isVerified 
                    ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" 
                    : hasDoc
                    ? "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800"
                    : "bg-muted/30 border-dashed"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {isVerified ? (
                      <ShieldCheck className="h-4 w-4 text-green-500" />
                    ) : hasDoc ? (
                      <Check className="h-4 w-4 text-blue-500" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">{docType.label}</span>
                  </div>
                  {isVerified && (
                    <Badge variant="default" className="bg-green-500 text-xs">Verified</Badge>
                  )}
                  {hasDoc && !isVerified && docType.verifyField && (
                    <Badge variant="secondary" className="text-xs">Doc Only</Badge>
                  )}
                </div>
                
                <p className="text-xs text-muted-foreground mb-3">{docType.description}</p>

                {/* Document Number Input */}
                <div className="space-y-2 mb-3">
                  <div className="flex gap-2">
                    <Input
                      value={editedNumbers[docType.type]}
                      onChange={(e) => setEditedNumbers({ 
                        ...editedNumbers, 
                        [docType.type]: e.target.value.toUpperCase() 
                      })}
                      placeholder={docType.placeholder || `Enter ${docType.label} number`}
                      className="text-xs h-8"
                    />
                    {hasNumberChanged(docType.type) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => handleSaveNumber(docType.type)}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Save className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                  {docType.verifyField && hasDoc && !hasNumber && (
                    <p className="text-xs text-orange-600">Enter number to complete verification</p>
                  )}
                  {docType.verifyField && hasNumber && !hasDoc && (
                    <p className="text-xs text-orange-600">Upload document to complete verification</p>
                  )}
                </div>
                
                {existingDoc ? (
                  <div className="space-y-2">
                    <p className="text-xs truncate" title={existingDoc.file_name}>
                      📄 {existingDoc.file_name}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() => handleView(existingDoc)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => handleDelete(existingDoc)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <Label className="cursor-pointer">
                      <Input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(docType.type, file);
                        }}
                        disabled={isUploading}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs h-7"
                        asChild
                        disabled={isUploading}
                      >
                        <span>
                          {isUploading ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Upload className="h-3 w-3 mr-1" />
                          )}
                          Replace
                        </span>
                      </Button>
                    </Label>
                  </div>
                ) : (
                  <Label className="cursor-pointer">
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(docType.type, file);
                      }}
                      disabled={isUploading}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      asChild
                      disabled={isUploading}
                    >
                      <span>
                        {isUploading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Upload
                      </span>
                    </Button>
                  </Label>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
