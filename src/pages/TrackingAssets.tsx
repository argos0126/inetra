import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { DataTable } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Transporter {
  id: string;
  transporter_name: string;
}

interface TrackingAsset {
  id: string;
  display_name: string;
  asset_type: string;
  asset_id: string | null;
  api_url: string | null;
  last_validated_at: string | null;
  is_active: boolean;
  transporter?: Transporter;
}

const assetTypeColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  gps: "default",
  sim: "secondary",
  whatsapp: "outline",
  driver_app: "default"
};

export default function TrackingAssets() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<TrackingAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<TrackingAsset | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const channel = supabase
      .channel('tracking-assets-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tracking_assets' }, () => fetchAssets())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      const { data, error } = await supabase.from("tracking_assets").select(`
        *,
        transporter:transporters(id, transporter_name)
      `).order("created_at", { ascending: false });
      if (error) throw error;
      setAssets(data || []);
    } catch (error: any) {
      toast({ title: "Error fetching tracking assets", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: "display_name", label: "Asset Name" },
    { key: "asset_type", label: "Type", render: (value: string) => (
      <Badge variant={assetTypeColors[value] || "outline"}>{value?.toUpperCase()}</Badge>
    ) },
    { key: "asset_id", label: "Asset ID" },
    { key: "transporter", label: "Transporter", render: (value: Transporter) => value?.transporter_name || "-" },
    { key: "api_url", label: "API URL", render: (value: string) => 
      value ? (
        <span title={value} className="cursor-help">
          {value.length > 25 ? value.substring(0, 25) + "..." : value}
        </span>
      ) : "-"
    },
    { key: "last_validated_at", label: "Last Validated", render: (value: string) => 
      value ? new Date(value).toLocaleDateString() : "-"
    },
    { key: "is_active", label: "Status", render: (value: boolean) => (
      <Badge variant={value ? "default" : "destructive"}>{value ? "Active" : "Inactive"}</Badge>
    ) }
  ];

  const handleAdd = () => navigate("/tracking-assets/add");
  const handleEdit = (asset: TrackingAsset) => navigate(`/tracking-assets/${asset.id}/edit`);
  const handleView = (asset: TrackingAsset) => navigate(`/tracking-assets/${asset.id}`);

  const handleDeleteClick = (asset: TrackingAsset) => {
    setAssetToDelete(asset);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!assetToDelete) return;
    try {
      const { error } = await supabase.from("tracking_assets").delete().eq("id", assetToDelete.id);
      if (error) throw error;
      setAssets(assets.filter(a => a.id !== assetToDelete.id));
      toast({ title: "Asset deleted", description: `${assetToDelete.display_name} has been removed.` });
    } catch (error: any) {
      toast({ title: "Error deleting asset", description: error.message, variant: "destructive" });
    }
    setAssetToDelete(null);
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><LoadingSpinner /></div></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <DataTable
          title="Tracking Assets"
          description="Manage GPS trackers, SIM tracking, and monitoring devices"
          columns={columns}
          data={assets}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
          onView={handleView}
          searchPlaceholder="Search tracking assets..."
        />

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Tracking Asset"
          description={`Are you sure you want to delete "${assetToDelete?.display_name}"? This action cannot be undone.`}
          confirmText="Delete"
          onConfirm={handleDeleteConfirm}
          variant="destructive"
        />
      </div>
    </Layout>
  );
}
