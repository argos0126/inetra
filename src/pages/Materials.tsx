import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { DataTable } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Material {
  id: string;
  name: string;
  sku_code: string | null;
  packaging: string | null;
  units: string | null;
  weight_kg: number | null;
  is_bulk: boolean;
  is_active: boolean;
  // Flattened fields for search
  bulk_text?: string;
  status_text?: string;
}

export default function Materials() {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState<Material | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    try {
      const { data, error } = await supabase.from("materials").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      // Flatten data for better search functionality
      const flattenedData = (data || []).map(material => ({
        ...material,
        bulk_text: material.is_bulk ? "Bulk" : "Packaged",
        status_text: material.is_active ? "Active" : "Inactive",
      }));
      setMaterials(flattenedData);
    } catch (error: any) {
      toast({ title: "Error fetching materials", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: "name", label: "Material Name" },
    { key: "sku_code", label: "SKU Code" },
    { key: "packaging", label: "Packaging" },
    { key: "units", label: "Units" },
    { key: "weight_kg", label: "Weight (kg)" },
    { key: "bulk_text", label: "Bulk", render: (_: string, row: Material) => (
      <Badge variant={row.is_bulk ? "secondary" : "outline"}>{row.is_bulk ? "Bulk" : "Packaged"}</Badge>
    ) },
    { key: "status_text", label: "Status", render: (_: string, row: Material) => (
      <Badge variant={row.is_active ? "default" : "destructive"}>{row.is_active ? "Active" : "Inactive"}</Badge>
    ) }
  ];

  const handleAdd = () => navigate("/materials/add");
  const handleEdit = (material: Material) => navigate(`/materials/${material.id}/edit`);
  const handleView = (material: Material) => navigate(`/materials/${material.id}`);

  const handleDeleteClick = (material: Material) => {
    setMaterialToDelete(material);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!materialToDelete) return;
    try {
      const { error } = await supabase.from("materials").delete().eq("id", materialToDelete.id);
      if (error) throw error;
      setMaterials(materials.filter(m => m.id !== materialToDelete.id));
      toast({ title: "Material deleted", description: `${materialToDelete.name} has been removed.` });
    } catch (error: any) {
      toast({ title: "Error deleting material", description: error.message, variant: "destructive" });
    }
    setMaterialToDelete(null);
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><LoadingSpinner /></div></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <DataTable
          title="Materials / SKU"
          description="Manage material and SKU definitions"
          columns={columns}
          data={materials}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
          onView={handleView}
          searchPlaceholder="Search materials..."
        />

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Material"
          description={`Are you sure you want to delete "${materialToDelete?.name}"? This action cannot be undone.`}
          confirmText="Delete"
          onConfirm={handleDeleteConfirm}
          variant="destructive"
        />
      </div>
    </Layout>
  );
}
