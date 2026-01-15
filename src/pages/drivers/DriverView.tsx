import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DetailRow } from "@/components/DetailRow";
import { StatusToggle } from "@/components/StatusToggle";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DriverDocumentUpload } from "@/components/driver/DriverDocumentUpload";
import { ArrowLeft, Edit, Trash2, Check, X, AlertTriangle, ShieldCheck, ShieldX, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, parseISO, format } from "date-fns";

const getLicenseExpiryStatus = (expiryDate: string | null) => {
  if (!expiryDate) return { status: "missing", label: "Missing", variant: "destructive" as const };
  const days = differenceInDays(parseISO(expiryDate), new Date());
  if (days < 0) return { status: "expired", label: "Expired", variant: "destructive" as const, days: Math.abs(days) };
  if (days <= 30) return { status: "expiring", label: "Expiring Soon", variant: "secondary" as const, days };
  return { status: "valid", label: "Valid", variant: "default" as const, days };
};

interface Driver {
  id: string; name: string; mobile: string; is_dedicated: boolean; location_code: string | null; is_active: boolean;
  license_number: string | null; license_issue_date: string | null; license_expiry_date: string | null;
  consent_status: string;
  aadhaar_number: string | null; aadhaar_verified: boolean | null; pan_number: string | null; pan_verified: boolean | null;
  voter_id: string | null; passport_number: string | null;
  police_verification_date: string | null; police_verification_expiry: string | null;
  transporter?: { transporter_name: string };
}

const consentColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  granted: "default", requested: "secondary", not_requested: "outline", revoked: "destructive", expired: "destructive"
};

export default function DriverView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => { if (id) fetchDriver(); }, [id]);

  const fetchDriver = async () => {
    try {
      const { data, error } = await supabase.from("drivers").select(`*, transporter:transporters(transporter_name)`).eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) { navigate("/drivers"); return; }
      setDriver(data);
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const handleStatusToggle = async (newStatus: boolean) => {
    if (!driver) return;
    try {
      const { error } = await supabase.from("drivers").update({ is_active: newStatus }).eq("id", driver.id);
      if (error) throw error;
      setDriver({ ...driver, is_active: newStatus });
      toast({ title: "Success", description: `Driver ${newStatus ? "activated" : "deactivated"}` });
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
  };

  const handleDelete = async () => {
    if (!driver) return;
    try {
      const { error } = await supabase.from("drivers").delete().eq("id", driver.id);
      if (error) throw error;
      toast({ title: "Success", description: "Driver deleted" });
      navigate("/drivers");
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-96"><LoadingSpinner /></div></Layout>;
  if (!driver) return null;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/drivers")}><ArrowLeft className="h-5 w-5" /></Button>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-3xl font-bold">{driver.name}</h1>
                <Badge variant={driver.is_active ? "default" : "secondary"}>{driver.is_active ? "Active" : "Inactive"}</Badge>
                <Badge variant={consentColors[driver.consent_status]}>{driver.consent_status.replace('_', ' ')}</Badge>
              </div>
              <p className="text-muted-foreground">Driver Details</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => navigate(`/drivers/${id}/edit`)}><Edit className="h-4 w-4 mr-2" />Edit</Button>
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}><Trash2 className="h-4 w-4 mr-2" />Delete</Button>
          </div>
        </div>

        <div className="grid gap-6">
          {/* License Expiry Alert */}
          {(() => {
            const licenseStatus = getLicenseExpiryStatus(driver.license_expiry_date);
            if (licenseStatus.status === "expired") {
              return (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>License Expired</AlertTitle>
                  <AlertDescription>
                    This driver's license expired {licenseStatus.days} days ago. Please update the license before assigning trips.
                  </AlertDescription>
                </Alert>
              );
            }
            if (licenseStatus.status === "expiring") {
              return (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertTitle>License Expiring Soon</AlertTitle>
                  <AlertDescription>
                    This driver's license will expire in {licenseStatus.days} days ({driver.license_expiry_date}).
                  </AlertDescription>
                </Alert>
              );
            }
            if (licenseStatus.status === "missing") {
              return (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>License Missing</AlertTitle>
                  <AlertDescription>
                    This driver has no license information on file. Please add license details.
                  </AlertDescription>
                </Alert>
              );
            }
            return null;
          })()}

          {/* KYC Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {driver.aadhaar_verified && driver.pan_verified ? (
                  <ShieldCheck className="h-5 w-5 text-green-500" />
                ) : (
                  <ShieldX className="h-5 w-5 text-orange-500" />
                )}
                KYC Status
                <Badge variant={driver.aadhaar_verified && driver.pan_verified ? "default" : "secondary"}>
                  {driver.aadhaar_verified && driver.pan_verified ? "Verified" : "Incomplete"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`flex items-center justify-between p-4 rounded-lg border ${driver.aadhaar_verified ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" : "bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800"}`}>
                  <div>
                    <p className="font-medium">Aadhaar</p>
                    <p className="text-sm text-muted-foreground">{driver.aadhaar_number || "Not provided"}</p>
                  </div>
                  {driver.aadhaar_verified ? (
                    <Badge variant="default" className="bg-green-500"><Check className="h-3 w-3 mr-1" />Verified</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-orange-500 text-white"><X className="h-3 w-3 mr-1" />Pending</Badge>
                  )}
                </div>
                <div className={`flex items-center justify-between p-4 rounded-lg border ${driver.pan_verified ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" : "bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800"}`}>
                  <div>
                    <p className="font-medium">PAN</p>
                    <p className="text-sm text-muted-foreground">{driver.pan_number || "Not provided"}</p>
                  </div>
                  {driver.pan_verified ? (
                    <Badge variant="default" className="bg-green-500"><Check className="h-3 w-3 mr-1" />Verified</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-orange-500 text-white"><X className="h-3 w-3 mr-1" />Pending</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <DetailRow label="Name" value={driver.name} />
              <DetailRow label="Mobile" value={driver.mobile} />
              <DetailRow label="Transporter" value={driver.transporter?.transporter_name} />
              <DetailRow label="Location Code" value={driver.location_code} />
              <DetailRow label="Dedicated" value={driver.is_dedicated ? "Yes" : "No"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                License & KYC
                {(() => {
                  const licenseStatus = getLicenseExpiryStatus(driver.license_expiry_date);
                  return (
                    <Badge variant={licenseStatus.variant}>
                      {licenseStatus.status === "expired" && <AlertTriangle className="h-3 w-3 mr-1" />}
                      {licenseStatus.status === "expiring" && <Clock className="h-3 w-3 mr-1" />}
                      License: {licenseStatus.label}
                    </Badge>
                  );
                })()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="license">
                <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="license">License</TabsTrigger><TabsTrigger value="kyc">KYC Documents</TabsTrigger><TabsTrigger value="police">Police Verification</TabsTrigger></TabsList>
                <TabsContent value="license" className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                  <DetailRow label="License Number" value={driver.license_number} />
                  <DetailRow label="Issue Date" value={driver.license_issue_date ? format(parseISO(driver.license_issue_date), "dd MMM yyyy") : undefined} />
                  <div>
                    <p className="text-sm text-muted-foreground">Expiry Date</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{driver.license_expiry_date ? format(parseISO(driver.license_expiry_date), "dd MMM yyyy") : "—"}</p>
                      {(() => {
                        const licenseStatus = getLicenseExpiryStatus(driver.license_expiry_date);
                        if (licenseStatus.status !== "valid") {
                          return <Badge variant={licenseStatus.variant} className="text-xs">{licenseStatus.label}</Badge>;
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="kyc" className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                  <DetailRow label="Aadhaar Number" value={driver.aadhaar_number} />
                  <div className="flex items-center space-x-2">{driver.aadhaar_verified ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />}<span>Aadhaar {driver.aadhaar_verified ? "Verified" : "Not Verified"}</span></div>
                  <DetailRow label="PAN Number" value={driver.pan_number} />
                  <div className="flex items-center space-x-2">{driver.pan_verified ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />}<span>PAN {driver.pan_verified ? "Verified" : "Not Verified"}</span></div>
                  <DetailRow label="Voter ID" value={driver.voter_id} />
                  <DetailRow label="Passport Number" value={driver.passport_number} />
                </TabsContent>
                <TabsContent value="police" className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  <DetailRow label="Verification Date" value={driver.police_verification_date ? format(parseISO(driver.police_verification_date), "dd MMM yyyy") : undefined} />
                  <DetailRow label="Expiry Date" value={driver.police_verification_expiry ? format(parseISO(driver.police_verification_expiry), "dd MMM yyyy") : undefined} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Document Upload Section */}
          <DriverDocumentUpload driverId={driver.id} driverName={driver.name} />

          <StatusToggle isActive={driver.is_active} onToggle={handleStatusToggle} />
        </div>

        <ConfirmDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} title="Delete Driver" description={`Are you sure you want to delete "${driver.name}"?`} onConfirm={handleDelete} confirmText="Delete" variant="destructive" />
      </div>
    </Layout>
  );
}
