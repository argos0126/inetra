import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { DataTable } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ConsentStatusBadge } from "@/components/tracking/ConsentStatusBadge";
import { ConsentRequestButton } from "@/components/tracking/ConsentRequestButton";
import { useToast } from "@/hooks/use-toast";

interface DriverConsent {
  id: string;
  driver_id: string;
  msisdn: string;
  consent_status: "pending" | "allowed" | "not_allowed" | "expired";
  consent_requested_at: string | null;
  consent_received_at: string | null;
  entity_id: string | null;
  driver: {
    id: string;
    name: string;
    mobile: string;
  };
  trip?: {
    id: string;
    trip_code: string;
  };
}

export default function DriverConsents() {
  const [consents, setConsents] = useState<DriverConsent[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchConsents();

    const channel = supabase
      .channel('driver-consents-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_consents' }, () => fetchConsents())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchConsents = async () => {
    try {
      const { data, error } = await supabase
        .from("driver_consents")
        .select(`
          *,
          driver:drivers(id, name, mobile),
          trip:trips!driver_consents_trip_id_fkey(id, trip_code)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setConsents(data || []);
    } catch (error: any) {
      toast({ title: "Error fetching consents", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { 
      key: "driver", 
      label: "Driver", 
      render: (value: any) => (
        <div>
          <div className="font-medium">{value?.name}</div>
          <div className="text-sm text-muted-foreground">{value?.mobile}</div>
        </div>
      )
    },
    { key: "msisdn", label: "MSISDN" },
    { 
      key: "consent_status", 
      label: "Status", 
      render: (value: any) => <ConsentStatusBadge status={value} />
    },
    { 
      key: "trip", 
      label: "Trip", 
      render: (value: any) => value?.trip_code || "-"
    },
    { 
      key: "consent_requested_at", 
      label: "Requested", 
      render: (value: string) => value ? new Date(value).toLocaleString() : "-"
    },
    { 
      key: "consent_received_at", 
      label: "Received", 
      render: (value: string) => value ? new Date(value).toLocaleString() : "-"
    },
    {
      key: "actions",
      label: "Actions",
      render: (_: any, row: DriverConsent) => (
        <ConsentRequestButton
          driverId={row.driver?.id}
          driverName={row.driver?.name}
          driverMobile={row.msisdn}
          tripId={row.trip?.id}
          currentStatus={row.consent_status}
          entityId={row.entity_id || undefined}
          consentId={row.id}
          onConsentUpdated={fetchConsents}
        />
      )
    }
  ];

  const handleDelete = async (consent: DriverConsent) => {
    try {
      const { error } = await supabase.from("driver_consents").delete().eq("id", consent.id);
      if (error) throw error;
      setConsents(consents.filter(c => c.id !== consent.id));
      toast({ title: "Consent record deleted" });
    } catch (error: any) {
      toast({ title: "Error deleting consent", description: error.message, variant: "destructive" });
    }
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><LoadingSpinner /></div></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <DataTable
          title="Driver Consents"
          description="Manage SIM tracking consent requests for drivers"
          columns={columns}
          data={consents}
          onDelete={handleDelete}
          searchPlaceholder="Search by driver name or MSISDN..."
        />
      </div>
    </Layout>
  );
}
