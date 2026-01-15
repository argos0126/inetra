import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { AlertTriangle, Calculator } from "lucide-react";
import { checkUniqueShipmentCode } from "@/utils/validationUtils";
import { getDisplayErrorMessage, logError } from "@/utils/errorHandler";

interface Customer { id: string; display_name: string; }
interface Location { id: string; location_name: string; }
interface Material { id: string; name: string; }

interface ValidationError {
  field: string;
  message: string;
}

const shipmentTypes = [
  { value: "single_single", label: "Single Pickup, Single Drop" },
  { value: "single_multi", label: "Single Pickup, Multi Drop" },
  { value: "multi_single", label: "Multi Pickup, Single Drop" },
  { value: "multi_multi", label: "Multi Pickup, Multi Drop" },
];

export default function ShipmentEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [duplicateChecking, setDuplicateChecking] = useState(false);
  const [originalCode, setOriginalCode] = useState("");
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  
  const [formData, setFormData] = useState({
    shipment_code: "",
    lr_number: "",
    waybill_number: "",
    order_id: "",
    consignee_code: "",
    shipment_type: "single_single",
    customer_id: "",
    pickup_location_id: "",
    drop_location_id: "",
    material_id: "",
    quantity: "",
    weight_kg: "",
    volume_cbm: "",
    length_cm: "",
    breadth_cm: "",
    height_cm: "",
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, [id]);

  // Auto-calculate volume when dimensions change
  useEffect(() => {
    const { length_cm, breadth_cm, height_cm } = formData;
    if (length_cm && breadth_cm && height_cm) {
      const l = parseFloat(length_cm);
      const b = parseFloat(breadth_cm);
      const h = parseFloat(height_cm);
      if (!isNaN(l) && !isNaN(b) && !isNaN(h) && l > 0 && b > 0 && h > 0) {
        // Convert cm³ to CBM (1 CBM = 1,000,000 cm³)
        const volumeCbm = (l * b * h) / 1000000;
        setFormData(prev => ({ ...prev, volume_cbm: volumeCbm.toFixed(4) }));
      }
    }
  }, [formData.length_cm, formData.breadth_cm, formData.height_cm]);

  // Validate on form change
  useEffect(() => {
    validateForm();
  }, [formData]);

  const fetchData = async () => {
    try {
      const [shipmentRes, customersRes, locationsRes, materialsRes] = await Promise.all([
        supabase.from("shipments").select("*").eq("id", id).maybeSingle(),
        supabase.from("customers").select("id, display_name").eq("is_active", true),
        supabase.from("locations").select("id, location_name").eq("is_active", true),
        supabase.from("materials").select("id, name").eq("is_active", true),
      ]);

      if (shipmentRes.error) throw shipmentRes.error;
      if (!shipmentRes.data) {
        toast({ title: "Not found", description: "Shipment not found", variant: "destructive" });
        navigate("/shipments");
        return;
      }

      const s = shipmentRes.data;
      setOriginalCode(s.shipment_code || "");
      setFormData({
        shipment_code: s.shipment_code || "",
        lr_number: s.lr_number || "",
        waybill_number: s.waybill_number || "",
        order_id: s.order_id || "",
        consignee_code: s.consignee_code || "",
        shipment_type: s.shipment_type || "single_single",
        customer_id: s.customer_id || "",
        pickup_location_id: s.pickup_location_id || "",
        drop_location_id: s.drop_location_id || "",
        material_id: s.material_id || "",
        quantity: s.quantity?.toString() || "",
        weight_kg: s.weight_kg?.toString() || "",
        volume_cbm: s.volume_cbm?.toString() || "",
        length_cm: s.length_cm?.toString() || "",
        breadth_cm: s.breadth_cm?.toString() || "",
        height_cm: s.height_cm?.toString() || "",
        notes: s.notes || "",
      });
      
      setCustomers(customersRes.data || []);
      setLocations(locationsRes.data || []);
      setMaterials(materialsRes.data || []);
    } catch (error: any) {
      toast({ title: "Error loading data", description: error.message, variant: "destructive" });
    } finally {
      setDataLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: ValidationError[] = [];

    // Required fields
    if (!formData.shipment_code.trim()) {
      errors.push({ field: "shipment_code", message: "Shipment code is required" });
    }

    if (!formData.customer_id) {
      errors.push({ field: "customer_id", message: "Customer is required" });
    }

    if (!formData.pickup_location_id) {
      errors.push({ field: "pickup_location_id", message: "Pickup location is required" });
    }

    if (!formData.drop_location_id) {
      errors.push({ field: "drop_location_id", message: "Drop location is required" });
    }

    // Same location check
    if (formData.pickup_location_id && formData.drop_location_id && 
        formData.pickup_location_id === formData.drop_location_id) {
      errors.push({ field: "drop_location_id", message: "Pickup and drop location cannot be the same" });
    }

    // Numeric validations
    if (formData.quantity) {
      const qty = parseInt(formData.quantity);
      if (isNaN(qty) || qty <= 0) {
        errors.push({ field: "quantity", message: "Quantity must be a positive number" });
      }
    }

    if (formData.weight_kg) {
      const weight = parseFloat(formData.weight_kg);
      if (isNaN(weight) || weight <= 0) {
        errors.push({ field: "weight_kg", message: "Weight must be a positive number" });
      }
    }

    if (formData.volume_cbm) {
      const volume = parseFloat(formData.volume_cbm);
      if (isNaN(volume) || volume <= 0) {
        errors.push({ field: "volume_cbm", message: "Volume must be a positive number" });
      }
    }

    // Dimension validations
    ["length_cm", "breadth_cm", "height_cm"].forEach(field => {
      const value = formData[field as keyof typeof formData];
      if (value) {
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) {
          errors.push({ field, message: `${field.replace("_cm", "")} must be a positive number` });
        }
      }
    });

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const checkDuplicateCode = async (): Promise<boolean> => {
    const code = formData.shipment_code.trim();
    if (!code || code === originalCode) return true; // No change, skip check
    
    setDuplicateChecking(true);
    try {
      const isUnique = await checkUniqueShipmentCode(code, id);
      if (!isUnique) {
        setValidationErrors(prev => [
          ...prev.filter(e => e.field !== "shipment_code_duplicate"),
          { field: "shipment_code_duplicate", message: "Shipment code already exists" }
        ]);
        return false;
      }
      return true;
    } catch (error) {
      return true; // Allow submission on error
    } finally {
      setDuplicateChecking(false);
    }
  };

  const getFieldError = (field: string): string | undefined => {
    return validationErrors.find(e => e.field === field || e.field === `${field}_duplicate`)?.message;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({ title: "Validation Error", description: "Please fix the errors before submitting", variant: "destructive" });
      return;
    }

    // Check for duplicate code if changed
    if (formData.shipment_code.trim() !== originalCode) {
      const isUnique = await checkDuplicateCode();
      if (!isUnique) {
        toast({ title: "Validation Error", description: "Shipment code already exists", variant: "destructive" });
        return;
      }
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("shipments").update({
        shipment_code: formData.shipment_code.trim(),
        lr_number: formData.lr_number || null,
        waybill_number: formData.waybill_number || null,
        order_id: formData.order_id || null,
        consignee_code: formData.consignee_code || null,
        shipment_type: formData.shipment_type,
        customer_id: formData.customer_id || null,
        pickup_location_id: formData.pickup_location_id || null,
        drop_location_id: formData.drop_location_id || null,
        material_id: formData.material_id || null,
        quantity: formData.quantity ? parseInt(formData.quantity) : null,
        weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : null,
        volume_cbm: formData.volume_cbm ? parseFloat(formData.volume_cbm) : null,
        length_cm: formData.length_cm ? parseFloat(formData.length_cm) : null,
        breadth_cm: formData.breadth_cm ? parseFloat(formData.breadth_cm) : null,
        height_cm: formData.height_cm ? parseFloat(formData.height_cm) : null,
        notes: formData.notes || null,
      }).eq("id", id);

      if (error) throw error;
      toast({ title: "Shipment updated", description: `${formData.shipment_code} has been updated.` });
      navigate(`/shipments/${id}`);
    } catch (error: any) {
      logError(error, "ShipmentEdit");
      toast({ title: "Error updating shipment", description: getDisplayErrorMessage(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Filter drop locations to exclude selected pickup
  const filteredDropLocations = locations.filter(l => l.id !== formData.pickup_location_id);

  if (dataLoading) return <Layout><div className="flex items-center justify-center h-64"><LoadingSpinner /></div></Layout>;

  const hasErrors = validationErrors.length > 0;

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader title="Edit Shipment" description={`Editing ${formData.shipment_code}`} />
        
        {hasErrors && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Please fix the following errors: {validationErrors.map(e => e.message).join(", ")}
            </AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Basic Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="shipment_code">Shipment Code *</Label>
                  <Input 
                    id="shipment_code" 
                    value={formData.shipment_code} 
                    onChange={(e) => setFormData({ ...formData, shipment_code: e.target.value })} 
                    className={getFieldError("shipment_code") ? "border-destructive" : ""}
                    required 
                  />
                  {getFieldError("shipment_code") && (
                    <p className="text-xs text-destructive">{getFieldError("shipment_code")}</p>
                  )}
                  {getFieldError("shipment_code_duplicate") && (
                    <p className="text-xs text-destructive">{getFieldError("shipment_code_duplicate")}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lr_number">LR Number</Label>
                  <Input id="lr_number" value={formData.lr_number} onChange={(e) => setFormData({ ...formData, lr_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="waybill_number">Waybill Number</Label>
                  <Input id="waybill_number" value={formData.waybill_number} onChange={(e) => setFormData({ ...formData, waybill_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order_id">Order ID</Label>
                  <Input id="order_id" value={formData.order_id} onChange={(e) => setFormData({ ...formData, order_id: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="consignee_code">Consignee Code</Label>
                  <Input id="consignee_code" value={formData.consignee_code} onChange={(e) => setFormData({ ...formData, consignee_code: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipment_type">Shipment Type</Label>
                  <Select value={formData.shipment_type} onValueChange={(v) => setFormData({ ...formData, shipment_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {shipmentTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Location & Customer</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customer_id">Customer *</Label>
                  <Select value={formData.customer_id} onValueChange={(v) => setFormData({ ...formData, customer_id: v })}>
                    <SelectTrigger className={getFieldError("customer_id") ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {getFieldError("customer_id") && (
                    <p className="text-xs text-destructive">{getFieldError("customer_id")}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pickup_location_id">Pickup Location *</Label>
                  <Select value={formData.pickup_location_id} onValueChange={(v) => setFormData({ ...formData, pickup_location_id: v })}>
                    <SelectTrigger className={getFieldError("pickup_location_id") ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select pickup location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.location_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {getFieldError("pickup_location_id") && (
                    <p className="text-xs text-destructive">{getFieldError("pickup_location_id")}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drop_location_id">Drop Location *</Label>
                  <Select value={formData.drop_location_id} onValueChange={(v) => setFormData({ ...formData, drop_location_id: v })}>
                    <SelectTrigger className={getFieldError("drop_location_id") ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select drop location" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredDropLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.location_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {getFieldError("drop_location_id") && (
                    <p className="text-xs text-destructive">{getFieldError("drop_location_id")}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="material_id">Material</Label>
                  <Select value={formData.material_id} onValueChange={(v) => setFormData({ ...formData, material_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select material" /></SelectTrigger>
                    <SelectContent>
                      {materials.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Weight & Dimensions</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input 
                      id="quantity" 
                      type="number" 
                      min="1"
                      value={formData.quantity} 
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} 
                      className={getFieldError("quantity") ? "border-destructive" : ""}
                    />
                    {getFieldError("quantity") && (
                      <p className="text-xs text-destructive">{getFieldError("quantity")}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight_kg">Weight (kg)</Label>
                    <Input 
                      id="weight_kg" 
                      type="number" 
                      step="0.01" 
                      min="0.01"
                      value={formData.weight_kg} 
                      onChange={(e) => setFormData({ ...formData, weight_kg: e.target.value })} 
                      className={getFieldError("weight_kg") ? "border-destructive" : ""}
                    />
                    {getFieldError("weight_kg") && (
                      <p className="text-xs text-destructive">{getFieldError("weight_kg")}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="volume_cbm" className="flex items-center gap-2">
                    Volume (CBM)
                    {formData.length_cm && formData.breadth_cm && formData.height_cm && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calculator className="h-3 w-3" /> Auto-calculated
                      </span>
                    )}
                  </Label>
                  <Input 
                    id="volume_cbm" 
                    type="number" 
                    step="0.0001" 
                    min="0.0001"
                    value={formData.volume_cbm} 
                    onChange={(e) => setFormData({ ...formData, volume_cbm: e.target.value })} 
                    className={getFieldError("volume_cbm") ? "border-destructive" : ""}
                  />
                  {getFieldError("volume_cbm") && (
                    <p className="text-xs text-destructive">{getFieldError("volume_cbm")}</p>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="length_cm">Length (cm)</Label>
                    <Input 
                      id="length_cm" 
                      type="number" 
                      step="0.1" 
                      min="0.1"
                      value={formData.length_cm} 
                      onChange={(e) => setFormData({ ...formData, length_cm: e.target.value })} 
                      className={getFieldError("length_cm") ? "border-destructive" : ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="breadth_cm">Breadth (cm)</Label>
                    <Input 
                      id="breadth_cm" 
                      type="number" 
                      step="0.1" 
                      min="0.1"
                      value={formData.breadth_cm} 
                      onChange={(e) => setFormData({ ...formData, breadth_cm: e.target.value })} 
                      className={getFieldError("breadth_cm") ? "border-destructive" : ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height_cm">Height (cm)</Label>
                    <Input 
                      id="height_cm" 
                      type="number" 
                      step="0.1" 
                      min="0.1"
                      value={formData.height_cm} 
                      onChange={(e) => setFormData({ ...formData, height_cm: e.target.value })} 
                      className={getFieldError("height_cm") ? "border-destructive" : ""}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
              <CardContent>
                <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={5} placeholder="Additional notes..." />
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end gap-4 mt-6">
            <Button type="button" variant="outline" onClick={() => navigate(`/shipments/${id}`)}>Cancel</Button>
            <Button type="submit" disabled={loading || duplicateChecking || hasErrors}>
              {loading ? "Saving..." : duplicateChecking ? "Checking..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
