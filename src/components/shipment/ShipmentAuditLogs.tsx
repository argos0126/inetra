import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { 
  History, User, MapPin, Truck, CheckCircle, 
  Package, AlertTriangle, Clock, ChevronDown, ChevronUp,
  Settings, FileCheck, CreditCard
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

interface ShipmentAuditLogsProps {
  shipmentId: string;
}

interface StatusHistoryEntry {
  id: string;
  previous_status: string | null;
  new_status: string;
  previous_sub_status: string | null;
  new_sub_status: string | null;
  changed_at: string;
  changed_by: string | null;
  change_source: string | null;
  notes: string | null;
  metadata: Record<string, any> | null;
}

interface ExceptionEntry {
  id: string;
  exception_type: string;
  status: string;
  severity: string;
  description: string;
  detected_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
}

const getSourceIcon = (source: string | null) => {
  switch (source) {
    case 'geofence':
      return <MapPin className="h-4 w-4 text-blue-500" />;
    case 'api':
      return <Settings className="h-4 w-4 text-purple-500" />;
    case 'system':
      return <Truck className="h-4 w-4 text-gray-500" />;
    default:
      return <User className="h-4 w-4 text-green-500" />;
  }
};

const getStatusIcon = (status: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    created: <Package className="h-4 w-4" />,
    confirmed: <CheckCircle className="h-4 w-4" />,
    mapped: <Truck className="h-4 w-4" />,
    in_pickup: <MapPin className="h-4 w-4" />,
    in_transit: <Truck className="h-4 w-4" />,
    out_for_delivery: <Truck className="h-4 w-4" />,
    delivered: <CheckCircle className="h-4 w-4" />,
    ndr: <AlertTriangle className="h-4 w-4" />,
    returned: <Package className="h-4 w-4" />,
    success: <CheckCircle className="h-4 w-4" />,
  };
  return iconMap[status] || <Clock className="h-4 w-4" />;
};

const formatStatus = (status: string) => {
  return status.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

export default function ShipmentAuditLogs({ shipmentId }: ShipmentAuditLogsProps) {
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  // Fetch status history
  const { data: statusHistory = [], isLoading: loadingStatus } = useQuery({
    queryKey: ['shipment-status-history', shipmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipment_status_history')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('changed_at', { ascending: false });
      
      if (error) throw error;
      return data as StatusHistoryEntry[];
    },
  });

  // Fetch exceptions
  const { data: exceptions = [], isLoading: loadingExceptions } = useQuery({
    queryKey: ['shipment-exceptions-log', shipmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipment_exceptions')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('detected_at', { ascending: false });
      
      if (error) throw error;
      return data as ExceptionEntry[];
    },
  });

  const toggleExpand = (id: string) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderStatusEntry = (entry: StatusHistoryEntry) => {
    const isExpanded = expandedEntries.has(entry.id);
    const hasMetadata = entry.metadata && Object.keys(entry.metadata).length > 0;

    return (
      <div key={entry.id} className="border-l-2 border-primary/30 pl-4 pb-4 relative">
        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
          {getStatusIcon(entry.new_status)}
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{formatStatus(entry.new_status)}</span>
            {entry.new_sub_status && (
              <Badge variant="outline" className="text-xs">
                {formatStatus(entry.new_sub_status)}
              </Badge>
            )}
            {entry.change_source && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {getSourceIcon(entry.change_source)}
                <span className="capitalize">{entry.change_source}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {format(new Date(entry.changed_at), 'MMM d, yyyy HH:mm:ss')}
            {entry.previous_status && (
              <span>• From: {formatStatus(entry.previous_status)}</span>
            )}
          </div>
          
          {entry.notes && (
            <p className="text-sm text-muted-foreground mt-1">{entry.notes}</p>
          )}
          
          {hasMetadata && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 text-xs mt-1"
              onClick={() => toggleExpand(entry.id)}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Show Details
                </>
              )}
            </Button>
          )}
          
          {isExpanded && hasMetadata && (
            <div className="bg-muted/50 rounded p-2 mt-2 text-xs">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderExceptionEntry = (entry: ExceptionEntry) => {
    const isResolved = entry.status === 'resolved';
    
    return (
      <div 
        key={entry.id} 
        className={`border-l-2 pl-4 pb-4 relative ${
          isResolved ? 'border-green-500/30' : 'border-destructive/30'
        }`}
      >
        <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full flex items-center justify-center ${
          isResolved ? 'bg-green-500/20 border-2 border-green-500' : 'bg-destructive/20 border-2 border-destructive'
        }`}>
          <AlertTriangle className={`h-2.5 w-2.5 ${isResolved ? 'text-green-500' : 'text-destructive'}`} />
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{formatStatus(entry.exception_type)}</span>
            <Badge variant={isResolved ? 'default' : 'destructive'} className="text-xs">
              {formatStatus(entry.status)}
            </Badge>
            <Badge 
              className={`text-xs ${
                entry.severity === 'critical' ? 'bg-red-500' :
                entry.severity === 'high' ? 'bg-orange-500' :
                entry.severity === 'medium' ? 'bg-yellow-500' :
                'bg-blue-500'
              }`}
            >
              {entry.severity}
            </Badge>
          </div>
          
          <p className="text-sm text-muted-foreground">{entry.description}</p>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Detected: {format(new Date(entry.detected_at), 'MMM d, yyyy HH:mm')}
            {entry.resolved_at && (
              <span>• Resolved: {format(new Date(entry.resolved_at), 'MMM d, yyyy HH:mm')}</span>
            )}
          </div>
          
          {entry.resolution_notes && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              Resolution: {entry.resolution_notes}
            </p>
          )}
        </div>
      </div>
    );
  };

  const isLoading = loadingStatus || loadingExceptions;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Audit Logs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="status" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="status" className="text-xs">
              Status History
              {statusHistory.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {statusHistory.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="exceptions" className="text-xs">
              Exceptions
              {exceptions.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {exceptions.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="actions" className="text-xs">
              User Actions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="status" className="mt-4">
            {isLoading ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                Loading status history...
              </div>
            ) : statusHistory.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                No status changes recorded
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-0">
                  {statusHistory.map(renderStatusEntry)}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="exceptions" className="mt-4">
            {isLoading ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                Loading exceptions...
              </div>
            ) : exceptions.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                No exceptions recorded
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-0">
                  {exceptions.map(renderExceptionEntry)}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="actions" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-0">
                {/* Filter status history for manual actions */}
                {statusHistory
                  .filter(e => e.change_source === 'manual' || !e.change_source)
                  .map(entry => (
                    <div key={entry.id} className="border-l-2 border-green-500/30 pl-4 pb-4 relative">
                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
                        <User className="h-2.5 w-2.5 text-green-500" />
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            Status changed to {formatStatus(entry.new_status)}
                          </span>
                          {entry.new_sub_status && (
                            <Badge variant="outline" className="text-xs">
                              {formatStatus(entry.new_sub_status)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(entry.changed_at), 'MMM d, yyyy HH:mm:ss')}
                        </div>
                        {entry.notes && (
                          <p className="text-sm text-muted-foreground">{entry.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                {statusHistory.filter(e => e.change_source === 'manual' || !e.change_source).length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No manual user actions recorded
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
