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

interface Transporter {
  id: string;
  transporter_name: string;
  code: string | null;
  email: string | null;
  mobile: string | null;
  company: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstin: string | null;
  pan: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function TransporterView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [transporter, setTransporter] = useState<Transporter | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (id) fetchTransporter();
  }, [id]);

  const fetchTransporter = async () => {
    try {
      const { data, error } = await supabase
        .from("transporters")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast({ title: "Error", description: "Transporter not found", variant: "destructive" });
        navigate("/transporters");
        return;
      }
      setTransporter(data);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async (newStatus: boolean) => {
    if (!transporter) return;
    try {
      const { error } = await supabase
        .from("transporters")
        .update({ is_active: newStatus })
        .eq("id", transporter.id);

      if (error) throw error;
      setTransporter({ ...transporter, is_active: newStatus });
      toast({ title: "Success", description: `Transporter ${newStatus ? "activated" : "deactivated"}` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!transporter) return;
    try {
      const { error } = await supabase
        .from("transporters")
        .delete()
        .eq("id", transporter.id);

      if (error) throw error;
      toast({ title: "Success", description: "Transporter deleted" });
      navigate("/transporters");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  if (!transporter) return null;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/transporters")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-3xl font-bold">{transporter.transporter_name}</h1>
                <Badge variant={transporter.is_active ? "default" : "secondary"}>
                  {transporter.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-muted-foreground">Transporter Details</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => navigate(`/transporters/${id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <DetailRow label="Transporter Name" value={transporter.transporter_name} />
              <DetailRow label="Code" value={transporter.code} />
              <DetailRow label="Company" value={transporter.company} />
              <DetailRow label="Email" value={transporter.email} />
              <DetailRow label="Mobile" value={transporter.mobile} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Address Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <DetailRow label="Address" value={transporter.address} className="md:col-span-2" />
              <DetailRow label="City" value={transporter.city} />
              <DetailRow label="State" value={transporter.state} />
              <DetailRow label="Pincode" value={transporter.pincode} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tax Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DetailRow label="GSTIN" value={transporter.gstin} />
              <DetailRow label="PAN" value={transporter.pan} />
            </CardContent>
          </Card>

          <StatusToggle
            isActive={transporter.is_active}
            onToggle={handleStatusToggle}
          />
        </div>

        <ConfirmDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title="Delete Transporter"
          description={`Are you sure you want to delete "${transporter.transporter_name}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          confirmText="Delete"
          variant="destructive"
        />
      </div>
    </Layout>
  );
}
