import { Upload, MapPin, Package, FileSpreadsheet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DashboardHeader } from "./DashboardHeader";
import { QuickActionCard } from "./QuickActionCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function DataEntryDashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-4 sm:space-y-6">
      <DashboardHeader title="Data Entry" subtitle="Quick data entry and bulk imports" />
      <QuickActionCard actions={[
        { label: "Add Location", icon: MapPin, href: "/locations/add" },
        { label: "Add Material", icon: Package, href: "/materials/add" },
      ]} />
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />Quick Entry Forms</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" onClick={() => navigate('/locations/add')} className="h-20 flex-col gap-2"><MapPin className="h-6 w-6" />Add Location</Button>
            <Button variant="outline" onClick={() => navigate('/materials/add')} className="h-20 flex-col gap-2"><Package className="h-6 w-6" />Add Material</Button>
            <Button variant="outline" onClick={() => navigate('/drivers/add')} className="h-20 flex-col gap-2"><Upload className="h-6 w-6" />Add Driver</Button>
            <Button variant="outline" onClick={() => navigate('/vehicles/add')} className="h-20 flex-col gap-2"><Upload className="h-6 w-6" />Add Vehicle</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
