import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload,
  FileImage,
  FileText,
  Loader2,
  CheckCircle,
  X,
  Download,
  Trash2,
  Eye,
} from "lucide-react";

interface ShipmentPodUploadProps {
  shipmentId: string;
  shipmentCode: string;
  podFilePath: string | null;
  podFileName: string | null;
  podCollected: boolean;
  onUploadComplete: () => void;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function ShipmentPodUpload({
  shipmentId,
  shipmentCode,
  podFilePath,
  podFileName,
  podCollected,
  onUploadComplete,
}: ShipmentPodUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, WebP image or PDF document",
        variant: "destructive",
      });
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      // Generate unique file path
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${shipmentCode}_POD_${Date.now()}.${fileExt}`;
      const filePath = `${shipmentId}/${fileName}`;

      // Delete existing file if present
      if (podFilePath) {
        await supabase.storage.from("pod-documents").remove([podFilePath]);
      }

      // Upload new file
      const { error: uploadError } = await supabase.storage
        .from("pod-documents")
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Update shipment record
      const { error: updateError } = await supabase
        .from("shipments")
        .update({
          pod_file_path: filePath,
          pod_file_name: selectedFile.name,
          pod_collected: true,
          pod_collected_at: new Date().toISOString(),
        })
        .eq("id", shipmentId);

      if (updateError) throw updateError;

      toast({
        title: "POD Uploaded",
        description: `Proof of delivery uploaded for ${shipmentCode}`,
      });

      setOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      onUploadComplete();
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!podFilePath) return;

    setDeleting(true);
    try {
      // Delete file from storage
      const { error: deleteError } = await supabase.storage
        .from("pod-documents")
        .remove([podFilePath]);

      if (deleteError) throw deleteError;

      // Update shipment record
      const { error: updateError } = await supabase
        .from("shipments")
        .update({
          pod_file_path: null,
          pod_file_name: null,
          pod_collected: false,
          pod_collected_at: null,
        })
        .eq("id", shipmentId);

      if (updateError) throw updateError;

      toast({
        title: "POD Deleted",
        description: `Proof of delivery removed for ${shipmentCode}`,
      });

      onUploadComplete();
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async () => {
    if (!podFilePath) return;

    try {
      const { data, error } = await supabase.storage
        .from("pod-documents")
        .download(podFilePath);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = podFileName || "POD_document";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Download failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleView = async () => {
    if (!podFilePath) return;

    try {
      const { data } = await supabase.storage
        .from("pod-documents")
        .getPublicUrl(podFilePath);

      // For private buckets, we need to create a signed URL
      const { data: signedData, error } = await supabase.storage
        .from("pod-documents")
        .createSignedUrl(podFilePath, 3600); // 1 hour expiry

      if (error) throw error;

      window.open(signedData.signedUrl, "_blank");
    } catch (error: any) {
      toast({
        title: "View failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getFileIcon = () => {
    if (podFileName?.endsWith(".pdf")) {
      return <FileText className="h-4 w-4" />;
    }
    return <FileImage className="h-4 w-4" />;
  };

  return (
    <>
      {/* Trigger Button / Status Display */}
      <div className="flex items-center gap-2">
        {podFilePath ? (
          <div className="flex items-center gap-2">
            <Badge
              variant="default"
              className="bg-green-600 hover:bg-green-700 cursor-pointer flex items-center gap-1"
              onClick={() => setOpen(true)}
            >
              <CheckCircle className="h-3 w-3" />
              POD Uploaded
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleView}
              title="View POD"
            >
              <Eye className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleDownload}
              title="Download POD"
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            className="h-7 text-xs"
          >
            <Upload className="h-3 w-3 mr-1" />
            Upload POD
          </Button>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Proof of Delivery</DialogTitle>
            <DialogDescription>
              Upload POD document for shipment <strong>{shipmentCode}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Existing POD Info */}
            {podFilePath && (
              <Alert className="border-green-500/50 bg-green-500/10">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getFileIcon()}
                    <span className="text-sm truncate max-w-[200px]">
                      {podFileName}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleView}
                      className="h-7"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDownload}
                      className="h-7"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="h-7 text-destructive hover:text-destructive"
                    >
                      {deleting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* File Upload Area */}
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />

              {!selectedFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {podFilePath ? "Upload new POD" : "Click to upload POD"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPEG, PNG, WebP or PDF (max 10MB)
                  </p>
                </div>
              ) : (
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {selectedFile.type.startsWith("image/") ? (
                        <FileImage className="h-5 w-5 text-blue-500" />
                      ) : (
                        <FileText className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium truncate max-w-[200px]">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={clearSelection}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Image Preview */}
                  {previewUrl && (
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                      <img
                        src={previewUrl}
                        alt="POD Preview"
                        className="object-contain w-full h-full"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload POD
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
