import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DetailRow } from "@/components/DetailRow";
import { StatusToggle } from "@/components/StatusToggle";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Customer {
  id: string;
  display_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  gst_number: string | null;
  pan_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  integration_code: string | null;
  is_active: boolean;
}

export default function CustomerView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (id) fetchCustomer();
  }, [id]);

  const fetchCustomer = async () => {
    try {
      const { data, error } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) { navigate("/customers"); return; }
      setCustomer(data);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async (newStatus: boolean) => {
    if (!customer) return;
    try {
      const { error } = await supabase.from("customers").update({ is_active: newStatus }).eq("id", customer.id);
      if (error) throw error;
      setCustomer({ ...customer, is_active: newStatus });
      toast({ title: "Success", description: `Customer ${newStatus ? "activated" : "deactivated"}` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!customer) return;
    try {
      const { error } = await supabase.from("customers").delete().eq("id", customer.id);
      if (error) throw error;
      toast({ title: "Success", description: "Customer deleted" });
      navigate("/customers");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-96"><LoadingSpinner /></div></Layout>;
  if (!customer) return null;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/customers")}><ArrowLeft className="h-5 w-5" /></Button>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-3xl font-bold">{customer.display_name}</h1>
                <Badge variant={customer.is_active ? "default" : "secondary"}>{customer.is_active ? "Active" : "Inactive"}</Badge>
              </div>
              <p className="text-muted-foreground">Customer Details</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => navigate(`/customers/${id}/edit`)}><Edit className="h-4 w-4 mr-2" />Edit</Button>
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}><Trash2 className="h-4 w-4 mr-2" />Delete</Button>
          </div>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <DetailRow label="Display Name" value={customer.display_name} />
              <DetailRow label="Company Name" value={customer.company_name} />
              <DetailRow label="Email" value={customer.email} />
              <DetailRow label="Phone" value={customer.phone} />
              <DetailRow label="Integration Code" value={customer.integration_code} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Address Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <DetailRow label="Address" value={customer.address} className="md:col-span-2" />
              <DetailRow label="City" value={customer.city} />
              <DetailRow label="State" value={customer.state} />
              <DetailRow label="Pincode" value={customer.pincode} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Tax Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DetailRow label="GST Number" value={customer.gst_number} />
              <DetailRow label="PAN Number" value={customer.pan_number} />
            </CardContent>
          </Card>

          <StatusToggle isActive={customer.is_active} onToggle={handleStatusToggle} />
        </div>

        <ConfirmDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} title="Delete Customer" description={`Are you sure you want to delete "${customer.display_name}"?`} onConfirm={handleDelete} confirmText="Delete" variant="destructive" />
      </div>
    </Layout>
  );
}
