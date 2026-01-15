import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { DataTable } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { DriverBulkImport } from "@/components/driver/DriverBulkImport";
import { AlertTriangle, CheckCircle, Clock, XCircle, ShieldCheck, ShieldX } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Transporter {
  id: string;
  transporter_name: string;
}

interface Driver {
  id: string;
  name: string;
  mobile: string;
  license_number: string | null;
  license_expiry_date: string | null;
  is_dedicated: boolean;
  is_active: boolean;
  aadhaar_verified: boolean | null;
  pan_verified: boolean | null;
  consent_status: string;
  transporter?: Transporter;
}

// Map consent_status from drivers table to display values
const consentStatusMap: Record<string, { color: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  granted: { color: "default", label: "Granted" },
  requested: { color: "secondary", label: "Requested" },
  not_requested: { color: "outline", label: "Not Requested" },
  revoked: { color: "destructive", label: "Revoked" },
  expired: { color: "destructive", label: "Expired" }
};

const consentIcons: Record<string, React.ReactNode> = {
  granted: <CheckCircle className="h-3 w-3" />,
  requested: <Clock className="h-3 w-3" />,
  not_requested: <XCircle className="h-3 w-3" />,
  revoked: <XCircle className="h-3 w-3" />,
  expired: <AlertTriangle className="h-3 w-3" />
};

// Helper to check license expiry status
function getLicenseExpiryStatus(expiryDate: string | null): { status: 'valid' | 'expiring' | 'expired' | 'missing'; daysLeft: number | null } {
  if (!expiryDate) return { status: 'missing', daysLeft: null };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  
  const diffTime = expiry.getTime() - today.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (daysLeft < 0) return { status: 'expired', daysLeft };
  if (daysLeft <= 30) return { status: 'expiring', daysLeft };
  return { status: 'valid', daysLeft };
}

export default function Drivers() {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [driverToDelete, setDriverToDelete] = useState<Driver | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const channel = supabase
      .channel('drivers-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => fetchDrivers())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      const { data, error } = await supabase.from("drivers").select(`
        *,
        transporter:transporters(id, transporter_name)
      `).order("created_at", { ascending: false });
      if (error) throw error;
      setDrivers(data || []);
    } catch (error: any) {
      toast({ title: "Error fetching drivers", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: "name", label: "Driver Name" },
    { key: "mobile", label: "Mobile" },
    { key: "transporter", label: "Transporter", render: (value: Transporter) => value?.transporter_name || "-" },
    { 
      key: "license_number", 
      label: "License", 
      render: (value: string | null, row: Driver) => {
        if (!value) {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Missing
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>License number not provided</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        return <span className="font-mono text-sm">{value}</span>;
      }
    },
    { 
      key: "license_expiry_date", 
      label: "License Expiry",
      render: (value: string | null) => {
        const { status, daysLeft } = getLicenseExpiryStatus(value);
        
        if (status === 'missing') {
          return <span className="text-muted-foreground">-</span>;
        }
        
        if (status === 'expired') {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Expired
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>License expired {Math.abs(daysLeft!)} days ago</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        
        if (status === 'expiring') {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="secondary" className="text-xs bg-orange-500/20 text-orange-600 border-orange-400">
                    <Clock className="h-3 w-3 mr-1" />
                    {daysLeft} days
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>License expires on {value}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        
        return (
          <span className="text-sm text-muted-foreground">{value}</span>
        );
      }
    },
    { 
      key: "consent_status", 
      label: "Consent", 
      render: (value: string, row: Driver) => {
        // Get consent status directly from drivers table
        const status = value || "not_requested";
        const statusInfo = consentStatusMap[status] || consentStatusMap.not_requested;
        return (
          <Badge variant={statusInfo.color} className="text-xs">
            {consentIcons[status] || consentIcons.not_requested}
            <span className="ml-1">{statusInfo.label}</span>
          </Badge>
        );
      }
    },
    { 
      key: "kyc_status", 
      label: "KYC",
      render: (_: any, row: Driver) => {
        const hasAadhaar = row.aadhaar_verified;
        const hasPan = row.pan_verified;
        const kycComplete = hasAadhaar && hasPan;
        
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge 
                  variant={kycComplete ? "default" : "outline"} 
                  className={`text-xs ${kycComplete ? 'bg-green-600' : 'text-orange-600 border-orange-400'}`}
                >
                  {kycComplete ? (
                    <><ShieldCheck className="h-3 w-3 mr-1" />Verified</>
                  ) : (
                    <><ShieldX className="h-3 w-3 mr-1" />Incomplete</>
                  )}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p className="flex items-center gap-1">
                    {hasAadhaar ? <CheckCircle className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
                    Aadhaar {hasAadhaar ? 'Verified' : 'Pending'}
                  </p>
                  <p className="flex items-center gap-1">
                    {hasPan ? <CheckCircle className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
                    PAN {hasPan ? 'Verified' : 'Pending'}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
    },
    { key: "is_active", label: "Status", render: (value: boolean) => (
      <Badge variant={value ? "default" : "destructive"}>{value ? "Active" : "Inactive"}</Badge>
    ) }
  ];

  const handleAdd = () => navigate("/drivers/add");
  const handleEdit = (driver: Driver) => navigate(`/drivers/${driver.id}/edit`);
  const handleView = (driver: Driver) => navigate(`/drivers/${driver.id}`);

  const handleDeleteClick = (driver: Driver) => {
    setDriverToDelete(driver);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!driverToDelete) return;
    try {
      const { error } = await supabase.from("drivers").delete().eq("id", driverToDelete.id);
      if (error) throw error;
      setDrivers(drivers.filter(d => d.id !== driverToDelete.id));
      toast({ title: "Driver deleted", description: `${driverToDelete.name} has been removed.` });
    } catch (error: any) {
      toast({ title: "Error deleting driver", description: error.message, variant: "destructive" });
    }
    setDriverToDelete(null);
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><LoadingSpinner /></div></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <DataTable
          title="Driver Management"
          description="Manage driver profiles and compliance documents"
          columns={columns}
          data={drivers}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
          onView={handleView}
          searchPlaceholder="Search drivers..."
          headerActions={<DriverBulkImport onImportComplete={fetchDrivers} />}
        />

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Driver"
          description={`Are you sure you want to delete "${driverToDelete?.name}"? This action cannot be undone.`}
          confirmText="Delete"
          onConfirm={handleDeleteConfirm}
          variant="destructive"
        />
      </div>
    </Layout>
  );
}
