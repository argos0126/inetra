import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DetailRow } from "@/components/DetailRow";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ShipmentStatusWorkflow } from "@/components/shipment/ShipmentStatusWorkflow";
import { ShipmentStatusTimeline } from "@/components/shipment/ShipmentStatusTimeline";
import { ShipmentSubStatusSelector } from "@/components/shipment/ShipmentSubStatusSelector";
import ShipmentExceptionsPanel from "@/components/shipment/ShipmentExceptionsPanel";
import ShipmentAuditLogs from "@/components/shipment/ShipmentAuditLogs";
import { Database } from "@/integrations/supabase/types";
import { Edit, ArrowLeft, Workflow, AlertTriangle } from "lucide-react";
import { subStatusConfig } from "@/utils/shipmentValidations";

type ShipmentStatus = Database["public"]["Enums"]["shipment_status"];

const statusColors: Record<ShipmentStatus, string> = {
  created: "bg-gray-500 text-white",
  confirmed: "bg-blue-500 text-white",
  mapped: "bg-purple-500 text-white",
  in_pickup: "bg-orange-500 text-white",
  in_transit: "bg-indigo-500 text-white",
  out_for_delivery: "bg-cyan-500 text-white",
  delivered: "bg-green-500 text-white",
  ndr: "bg-red-500 text-white",
  returned: "bg-rose-500 text-white",
  success: "bg-emerald-600 text-white",
};

const statusLabels: Record<ShipmentStatus, string> = {
  created: "Created",
  confirmed: "Confirmed",
  mapped: "Mapped",
  in_pickup: "In Pickup",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  ndr: "NDR",
  returned: "Returned",
  success: "Success",
};

const shipmentTypeLabels: Record<string, string> = {
  single_single: "Single Pickup, Single Drop",
  single_multi: "Single Pickup, Multi Drop",
  multi_single: "Multi Pickup, Single Drop",
  multi_multi: "Multi Pickup, Multi Drop",
};

export default function ShipmentView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [shipment, setShipment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showWorkflow, setShowWorkflow] = useState(false);

  useEffect(() => {
    fetchShipment();
  }, [id]);

  const fetchShipment = async () => {
    try {
      const { data, error } = await supabase
        .from("shipments")
        .select(`
          *,
          customer:customers(display_name),
          pickup_location:locations!shipments_pickup_location_id_fkey(location_name, city, state),
          drop_location:locations!shipments_drop_location_id_fkey(location_name, city, state),
          material:materials(name),
          trip:trips(trip_code, id)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast({ title: "Not found", description: "Shipment not found", variant: "destructive" });
        navigate("/shipments");
        return;
      }
      setShipment(data);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (shipmentId: string, newStatus: ShipmentStatus) => {
    try {
      const { error } = await supabase.from("shipments").update({ status: newStatus }).eq("id", shipmentId);
      if (error) throw error;
      setShipment({ ...shipment, status: newStatus });
      setShowWorkflow(false);
      toast({ title: "Status updated", description: `Status changed to ${statusLabels[newStatus]}` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><LoadingSpinner /></div></Layout>;
  if (!shipment) return null;

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageHeader title={shipment.shipment_code} description="Shipment Details" />
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => navigate("/shipments")}>
              <ArrowLeft className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowWorkflow(true)}>
              <Workflow className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Status Workflow</span>
            </Button>
            <Button size="sm" onClick={() => navigate(`/shipments/${id}/edit`)}>
              <Edit className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span className="text-base sm:text-lg">Basic Details</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={statusColors[shipment.status as ShipmentStatus]}>{statusLabels[shipment.status as ShipmentStatus]}</Badge>
                  {shipment.is_delayed && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Delayed {shipment.delay_percentage ? `(${shipment.delay_percentage.toFixed(1)}%)` : ""}
                    </Badge>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailRow label="Shipment Code" value={shipment.shipment_code} />
              <DetailRow label="LR Number" value={shipment.lr_number || "-"} />
              <DetailRow label="Waybill Number" value={shipment.waybill_number || "-"} />
              <DetailRow label="Order ID" value={shipment.order_id || "-"} />
              <DetailRow label="Consignee Code" value={shipment.consignee_code || "-"} />
              <DetailRow label="Shipment Type" value={shipmentTypeLabels[shipment.shipment_type] || shipment.shipment_type} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Location & Customer</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <DetailRow label="Customer" value={shipment.customer?.display_name || "-"} />
              <DetailRow label="Pickup Location" value={shipment.pickup_location?.location_name || "-"} />
              <DetailRow label="Drop Location" value={shipment.drop_location?.location_name || "-"} />
              <DetailRow label="Material" value={shipment.material?.name || "-"} />
              {shipment.trip && (
                <div className="flex flex-col space-y-1">
                  <span className="text-sm text-muted-foreground">Mapped Trip</span>
                  <Button variant="link" className="p-0 h-auto justify-start" onClick={() => navigate(`/trips/${shipment.trip.id}`)}>
                    {shipment.trip.trip_code}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Weight & Dimensions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <DetailRow label="Quantity" value={shipment.quantity || "-"} />
              <DetailRow label="Weight (kg)" value={shipment.weight_kg?.toFixed(2) || "-"} />
              <DetailRow label="Volume (CBM)" value={shipment.volume_cbm?.toFixed(3) || "-"} />
              <DetailRow label="Dimensions (L×B×H cm)" value={
                shipment.length_cm || shipment.breadth_cm || shipment.height_cm
                  ? `${shipment.length_cm || 0} × ${shipment.breadth_cm || 0} × ${shipment.height_cm || 0}`
                  : "-"
              } />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{shipment.notes || "No notes available"}</p>
            </CardContent>
          </Card>
        </div>

        {/* Sub-Status Progress */}
        {subStatusConfig[shipment.status] && (
          <ShipmentSubStatusSelector
            shipmentId={shipment.id}
            status={shipment.status}
            currentSubStatus={shipment.sub_status || null}
            onUpdate={fetchShipment}
          />
        )}

        {/* Exceptions & Audit Section */}
        <div className="grid gap-6 md:grid-cols-2">
          <ShipmentExceptionsPanel shipmentId={shipment.id} onExceptionChange={fetchShipment} />
          <ShipmentAuditLogs shipmentId={shipment.id} />
        </div>

        {/* Status Timeline */}
        <ShipmentStatusTimeline shipmentId={shipment.id} />

        {showWorkflow && (
          <ShipmentStatusWorkflow
            shipment={shipment}
            onStatusChange={handleStatusChange}
            onClose={() => setShowWorkflow(false)}
          />
        )}
      </div>
    </Layout>
  );
}
