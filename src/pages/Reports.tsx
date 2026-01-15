import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Layout } from "@/components/Layout";
import { 
  FileText, 
  Download, 
  Filter, 
  CalendarDays,
  BarChart3,
  PieChart,
  TrendingUp,
  Truck,
  Users,
  MapPin,
  FileSpreadsheet,
  Loader2
} from "lucide-react";
import { format, subDays } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel, exportToPDF, exportToCSV } from "@/utils/exportUtils";
import { toast } from "@/hooks/use-toast";

type ExportFormat = 'pdf' | 'excel' | 'csv';

const Reports = () => {
  const [selectedReport, setSelectedReport] = useState("trip-summary");
  const [dateFrom, setDateFrom] = useState<Date>(subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [exportFormat, setExportFormat] = useState<ExportFormat>("excel");
  const [selectedDriver, setSelectedDriver] = useState<string>("all");
  const [selectedVehicle, setSelectedVehicle] = useState<string>("all");
  const [isGenerating, setIsGenerating] = useState(false);

  const reportTypes = [
    { value: "trip-summary", label: "Trip Summary Report", icon: Truck },
    { value: "driver-performance", label: "Driver Performance Report", icon: Users },
    { value: "shipment-report", label: "Shipment Report", icon: MapPin },
    { value: "vehicle-utilization", label: "Vehicle Utilization Report", icon: BarChart3 },
    { value: "customer-report", label: "Customer Report", icon: TrendingUp },
    { value: "transporter-report", label: "Transporter Report", icon: PieChart },
  ];

  // Fetch drivers for filter
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers-list'],
    queryFn: async () => {
      const { data } = await supabase.from('drivers').select('id, name').eq('is_active', true);
      return data || [];
    }
  });

  // Fetch vehicles for filter
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles-list'],
    queryFn: async () => {
      const { data } = await supabase.from('vehicles').select('id, vehicle_number').eq('is_active', true);
      return data || [];
    }
  });

  // Fetch report data based on selected report type
  const fetchReportData = async () => {
    const fromDate = dateFrom ? format(dateFrom, 'yyyy-MM-dd') : null;
    const toDate = dateTo ? format(dateTo, 'yyyy-MM-dd') : null;

    switch (selectedReport) {
      case 'trip-summary': {
        let query = supabase
          .from('trips')
          .select(`
            id, trip_code, status, created_at, actual_start_time, actual_end_time,
            total_distance_km, tracking_type, notes,
            driver:drivers(name, mobile),
            vehicle:vehicles(vehicle_number),
            origin:locations!trips_origin_location_id_fkey(location_name, city),
            destination:locations!trips_destination_location_id_fkey(location_name, city),
            transporter:transporters(transporter_name)
          `);
        
        if (fromDate) query = query.gte('created_at', fromDate);
        if (toDate) query = query.lte('created_at', toDate + 'T23:59:59');
        if (selectedDriver !== 'all') query = query.eq('driver_id', selectedDriver);
        if (selectedVehicle !== 'all') query = query.eq('vehicle_id', selectedVehicle);
        
        const { data } = await query.order('created_at', { ascending: false });
        return {
          data: (data || []).map(trip => ({
            trip_code: trip.trip_code,
            status: trip.status,
            driver_name: trip.driver?.name || '-',
            driver_mobile: trip.driver?.mobile || '-',
            vehicle_number: trip.vehicle?.vehicle_number || '-',
            origin: trip.origin ? `${trip.origin.location_name}, ${trip.origin.city}` : '-',
            destination: trip.destination ? `${trip.destination.location_name}, ${trip.destination.city}` : '-',
            transporter: trip.transporter?.transporter_name || '-',
            tracking_type: trip.tracking_type || '-',
            distance_km: trip.total_distance_km || '-',
            created_at: format(new Date(trip.created_at), 'yyyy-MM-dd HH:mm'),
            start_time: trip.actual_start_time ? format(new Date(trip.actual_start_time), 'yyyy-MM-dd HH:mm') : '-',
            end_time: trip.actual_end_time ? format(new Date(trip.actual_end_time), 'yyyy-MM-dd HH:mm') : '-',
          })),
          columns: [
            { key: 'trip_code', label: 'Trip Code' },
            { key: 'status', label: 'Status' },
            { key: 'driver_name', label: 'Driver' },
            { key: 'driver_mobile', label: 'Driver Mobile' },
            { key: 'vehicle_number', label: 'Vehicle' },
            { key: 'origin', label: 'Origin' },
            { key: 'destination', label: 'Destination' },
            { key: 'transporter', label: 'Transporter' },
            { key: 'tracking_type', label: 'Tracking Type' },
            { key: 'distance_km', label: 'Distance (KM)' },
            { key: 'created_at', label: 'Created At' },
            { key: 'start_time', label: 'Start Time' },
            { key: 'end_time', label: 'End Time' },
          ]
        };
      }

      case 'driver-performance': {
        let query = supabase
          .from('drivers')
          .select(`
            id, name, mobile, email, is_active, consent_status, license_number,
            transporter:transporters(transporter_name)
          `);
        
        const { data: driversData } = await query.order('name');
        
        // Get trip counts for each driver
        const driverIds = (driversData || []).map(d => d.id);
        const { data: tripCounts } = await supabase
          .from('trips')
          .select('driver_id, status')
          .in('driver_id', driverIds);
        
        const tripCountMap: Record<string, { total: number; completed: number }> = {};
        (tripCounts || []).forEach(trip => {
          if (!tripCountMap[trip.driver_id]) {
            tripCountMap[trip.driver_id] = { total: 0, completed: 0 };
          }
          tripCountMap[trip.driver_id].total++;
          if (trip.status === 'completed' || trip.status === 'closed') {
            tripCountMap[trip.driver_id].completed++;
          }
        });

        return {
          data: (driversData || []).map(driver => ({
            name: driver.name,
            mobile: driver.mobile,
            email: driver.email || '-',
            license_number: driver.license_number || '-',
            transporter: driver.transporter?.transporter_name || '-',
            consent_status: driver.consent_status,
            status: driver.is_active ? 'Active' : 'Inactive',
            total_trips: tripCountMap[driver.id]?.total || 0,
            completed_trips: tripCountMap[driver.id]?.completed || 0,
          })),
          columns: [
            { key: 'name', label: 'Driver Name' },
            { key: 'mobile', label: 'Mobile' },
            { key: 'email', label: 'Email' },
            { key: 'license_number', label: 'License Number' },
            { key: 'transporter', label: 'Transporter' },
            { key: 'consent_status', label: 'Consent Status' },
            { key: 'status', label: 'Status' },
            { key: 'total_trips', label: 'Total Trips' },
            { key: 'completed_trips', label: 'Completed Trips' },
          ]
        };
      }

      case 'shipment-report': {
        let query = supabase
          .from('shipments')
          .select(`
            id, shipment_code, status, sub_status, lr_number, waybill_number,
            weight_kg, volume_cbm, quantity, pod_collected, created_at, delivered_at,
            customer:customers(display_name),
            pickup:locations!shipments_pickup_location_id_fkey(location_name, city),
            drop:locations!shipments_drop_location_id_fkey(location_name, city),
            material:materials(name)
          `);
        
        if (fromDate) query = query.gte('created_at', fromDate);
        if (toDate) query = query.lte('created_at', toDate + 'T23:59:59');
        
        const { data } = await query.order('created_at', { ascending: false });
        return {
          data: (data || []).map(shipment => ({
            shipment_code: shipment.shipment_code,
            status: shipment.status,
            sub_status: shipment.sub_status || '-',
            lr_number: shipment.lr_number || '-',
            waybill_number: shipment.waybill_number || '-',
            customer: shipment.customer?.display_name || '-',
            pickup: shipment.pickup ? `${shipment.pickup.location_name}, ${shipment.pickup.city}` : '-',
            drop: shipment.drop ? `${shipment.drop.location_name}, ${shipment.drop.city}` : '-',
            material: shipment.material?.name || '-',
            weight_kg: shipment.weight_kg || '-',
            volume_cbm: shipment.volume_cbm || '-',
            quantity: shipment.quantity || '-',
            pod_collected: shipment.pod_collected ? 'Yes' : 'No',
            created_at: format(new Date(shipment.created_at), 'yyyy-MM-dd HH:mm'),
            delivered_at: shipment.delivered_at ? format(new Date(shipment.delivered_at), 'yyyy-MM-dd HH:mm') : '-',
          })),
          columns: [
            { key: 'shipment_code', label: 'Shipment Code' },
            { key: 'status', label: 'Status' },
            { key: 'sub_status', label: 'Sub Status' },
            { key: 'lr_number', label: 'LR Number' },
            { key: 'waybill_number', label: 'Waybill Number' },
            { key: 'customer', label: 'Customer' },
            { key: 'pickup', label: 'Pickup Location' },
            { key: 'drop', label: 'Drop Location' },
            { key: 'material', label: 'Material' },
            { key: 'weight_kg', label: 'Weight (KG)' },
            { key: 'volume_cbm', label: 'Volume (CBM)' },
            { key: 'quantity', label: 'Quantity' },
            { key: 'pod_collected', label: 'POD Collected' },
            { key: 'created_at', label: 'Created At' },
            { key: 'delivered_at', label: 'Delivered At' },
          ]
        };
      }

      case 'vehicle-utilization': {
        const { data: vehiclesData } = await supabase
          .from('vehicles')
          .select(`
            id, vehicle_number, make, model, year, is_active, is_dedicated,
            vehicle_type:vehicle_types(type_name),
            transporter:transporters(transporter_name),
            tracking_asset:tracking_assets(display_name, asset_type)
          `)
          .order('vehicle_number');

        // Get trip counts for each vehicle
        const vehicleIds = (vehiclesData || []).map(v => v.id);
        const { data: tripCounts } = await supabase
          .from('trips')
          .select('vehicle_id, status')
          .in('vehicle_id', vehicleIds);

        const tripCountMap: Record<string, { total: number; ongoing: number }> = {};
        (tripCounts || []).forEach(trip => {
          if (!tripCountMap[trip.vehicle_id]) {
            tripCountMap[trip.vehicle_id] = { total: 0, ongoing: 0 };
          }
          tripCountMap[trip.vehicle_id].total++;
          if (trip.status === 'ongoing') {
            tripCountMap[trip.vehicle_id].ongoing++;
          }
        });

        return {
          data: (vehiclesData || []).map(vehicle => ({
            vehicle_number: vehicle.vehicle_number,
            make: vehicle.make || '-',
            model: vehicle.model || '-',
            year: vehicle.year || '-',
            vehicle_type: vehicle.vehicle_type?.type_name || '-',
            transporter: vehicle.transporter?.transporter_name || '-',
            tracking_asset: vehicle.tracking_asset?.display_name || '-',
            asset_type: vehicle.tracking_asset?.asset_type || '-',
            is_dedicated: vehicle.is_dedicated ? 'Yes' : 'No',
            status: vehicle.is_active ? 'Active' : 'Inactive',
            total_trips: tripCountMap[vehicle.id]?.total || 0,
            ongoing_trips: tripCountMap[vehicle.id]?.ongoing || 0,
          })),
          columns: [
            { key: 'vehicle_number', label: 'Vehicle Number' },
            { key: 'make', label: 'Make' },
            { key: 'model', label: 'Model' },
            { key: 'year', label: 'Year' },
            { key: 'vehicle_type', label: 'Vehicle Type' },
            { key: 'transporter', label: 'Transporter' },
            { key: 'tracking_asset', label: 'Tracking Asset' },
            { key: 'asset_type', label: 'Asset Type' },
            { key: 'is_dedicated', label: 'Dedicated' },
            { key: 'status', label: 'Status' },
            { key: 'total_trips', label: 'Total Trips' },
            { key: 'ongoing_trips', label: 'Ongoing Trips' },
          ]
        };
      }

      case 'customer-report': {
        const { data: customersData } = await supabase
          .from('customers')
          .select('*')
          .order('display_name');

        // Get shipment counts
        const customerIds = (customersData || []).map(c => c.id);
        const { data: shipmentCounts } = await supabase
          .from('shipments')
          .select('customer_id, status')
          .in('customer_id', customerIds);

        const shipmentCountMap: Record<string, { total: number; delivered: number }> = {};
        (shipmentCounts || []).forEach(shipment => {
          if (!shipmentCountMap[shipment.customer_id]) {
            shipmentCountMap[shipment.customer_id] = { total: 0, delivered: 0 };
          }
          shipmentCountMap[shipment.customer_id].total++;
          if (shipment.status === 'delivered' || shipment.status === 'success') {
            shipmentCountMap[shipment.customer_id].delivered++;
          }
        });

        return {
          data: (customersData || []).map(customer => ({
            display_name: customer.display_name,
            company_name: customer.company_name || '-',
            email: customer.email || '-',
            phone: customer.phone || '-',
            city: customer.city || '-',
            state: customer.state || '-',
            gst_number: customer.gst_number || '-',
            pan_number: customer.pan_number || '-',
            status: customer.is_active ? 'Active' : 'Inactive',
            total_shipments: shipmentCountMap[customer.id]?.total || 0,
            delivered_shipments: shipmentCountMap[customer.id]?.delivered || 0,
          })),
          columns: [
            { key: 'display_name', label: 'Display Name' },
            { key: 'company_name', label: 'Company' },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone' },
            { key: 'city', label: 'City' },
            { key: 'state', label: 'State' },
            { key: 'gst_number', label: 'GST Number' },
            { key: 'pan_number', label: 'PAN Number' },
            { key: 'status', label: 'Status' },
            { key: 'total_shipments', label: 'Total Shipments' },
            { key: 'delivered_shipments', label: 'Delivered' },
          ]
        };
      }

      case 'transporter-report': {
        const { data: transportersData } = await supabase
          .from('transporters')
          .select('*')
          .order('transporter_name');

        // Get vehicle and driver counts
        const transporterIds = (transportersData || []).map(t => t.id);
        
        const [{ data: vehicleCounts }, { data: driverCounts }, { data: tripCounts }] = await Promise.all([
          supabase.from('vehicles').select('transporter_id').in('transporter_id', transporterIds),
          supabase.from('drivers').select('transporter_id').in('transporter_id', transporterIds),
          supabase.from('trips').select('transporter_id, status').in('transporter_id', transporterIds),
        ]);

        const statsMap: Record<string, { vehicles: number; drivers: number; trips: number; completed: number }> = {};
        transporterIds.forEach(id => {
          statsMap[id] = { vehicles: 0, drivers: 0, trips: 0, completed: 0 };
        });

        (vehicleCounts || []).forEach(v => {
          if (v.transporter_id) statsMap[v.transporter_id].vehicles++;
        });
        (driverCounts || []).forEach(d => {
          if (d.transporter_id) statsMap[d.transporter_id].drivers++;
        });
        (tripCounts || []).forEach(t => {
          if (t.transporter_id) {
            statsMap[t.transporter_id].trips++;
            if (t.status === 'completed' || t.status === 'closed') {
              statsMap[t.transporter_id].completed++;
            }
          }
        });

        return {
          data: (transportersData || []).map(transporter => ({
            transporter_name: transporter.transporter_name,
            code: transporter.code || '-',
            company: transporter.company || '-',
            email: transporter.email || '-',
            mobile: transporter.mobile || '-',
            city: transporter.city || '-',
            state: transporter.state || '-',
            gstin: transporter.gstin || '-',
            pan: transporter.pan || '-',
            status: transporter.is_active ? 'Active' : 'Inactive',
            vehicles: statsMap[transporter.id]?.vehicles || 0,
            drivers: statsMap[transporter.id]?.drivers || 0,
            total_trips: statsMap[transporter.id]?.trips || 0,
            completed_trips: statsMap[transporter.id]?.completed || 0,
          })),
          columns: [
            { key: 'transporter_name', label: 'Transporter Name' },
            { key: 'code', label: 'Code' },
            { key: 'company', label: 'Company' },
            { key: 'email', label: 'Email' },
            { key: 'mobile', label: 'Mobile' },
            { key: 'city', label: 'City' },
            { key: 'state', label: 'State' },
            { key: 'gstin', label: 'GSTIN' },
            { key: 'pan', label: 'PAN' },
            { key: 'status', label: 'Status' },
            { key: 'vehicles', label: 'Vehicles' },
            { key: 'drivers', label: 'Drivers' },
            { key: 'total_trips', label: 'Total Trips' },
            { key: 'completed_trips', label: 'Completed Trips' },
          ]
        };
      }

      default:
        return { data: [], columns: [] };
    }
  };

  const handleGenerateReport = async () => {
    if (!dateFrom || !dateTo) {
      toast({
        title: "Date Range Required",
        description: "Please select both from and to dates.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, columns } = await fetchReportData();
      
      if (data.length === 0) {
        toast({
          title: "No Data",
          description: "No data found for the selected criteria.",
          variant: "destructive"
        });
        return;
      }

      const reportTitle = reportTypes.find(r => r.value === selectedReport)?.label || 'Report';
      const filename = `${selectedReport}_${format(dateFrom, 'yyyyMMdd')}_${format(dateTo, 'yyyyMMdd')}`;
      const options = { filename, title: reportTitle, columns, data };

      switch (exportFormat) {
        case 'excel':
          exportToExcel(options);
          break;
        case 'pdf':
          exportToPDF(options);
          break;
        case 'csv':
          exportToCSV(options);
          break;
      }

      toast({
        title: "Report Generated",
        description: `${reportTitle} has been downloaded as ${exportFormat.toUpperCase()}.`
      });
    } catch (error) {
      console.error('Report generation error:', error);
      toast({
        title: "Generation Failed",
        description: "An error occurred while generating the report.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleQuickGenerate = async (reportType: string) => {
    setSelectedReport(reportType);
    setDateFrom(subDays(new Date(), 30));
    setDateTo(new Date());
    setExportFormat('excel');
    
    // Small delay to ensure state is updated
    setTimeout(() => {
      handleGenerateReport();
    }, 100);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Reports</h1>
            <p className="text-muted-foreground">Generate and download various reports</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Report Generation */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Generate New Report</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Report Type Selection */}
              <div className="space-y-2">
                <Label>Report Type</Label>
                <Select value={selectedReport} onValueChange={setSelectedReport}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    {reportTypes.map((report) => (
                      <SelectItem key={report.value} value={report.value}>
                        <div className="flex items-center space-x-2">
                          <report.icon className="h-4 w-4" />
                          <span>{report.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={(date) => date && setDateFrom(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>To Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={(date) => date && setDateTo(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Additional Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Driver</Label>
                  <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                    <SelectTrigger>
                      <SelectValue placeholder="All drivers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Drivers</SelectItem>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Vehicle</Label>
                  <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                    <SelectTrigger>
                      <SelectValue placeholder="All vehicles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Vehicles</SelectItem>
                      {vehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.vehicle_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Format Selection */}
              <div className="space-y-2">
                <Label>Export Format</Label>
                <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excel">
                      <div className="flex items-center">
                        <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
                        Excel (.xlsx)
                      </div>
                    </SelectItem>
                    <SelectItem value="pdf">
                      <div className="flex items-center">
                        <FileText className="h-4 w-4 mr-2 text-red-600" />
                        PDF
                      </div>
                    </SelectItem>
                    <SelectItem value="csv">
                      <div className="flex items-center">
                        <Download className="h-4 w-4 mr-2 text-blue-600" />
                        CSV
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Generate Button */}
              <Button onClick={handleGenerateReport} className="w-full" disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Report
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Filter className="h-5 w-5" />
                <span>Report Summary</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-muted/50">
                  <h4 className="font-medium text-sm mb-2">Available Reports</h4>
                  <div className="space-y-2">
                    {reportTypes.map((report) => (
                      <div key={report.value} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{report.label}</span>
                        <Badge variant="outline" className="text-xs">Ready</Badge>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-sm mb-2">Export Formats</h4>
                  <div className="flex gap-2">
                    <Badge className="bg-green-100 text-green-800">Excel</Badge>
                    <Badge className="bg-red-100 text-red-800">PDF</Badge>
                    <Badge className="bg-blue-100 text-blue-800">CSV</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Report Templates */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Report Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reportTypes.map((report) => (
                <Card key={report.value} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4 text-center">
                    <report.icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <h3 className="font-medium mb-1">{report.label}</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Generate detailed {report.label.toLowerCase()}
                    </p>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="w-full"
                      onClick={() => {
                        setSelectedReport(report.value);
                        setDateFrom(subDays(new Date(), 30));
                        setDateTo(new Date());
                      }}
                    >
                      Select Template
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Reports;
