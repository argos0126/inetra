import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { 
  Bell, Check, RefreshCw, MapPinOff, PauseCircle, Clock, 
  WifiOff, ShieldOff, MapPin, Gauge, AlertTriangle, 
  CheckCircle, XCircle, Filter, ExternalLink, ChevronLeft, ChevronRight, History, Navigation
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  TripAlertRecord, 
  TripAlertType, 
  AlertStatus,
  updateAlertStatus 
} from '@/utils/tripAlerts';
import ManualLocationUpdateDialog from '@/components/alert/ManualLocationUpdateDialog';

type AlertWithTrip = TripAlertRecord & {
  trips?: {
    trip_code: string;
    status: string;
    vehicle?: { vehicle_number: string } | null;
    driver?: { name: string } | null;
  };
};

const PAGE_SIZE = 20;

const alertTypeOptions: { value: TripAlertType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'route_deviation', label: 'Route Deviation' },
  { value: 'stoppage', label: 'Stoppage' },
  { value: 'tracking_lost', label: 'Tracking Lost' },
  { value: 'delay_warning', label: 'Delay Warning' },
  { value: 'idle_time', label: 'Idle Time' },
  { value: 'consent_revoked', label: 'Consent Revoked' },
  { value: 'geofence_entry', label: 'Geofence Entry' },
  { value: 'geofence_exit', label: 'Geofence Exit' },
  { value: 'speed_exceeded', label: 'Speed Exceeded' },
];

const severityOptions = [
  { value: 'all', label: 'All Severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const getAlertIcon = (type: TripAlertType) => {
  const iconMap: Record<TripAlertType, React.ReactNode> = {
    route_deviation: <MapPinOff className="h-4 w-4" />,
    stoppage: <PauseCircle className="h-4 w-4" />,
    idle_time: <Clock className="h-4 w-4" />,
    tracking_lost: <WifiOff className="h-4 w-4" />,
    consent_revoked: <ShieldOff className="h-4 w-4" />,
    geofence_entry: <MapPin className="h-4 w-4" />,
    geofence_exit: <MapPinOff className="h-4 w-4" />,
    speed_exceeded: <Gauge className="h-4 w-4" />,
    delay_warning: <AlertTriangle className="h-4 w-4" />,
  };
  return iconMap[type] || <AlertTriangle className="h-4 w-4" />;
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical': return 'bg-red-500 text-white';
    case 'high': return 'bg-orange-500 text-white';
    case 'medium': return 'bg-yellow-500 text-white';
    case 'low': return 'bg-blue-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
};

const getStatusBadge = (status: AlertStatus) => {
  const variants: Record<AlertStatus, { variant: 'destructive' | 'secondary' | 'default' | 'outline'; label: string }> = {
    active: { variant: 'destructive', label: 'Active' },
    acknowledged: { variant: 'secondary', label: 'Acknowledged' },
    resolved: { variant: 'default', label: 'Resolved' },
    dismissed: { variant: 'outline', label: 'Dismissed' },
  };
  const config = variants[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

export default function AlertDashboard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  
  // Filters
  const [typeFilter, setTypeFilter] = useState<TripAlertType | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  
  // Pagination
  const [activePage, setActivePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  
  // Selection
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
  
  // Bulk action dialog
  const [bulkDialog, setBulkDialog] = useState<{
    open: boolean;
    action: AlertStatus;
  }>({ open: false, action: 'acknowledged' });
  const [bulkNotes, setBulkNotes] = useState('');

  // Manual location update dialog
  const [manualUpdateDialog, setManualUpdateDialog] = useState<{
    open: boolean;
    tripId: string;
    tripCode: string;
    alertId: string;
  } | null>(null);

  // Fetch active/acknowledged alerts with pagination
  const { data: activeData, isLoading: activeLoading, refetch: refetchActive } = useQuery({
    queryKey: ['active-alerts', typeFilter, severityFilter, activePage],
    queryFn: async () => {
      const from = (activePage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      let query = supabase
        .from('trip_alerts')
        .select(`
          *,
          trips!inner (
            trip_code,
            status,
            vehicle:vehicles(vehicle_number),
            driver:drivers(name)
          )
        `, { count: 'exact' })
        .in('status', ['active', 'acknowledged'])
        .order('triggered_at', { ascending: false })
        .range(from, to);
      
      if (typeFilter !== 'all') {
        query = query.eq('alert_type', typeFilter);
      }
      if (severityFilter !== 'all') {
        query = query.eq('severity', severityFilter);
      }
      
      const { data, error, count } = await query;
      if (error) throw error;
      return { alerts: data as AlertWithTrip[], total: count || 0 };
    },
    refetchInterval: 30000,
  });

  // Fetch resolved/dismissed alerts (history) with pagination
  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['history-alerts', typeFilter, severityFilter, historyPage],
    queryFn: async () => {
      const from = (historyPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      let query = supabase
        .from('trip_alerts')
        .select(`
          *,
          trips!inner (
            trip_code,
            status,
            vehicle:vehicles(vehicle_number),
            driver:drivers(name)
          )
        `, { count: 'exact' })
        .in('status', ['resolved', 'dismissed'])
        .order('resolved_at', { ascending: false })
        .range(from, to);
      
      if (typeFilter !== 'all') {
        query = query.eq('alert_type', typeFilter);
      }
      if (severityFilter !== 'all') {
        query = query.eq('severity', severityFilter);
      }
      
      const { data, error, count } = await query;
      if (error) throw error;
      return { alerts: data as AlertWithTrip[], total: count || 0 };
    },
  });

  const activeAlerts = activeData?.alerts || [];
  const activeTotal = activeData?.total || 0;
  const activeTotalPages = Math.ceil(activeTotal / PAGE_SIZE);

  const historyAlerts = historyData?.alerts || [];
  const historyTotal = historyData?.total || 0;
  const historyTotalPages = Math.ceil(historyTotal / PAGE_SIZE);

  const updateMutation = useMutation({
    mutationFn: async ({ alertIds, status, notes }: { alertIds: string[]; status: AlertStatus; notes?: string }) => {
      const results = await Promise.all(
        alertIds.map(id => updateAlertStatus(id, status, { userId: user?.id, notes }))
      );
      const failed = results.filter(r => !r.success);
      if (failed.length > 0) throw new Error(`${failed.length} alerts failed to update`);
      return results;
    },
    onSuccess: (_, variables) => {
      toast.success(`${variables.alertIds.length} alert(s) updated successfully`);
      setSelectedAlerts(new Set());
      setBulkDialog({ open: false, action: 'acknowledged' as AlertStatus });
      setBulkNotes('');
      refetchActive();
      refetchHistory();
      queryClient.invalidateQueries({ queryKey: ['trip-alerts'] });
    },
    onError: (error) => {
      toast.error(`Failed to update alerts: ${error.message}`);
    },
  });

  // Stats
  const stats = useMemo(() => {
    const activeCount = activeAlerts.filter(a => a.status === 'active').length;
    const acknowledgedCount = activeAlerts.filter(a => a.status === 'acknowledged').length;
    const criticalCount = activeAlerts.filter(a => a.severity === 'critical').length;
    const highCount = activeAlerts.filter(a => a.severity === 'high').length;
    return { activeCount, acknowledgedCount, criticalCount, highCount, totalActive: activeTotal, totalHistory: historyTotal };
  }, [activeAlerts, activeTotal, historyTotal]);

  const currentAlerts = activeTab === 'active' ? activeAlerts : historyAlerts;

  const toggleSelectAll = () => {
    if (selectedAlerts.size === currentAlerts.length) {
      setSelectedAlerts(new Set());
    } else {
      setSelectedAlerts(new Set(currentAlerts.map(a => a.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedAlerts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedAlerts(newSelected);
  };

  const handleBulkAction = (action: AlertStatus) => {
    if (selectedAlerts.size === 0) {
      toast.error('Please select alerts first');
      return;
    }
    setBulkDialog({ open: true, action });
  };

  const confirmBulkAction = () => {
    updateMutation.mutate({
      alertIds: Array.from(selectedAlerts),
      status: bulkDialog.action,
      notes: bulkNotes || undefined,
    });
  };

  const getActionLabel = (action: AlertStatus) => {
    switch (action) {
      case 'acknowledged': return 'Acknowledge';
      case 'resolved': return 'Resolve';
      case 'dismissed': return 'Dismiss';
      default: return action;
    }
  };

  const handleRefresh = () => {
    refetchActive();
    refetchHistory();
  };

  const renderAlertItem = (alert: AlertWithTrip) => {
    const isActive = alert.status === 'active' || alert.status === 'acknowledged';
    const isTrackingLost = alert.alert_type === 'tracking_lost' && isActive;
    
    return (
      <div 
        key={alert.id}
        className={`border rounded-lg p-4 ${
          isActive 
            ? 'border-destructive/30 bg-destructive/5' 
            : 'border-border bg-muted/30'
        }`}
      >
        <div className="flex items-start gap-3">
          <Checkbox
            checked={selectedAlerts.has(alert.id)}
            onCheckedChange={() => toggleSelect(alert.id)}
          />
          <div className={`mt-0.5 ${isActive ? 'text-destructive' : 'text-muted-foreground'}`}>
            {getAlertIcon(alert.alert_type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-medium text-sm">{alert.title}</span>
              <Badge className={getSeverityColor(alert.severity)}>
                {alert.severity}
              </Badge>
              {getStatusBadge(alert.status)}
            </div>
            <p className="text-sm text-muted-foreground mb-2">{alert.description}</p>
            
            {/* Trip Info */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <Link 
                to={`/trips/${alert.trip_id}`}
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {alert.trips?.trip_code}
              </Link>
              {alert.trips?.vehicle?.vehicle_number && (
                <span>Vehicle: {alert.trips.vehicle.vehicle_number}</span>
              )}
              {alert.trips?.driver?.name && (
                <span>Driver: {alert.trips.driver.name}</span>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground mt-2">
              {formatDistanceToNow(new Date(alert.triggered_at), { addSuffix: true })}
              {' • '}
              {format(new Date(alert.triggered_at), 'MMM d, HH:mm')}
              {alert.resolved_at && (
                <>
                  {' • Resolved: '}
                  {format(new Date(alert.resolved_at), 'MMM d, HH:mm')}
                </>
              )}
            </p>

            {/* Manual Update Button for Tracking Lost alerts */}
            {isTrackingLost && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setManualUpdateDialog({
                      open: true,
                      tripId: alert.trip_id,
                      tripCode: alert.trips?.trip_code || '',
                      alertId: alert.id
                    });
                  }}
                  className="gap-2"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Manual Location Update
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderPagination = (currentPage: number, totalPages: number, setPage: (page: number) => void, total: number) => {
    if (totalPages <= 1) return null;
    
    return (
      <div className="flex items-center justify-between pt-4 border-t">
        <p className="text-sm text-muted-foreground">
          Showing {((currentPage - 1) * PAGE_SIZE) + 1} - {Math.min(currentPage * PAGE_SIZE, total)} of {total}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground px-2">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <PageHeader 
        title="Alert Dashboard" 
        description="Monitor and manage alerts across all trips"
      />

      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalActive}</p>
                  <p className="text-xs text-muted-foreground">Active/Acknowledged</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalHistory}</p>
                  <p className="text-xs text-muted-foreground">Resolved/Dismissed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Bell className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.criticalCount}</p>
                  <p className="text-xs text-muted-foreground">Critical</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Bell className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.highCount}</p>
                  <p className="text-xs text-muted-foreground">High Priority</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleRefresh}
                disabled={activeLoading || historyLoading}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Label className="text-xs">Alert Type</Label>
                <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v as TripAlertType | 'all'); setActivePage(1); setHistoryPage(1); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {alertTypeOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-xs">Severity</Label>
                <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setActivePage(1); setHistoryPage(1); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {severityOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedAlerts.size > 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-medium">
                  {selectedAlerts.size} alert(s) selected
                </span>
                <div className="flex flex-wrap gap-2">
                  {activeTab === 'active' && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleBulkAction('acknowledged')}
                        disabled={updateMutation.isPending}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Acknowledge
                      </Button>
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleBulkAction('resolved')}
                        disabled={updateMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Resolve
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleBulkAction('dismissed')}
                        disabled={updateMutation.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Dismiss
                      </Button>
                    </>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedAlerts(new Set())}
                  >
                    Clear Selection
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alerts Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as 'active' | 'history'); setSelectedAlerts(new Set()); }}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="active" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Active ({stats.totalActive})
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              History ({stats.totalHistory})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle>Active & Acknowledged Alerts</CardTitle>
                  {activeAlerts.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedAlerts.size === activeAlerts.length && activeAlerts.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                      <span className="text-sm text-muted-foreground">Select All</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {activeLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading alerts...</div>
                ) : activeAlerts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No active alerts</p>
                  </div>
                ) : (
                  <>
                    <ScrollArea className="max-h-[500px]">
                      <div className="space-y-3">
                        {activeAlerts.map(renderAlertItem)}
                      </div>
                    </ScrollArea>
                    {renderPagination(activePage, activeTotalPages, setActivePage, activeTotal)}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle>Resolved & Dismissed Alerts</CardTitle>
                  {historyAlerts.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedAlerts.size === historyAlerts.length && historyAlerts.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                      <span className="text-sm text-muted-foreground">Select All</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {historyLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading history...</div>
                ) : historyAlerts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No resolved alerts yet</p>
                  </div>
                ) : (
                  <>
                    <ScrollArea className="max-h-[500px]">
                      <div className="space-y-3">
                        {historyAlerts.map(renderAlertItem)}
                      </div>
                    </ScrollArea>
                    {renderPagination(historyPage, historyTotalPages, setHistoryPage, historyTotal)}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Bulk Action Dialog */}
      <Dialog open={bulkDialog.open} onOpenChange={(open) => !open && setBulkDialog({ open: false, action: 'acknowledged' as AlertStatus })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {getActionLabel(bulkDialog.action)} {selectedAlerts.size} Alert(s)
            </DialogTitle>
            <DialogDescription>
              This action will be applied to all selected alerts.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-notes">Notes (optional)</Label>
              <Textarea
                id="bulk-notes"
                placeholder={`Add notes for this bulk ${getActionLabel(bulkDialog.action).toLowerCase()} action...`}
                value={bulkNotes}
                onChange={(e) => setBulkNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog({ open: false, action: 'acknowledged' })}>
              Cancel
            </Button>
            <Button 
              onClick={confirmBulkAction}
              disabled={updateMutation.isPending}
              className={bulkDialog.action === 'resolved' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              {updateMutation.isPending ? 'Processing...' : `Confirm ${getActionLabel(bulkDialog.action)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Location Update Dialog */}
      {manualUpdateDialog && (
        <ManualLocationUpdateDialog
          open={manualUpdateDialog.open}
          onOpenChange={(open) => !open && setManualUpdateDialog(null)}
          tripId={manualUpdateDialog.tripId}
          tripCode={manualUpdateDialog.tripCode}
          alertId={manualUpdateDialog.alertId}
          onSuccess={() => {
            refetchActive();
            refetchHistory();
            queryClient.invalidateQueries({ queryKey: ['trip-alerts'] });
          }}
        />
      )}
    </Layout>
  );
}