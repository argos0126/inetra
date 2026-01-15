import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertTriangle, 
  AlertCircle, 
  Wrench, 
  ExternalLink,
  RefreshCw,
  Filter,
  X,
  CheckCircle2,
  Clock,
  Search
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow, isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns";

interface ExceptionTrip {
  id: string;
  trip_code: string;
  status: string;
  updated_at: string;
  created_at: string;
  vehicle?: { vehicle_number: string } | null;
  driver?: { name: string } | null;
  origin_location?: { location_name: string } | null;
  destination_location?: { location_name: string } | null;
  hold_reason?: string;
  hold_at?: string;
  resolved_at?: string | null;
  is_resolved?: boolean;
}

type ExceptionType = "all" | "accident" | "breakdown" | "other";
type ResolutionStatus = "all" | "unresolved" | "resolved";

export default function TripExceptions() {
  const navigate = useNavigate();
  
  // Filters
  const [exceptionType, setExceptionType] = useState<ExceptionType>("all");
  const [resolutionStatus, setResolutionStatus] = useState<ResolutionStatus>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all trips that have been on_hold or have exception audit logs
  const { data: exceptionTrips, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['trip-exceptions'],
    queryFn: async () => {
      // Get all audit logs where trips were put on hold
      const { data: auditLogs, error: auditError } = await supabase
        .from('trip_audit_logs')
        .select(`
          id,
          trip_id,
          previous_status,
          new_status,
          change_reason,
          metadata,
          created_at
        `)
        .eq('new_status', 'on_hold')
        .order('created_at', { ascending: false });

      if (auditError) throw auditError;
      if (!auditLogs || auditLogs.length === 0) return [];

      // Get unique trip IDs
      const tripIds = [...new Set(auditLogs.map(log => log.trip_id))];

      // Fetch trip details
      const { data: trips, error: tripsError } = await supabase
        .from('trips')
        .select(`
          id,
          trip_code,
          status,
          updated_at,
          created_at,
          vehicle:vehicles(vehicle_number),
          driver:drivers(name),
          origin_location:locations!trips_origin_location_id_fkey(location_name),
          destination_location:locations!trips_destination_location_id_fkey(location_name)
        `)
        .in('id', tripIds);

      if (tripsError) throw tripsError;

      // Check for resolution (when trip status changed from on_hold to something else)
      const { data: resolutionLogs } = await supabase
        .from('trip_audit_logs')
        .select('trip_id, created_at, new_status')
        .eq('previous_status', 'on_hold')
        .in('trip_id', tripIds)
        .order('created_at', { ascending: false });

      // Build resolution map
      const resolutionMap: Record<string, { resolved_at: string; new_status: string }> = {};
      resolutionLogs?.forEach(log => {
        if (!resolutionMap[log.trip_id]) {
          resolutionMap[log.trip_id] = {
            resolved_at: log.created_at,
            new_status: log.new_status
          };
        }
      });

      // Build hold reason map (get the most recent hold for each trip)
      const holdReasonMap: Record<string, { reason: string; hold_at: string }> = {};
      auditLogs.forEach(log => {
        if (!holdReasonMap[log.trip_id]) {
          const metadata = log.metadata as { hold_reason?: string } | null;
          holdReasonMap[log.trip_id] = {
            reason: metadata?.hold_reason || 'unknown',
            hold_at: log.created_at
          };
        }
      });

      // Combine data
      return trips?.map(trip => {
        const holdInfo = holdReasonMap[trip.id];
        const resolution = resolutionMap[trip.id];
        const isCurrentlyOnHold = trip.status === 'on_hold';
        
        return {
          ...trip,
          hold_reason: holdInfo?.reason || 'unknown',
          hold_at: holdInfo?.hold_at,
          resolved_at: !isCurrentlyOnHold ? resolution?.resolved_at : null,
          is_resolved: !isCurrentlyOnHold
        } as ExceptionTrip;
      }) || [];
    },
    refetchInterval: 60000
  });

  // Filter data
  const filteredTrips = useMemo(() => {
    if (!exceptionTrips) return [];

    return exceptionTrips.filter(trip => {
      // Exception type filter
      if (exceptionType !== "all") {
        if (exceptionType === "other" && (trip.hold_reason === "accident" || trip.hold_reason === "breakdown")) {
          return false;
        }
        if (exceptionType !== "other" && trip.hold_reason !== exceptionType) {
          return false;
        }
      }

      // Resolution status filter
      if (resolutionStatus === "resolved" && !trip.is_resolved) return false;
      if (resolutionStatus === "unresolved" && trip.is_resolved) return false;

      // Date range filter
      if (startDate && trip.hold_at) {
        const holdDate = parseISO(trip.hold_at);
        const filterStart = startOfDay(parseISO(startDate));
        if (holdDate < filterStart) return false;
      }
      if (endDate && trip.hold_at) {
        const holdDate = parseISO(trip.hold_at);
        const filterEnd = endOfDay(parseISO(endDate));
        if (holdDate > filterEnd) return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTripCode = trip.trip_code.toLowerCase().includes(query);
        const matchesDriver = trip.driver?.name?.toLowerCase().includes(query);
        const matchesVehicle = trip.vehicle?.vehicle_number?.toLowerCase().includes(query);
        const matchesOrigin = trip.origin_location?.location_name?.toLowerCase().includes(query);
        const matchesDest = trip.destination_location?.location_name?.toLowerCase().includes(query);
        
        if (!matchesTripCode && !matchesDriver && !matchesVehicle && !matchesOrigin && !matchesDest) {
          return false;
        }
      }

      return true;
    });
  }, [exceptionTrips, exceptionType, resolutionStatus, startDate, endDate, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    if (!exceptionTrips) return { total: 0, unresolved: 0, accidents: 0, breakdowns: 0 };
    
    return {
      total: exceptionTrips.length,
      unresolved: exceptionTrips.filter(t => !t.is_resolved).length,
      accidents: exceptionTrips.filter(t => t.hold_reason === 'accident').length,
      breakdowns: exceptionTrips.filter(t => t.hold_reason === 'breakdown').length
    };
  }, [exceptionTrips]);

  const getExceptionIcon = (reason: string) => {
    switch (reason) {
      case 'accident':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'breakdown':
        return <Wrench className="h-5 w-5 text-orange-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getExceptionBadge = (reason: string) => {
    switch (reason) {
      case 'accident':
        return <Badge variant="destructive">Accident</Badge>;
      case 'breakdown':
        return <Badge className="bg-orange-500 hover:bg-orange-600">Breakdown</Badge>;
      default:
        return <Badge variant="secondary">On Hold</Badge>;
    }
  };

  const clearFilters = () => {
    setExceptionType("all");
    setResolutionStatus("all");
    setStartDate("");
    setEndDate("");
    setSearchQuery("");
  };

  const hasActiveFilters = exceptionType !== "all" || resolutionStatus !== "all" || startDate || endDate || searchQuery;

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="Trip Exceptions"
          description="View and manage all trip exceptions including accidents, breakdowns, and holds"
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Exceptions</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Unresolved</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.unresolved}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Accidents</p>
                  <p className="text-2xl font-bold text-destructive">{stats.accidents}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Breakdowns</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.breakdowns}</p>
                </div>
                <Wrench className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center">
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </CardTitle>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${isRefetching ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Trip, driver, vehicle..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="exception_type">Exception Type</Label>
                <Select value={exceptionType} onValueChange={(v) => setExceptionType(v as ExceptionType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="accident">Accident</SelectItem>
                    <SelectItem value="breakdown">Breakdown</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="resolution_status">Resolution Status</Label>
                <Select value={resolutionStatus} onValueChange={(v) => setResolutionStatus(v as ResolutionStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="unresolved">Unresolved</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="start_date">From Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="end_date">To Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Exceptions ({filteredTrips.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : filteredTrips.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">No exceptions found</p>
                <p className="text-sm">
                  {hasActiveFilters ? "Try adjusting your filters" : "All trips are running smoothly"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTrips.map((trip) => (
                  <div
                    key={trip.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/trips/${trip.id}`)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        {getExceptionIcon(trip.hold_reason || 'unknown')}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{trip.trip_code}</span>
                            {getExceptionBadge(trip.hold_reason || 'unknown')}
                            {trip.is_resolved ? (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Resolved
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                                <Clock className="h-3 w-3 mr-1" />
                                Unresolved
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              {trip.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-muted-foreground mt-1">
                            {trip.origin_location?.location_name || 'N/A'} → {trip.destination_location?.location_name || 'N/A'}
                          </p>
                          
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>
                              {trip.driver?.name || 'No driver'} • {trip.vehicle?.vehicle_number || 'No vehicle'}
                            </span>
                            {trip.hold_at && (
                              <span>
                                On hold: {format(parseISO(trip.hold_at), 'MMM d, yyyy HH:mm')}
                              </span>
                            )}
                            {trip.resolved_at && (
                              <span className="text-green-600">
                                Resolved: {format(parseISO(trip.resolved_at), 'MMM d, yyyy HH:mm')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {trip.hold_at && formatDistanceToNow(parseISO(trip.hold_at), { addSuffix: true })}
                        </span>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
