import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { DataTable } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { UserPlus } from "lucide-react";
import { getDisplayErrorMessage, logError } from "@/utils/errorHandler";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Transporter {
  id: string;
  transporter_name: string;
  code: string | null;
  email: string | null;
  mobile: string | null;
  city: string | null;
  gstin: string | null;
  is_active: boolean;
  user_id: string | null;
}

export default function Transporters() {
  const navigate = useNavigate();
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transporterToDelete, setTransporterToDelete] = useState<Transporter | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const channel = supabase
      .channel('transporters-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transporters' }, () => fetchTransporters())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    fetchTransporters();
  }, []);

  const fetchTransporters = async () => {
    try {
      const { data, error } = await supabase.from("transporters").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setTransporters(data || []);
    } catch (error: any) {
      logError(error, "fetchTransporters");
      toast({ title: "Error fetching transporters", description: getDisplayErrorMessage(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAccounts = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-missing-entity-users");
      if (error) throw error;
      
      const transporterResults = data?.results?.transporters;
      if (transporterResults) {
        toast({
          title: "Sync Complete",
          description: `Created ${transporterResults.created} transporter accounts. ${transporterResults.failed} failed.`,
        });
      }
      fetchTransporters();
    } catch (error: any) {
      logError(error, "handleSyncAccounts");
      toast({ title: "Sync Failed", description: getDisplayErrorMessage(error), variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const transportersWithoutAccounts = transporters.filter(t => !t.user_id).length;

  const columns = [
    { key: "transporter_name", label: "Transporter Name" },
    { key: "code", label: "Code" },
    { key: "email", label: "Email" },
    { key: "mobile", label: "Mobile" },
    { key: "city", label: "City" },
    { key: "gstin", label: "GSTIN" },
    { key: "user_id", label: "Account", render: (value: string | null) => (
      <Badge variant={value ? "default" : "secondary"}>{value ? "Linked" : "No Account"}</Badge>
    ) },
    { key: "is_active", label: "Status", render: (value: boolean) => (
      <Badge variant={value ? "default" : "destructive"}>{value ? "Active" : "Inactive"}</Badge>
    ) }
  ];

  const handleAdd = () => navigate("/transporters/add");
  const handleEdit = (transporter: Transporter) => navigate(`/transporters/${transporter.id}/edit`);
  const handleView = (transporter: Transporter) => navigate(`/transporters/${transporter.id}`);

  const handleDeleteClick = (transporter: Transporter) => {
    setTransporterToDelete(transporter);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!transporterToDelete) return;
    try {
      const { error } = await supabase.from("transporters").delete().eq("id", transporterToDelete.id);
      if (error) throw error;
      setTransporters(transporters.filter(t => t.id !== transporterToDelete.id));
      toast({ title: "Transporter deleted", description: `${transporterToDelete.transporter_name} has been removed.` });
    } catch (error: any) {
      logError(error, "handleDelete");
      toast({ title: "Error deleting transporter", description: getDisplayErrorMessage(error), variant: "destructive" });
    }
    setTransporterToDelete(null);
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><LoadingSpinner /></div></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <DataTable
          title="Transporters"
          description="Manage transporter/carrier information"
          columns={columns}
          data={transporters}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
          onView={handleView}
          searchPlaceholder="Search transporters..."
          headerActions={
            transportersWithoutAccounts > 0 ? (
              <Button variant="outline" onClick={handleSyncAccounts} disabled={syncing}>
                <UserPlus className="h-4 w-4 mr-2" />
                {syncing ? "Syncing..." : `Create ${transportersWithoutAccounts} Accounts`}
              </Button>
            ) : undefined
          }
        />

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Transporter"
          description={`Are you sure you want to delete "${transporterToDelete?.transporter_name}"? This action cannot be undone.`}
          confirmText="Delete"
          onConfirm={handleDeleteConfirm}
          variant="destructive"
        />
      </div>
    </Layout>
  );
}
