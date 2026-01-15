import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { DataTable } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { CustomerBulkImport } from "@/components/customer/CustomerBulkImport";
import { UserPlus } from "lucide-react";
import { getDisplayErrorMessage, logError } from "@/utils/errorHandler";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Customer {
  id: string;
  display_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  gst_number: string | null;
  is_active: boolean;
  user_id: string | null;
}

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const channel = supabase
      .channel('customers-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => fetchCustomers())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      logError(error, "fetchCustomers");
      toast({ title: "Error fetching customers", description: getDisplayErrorMessage(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAccounts = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-missing-entity-users");
      if (error) throw error;
      
      const customerResults = data?.results?.customers;
      if (customerResults) {
        toast({
          title: "Sync Complete",
          description: `Created ${customerResults.created} customer accounts. ${customerResults.failed} failed.`,
        });
      }
      fetchCustomers();
    } catch (error: any) {
      logError(error, "handleSyncAccounts");
      toast({ title: "Sync Failed", description: getDisplayErrorMessage(error), variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const customersWithoutAccounts = customers.filter(c => !c.user_id).length;

  const columns = [
    { key: "display_name", label: "Customer Name" },
    { key: "company_name", label: "Company" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "city", label: "City" },
    { key: "gst_number", label: "GST Number" },
    { key: "user_id", label: "Account", render: (value: string | null) => (
      <Badge variant={value ? "default" : "secondary"}>{value ? "Linked" : "No Account"}</Badge>
    ) },
    { key: "is_active", label: "Status", render: (value: boolean) => (
      <Badge variant={value ? "default" : "destructive"}>{value ? "Active" : "Inactive"}</Badge>
    ) }
  ];

  const handleAdd = () => navigate("/customers/add");
  const handleEdit = (customer: Customer) => navigate(`/customers/${customer.id}/edit`);
  const handleView = (customer: Customer) => navigate(`/customers/${customer.id}`);

  const handleDeleteClick = (customer: Customer) => {
    setCustomerToDelete(customer);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!customerToDelete) return;
    try {
      const { error } = await supabase.from("customers").delete().eq("id", customerToDelete.id);
      if (error) throw error;
      setCustomers(customers.filter(c => c.id !== customerToDelete.id));
      toast({ title: "Customer deleted", description: `${customerToDelete.display_name} has been removed.` });
    } catch (error: any) {
      logError(error, "handleDelete");
      toast({ title: "Error deleting customer", description: getDisplayErrorMessage(error), variant: "destructive" });
    }
    setCustomerToDelete(null);
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><LoadingSpinner /></div></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <DataTable
          title="Customers"
          description="Manage customer/consignee information"
          columns={columns}
          data={customers}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
          onView={handleView}
          searchPlaceholder="Search customers..."
          headerActions={
            <div className="flex gap-2">
              {customersWithoutAccounts > 0 && (
                <Button variant="outline" onClick={handleSyncAccounts} disabled={syncing}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {syncing ? "Syncing..." : `Create ${customersWithoutAccounts} Accounts`}
                </Button>
              )}
              <CustomerBulkImport onImportComplete={fetchCustomers} />
            </div>
          }
        />

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Customer"
          description={`Are you sure you want to delete "${customerToDelete?.display_name}"? This action cannot be undone.`}
          confirmText="Delete"
          onConfirm={handleDeleteConfirm}
          variant="destructive"
        />
      </div>
    </Layout>
  );
}