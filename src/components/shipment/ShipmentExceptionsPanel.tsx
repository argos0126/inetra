import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { 
  AlertCircle, AlertTriangle, Check, ChevronUp, Clock, 
  Copy, FileX, MapPinOff, Receipt, Scale, Truck, UserX, 
  ArrowUpCircle, MessageSquare
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  ShipmentException,
  ExceptionType,
  ExceptionStatus,
  exceptionConfig,
  updateExceptionStatus,
  logException,
} from '@/utils/shipmentExceptions';

interface ShipmentExceptionsPanelProps {
  shipmentId: string;
  onExceptionChange?: () => void;
}

const getExceptionIcon = (type: ExceptionType) => {
  const iconMap: Record<ExceptionType, React.ReactNode> = {
    duplicate_mapping: <Copy className="h-4 w-4" />,
    capacity_exceeded: <Scale className="h-4 w-4" />,
    vehicle_not_arrived: <Truck className="h-4 w-4" />,
    loading_discrepancy: <Scale className="h-4 w-4" />,
    tracking_unavailable: <MapPinOff className="h-4 w-4" />,
    ndr_consignee_unavailable: <UserX className="h-4 w-4" />,
    pod_rejected: <FileX className="h-4 w-4" />,
    invoice_dispute: <Receipt className="h-4 w-4" />,
    delay_exceeded: <Clock className="h-4 w-4" />,
    weight_mismatch: <Scale className="h-4 w-4" />,
    other: <AlertCircle className="h-4 w-4" />,
  };
  return iconMap[type] || <AlertCircle className="h-4 w-4" />;
};

const getStatusBadge = (status: ExceptionStatus) => {
  const variants: Record<ExceptionStatus, { variant: 'destructive' | 'secondary' | 'default' | 'outline'; label: string }> = {
    open: { variant: 'destructive', label: 'Open' },
    acknowledged: { variant: 'secondary', label: 'Acknowledged' },
    resolved: { variant: 'default', label: 'Resolved' },
    escalated: { variant: 'destructive', label: 'Escalated' },
  };
  const config = variants[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

const getSeverityBadge = (severity: string) => {
  const variants: Record<string, { className: string; label: string }> = {
    low: { className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', label: 'Low' },
    medium: { className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', label: 'Medium' },
    high: { className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', label: 'High' },
    critical: { className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', label: 'Critical' },
  };
  const config = variants[severity] || variants.medium;
  return <Badge className={config.className}>{config.label}</Badge>;
};

export default function ShipmentExceptionsPanel({ 
  shipmentId, 
  onExceptionChange 
}: ShipmentExceptionsPanelProps) {
  const queryClient = useQueryClient();
  const [selectedException, setSelectedException] = useState<ShipmentException | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'acknowledge' | 'resolve' | 'escalate'>('acknowledge');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [escalateTo, setEscalateTo] = useState('');
  const [addExceptionOpen, setAddExceptionOpen] = useState(false);
  const [newExceptionType, setNewExceptionType] = useState<ExceptionType>('other');
  const [newExceptionDescription, setNewExceptionDescription] = useState('');

  const { data: exceptions = [], isLoading, refetch } = useQuery({
    queryKey: ['shipment-exceptions', shipmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipment_exceptions')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('detected_at', { ascending: false });
      
      if (error) throw error;
      return data as ShipmentException[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ 
      exceptionId, 
      status, 
      notes, 
      escalatedTo 
    }: { 
      exceptionId: string; 
      status: ExceptionStatus; 
      notes?: string;
      escalatedTo?: string;
    }) => {
      const result = await updateExceptionStatus(exceptionId, status, {
        resolutionNotes: notes,
        escalatedTo,
      });
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success('Exception updated successfully');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['shipment', shipmentId] });
      onExceptionChange?.();
      setActionDialogOpen(false);
      setSelectedException(null);
      setResolutionNotes('');
      setEscalateTo('');
    },
    onError: (error) => {
      toast.error(`Failed to update exception: ${error.message}`);
    },
  });

  const addExceptionMutation = useMutation({
    mutationFn: async () => {
      const result = await logException(shipmentId, newExceptionType, newExceptionDescription);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success('Exception logged successfully');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['shipment', shipmentId] });
      onExceptionChange?.();
      setAddExceptionOpen(false);
      setNewExceptionType('other');
      setNewExceptionDescription('');
    },
    onError: (error) => {
      toast.error(`Failed to log exception: ${error.message}`);
    },
  });

  const handleAction = (exception: ShipmentException, action: 'acknowledge' | 'resolve' | 'escalate') => {
    setSelectedException(exception);
    setActionType(action);
    setActionDialogOpen(true);
  };

  const confirmAction = () => {
    if (!selectedException) return;

    const statusMap = {
      acknowledge: 'acknowledged' as ExceptionStatus,
      resolve: 'resolved' as ExceptionStatus,
      escalate: 'escalated' as ExceptionStatus,
    };

    updateStatusMutation.mutate({
      exceptionId: selectedException.id,
      status: statusMap[actionType],
      notes: resolutionNotes || undefined,
      escalatedTo: escalateTo || undefined,
    });
  };

  const openExceptions = exceptions.filter(e => e.status === 'open' || e.status === 'escalated');
  const closedExceptions = exceptions.filter(e => e.status === 'acknowledged' || e.status === 'resolved');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Exceptions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading exceptions...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Exceptions
              {openExceptions.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {openExceptions.length} Open
                </Badge>
              )}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setAddExceptionOpen(true)}>
              Log Exception
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {exceptions.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              No exceptions recorded for this shipment
            </div>
          ) : (
            <>
              {/* Open Exceptions */}
              {openExceptions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-destructive">Open Issues</h4>
                  {openExceptions.map((exception) => (
                    <div 
                      key={exception.id} 
                      className="border border-destructive/30 rounded-lg p-3 bg-destructive/5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 text-destructive">
                            {getExceptionIcon(exception.exception_type)}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {exceptionConfig[exception.exception_type]?.label || exception.exception_type}
                              </span>
                              {getSeverityBadge(exception.severity)}
                              {getStatusBadge(exception.status)}
                            </div>
                            <p className="text-sm text-muted-foreground">{exception.description}</p>
                            {exception.resolution_path && (
                              <p className="text-xs text-muted-foreground">
                                <strong>Resolution:</strong> {exception.resolution_path}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Detected: {format(new Date(exception.detected_at), 'MMM d, yyyy HH:mm')}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {exception.status === 'open' && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleAction(exception, 'acknowledge')}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleAction(exception, 'escalate')}
                              >
                                <ArrowUpCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleAction(exception, 'resolve')}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Closed Exceptions */}
              {closedExceptions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Resolved</h4>
                  {closedExceptions.map((exception) => (
                    <div 
                      key={exception.id} 
                      className="border rounded-lg p-3 bg-muted/30"
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 text-muted-foreground">
                          {getExceptionIcon(exception.exception_type)}
                        </div>
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {exceptionConfig[exception.exception_type]?.label || exception.exception_type}
                            </span>
                            {getStatusBadge(exception.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">{exception.description}</p>
                          {exception.resolution_notes && (
                            <p className="text-xs text-muted-foreground">
                              <strong>Notes:</strong> {exception.resolution_notes}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {exception.resolved_at 
                              ? `Resolved: ${format(new Date(exception.resolved_at), 'MMM d, yyyy HH:mm')}`
                              : `Acknowledged: ${format(new Date(exception.acknowledged_at!), 'MMM d, yyyy HH:mm')}`
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'acknowledge' && 'Acknowledge Exception'}
              {actionType === 'resolve' && 'Resolve Exception'}
              {actionType === 'escalate' && 'Escalate Exception'}
            </DialogTitle>
            <DialogDescription>
              {selectedException && exceptionConfig[selectedException.exception_type]?.label}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {actionType === 'escalate' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Escalate To</label>
                <Select value={escalateTo} onValueChange={setEscalateTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select escalation target" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operations_manager">Operations Manager</SelectItem>
                    <SelectItem value="transporter">Transporter</SelectItem>
                    <SelectItem value="finance">Finance Team</SelectItem>
                    <SelectItem value="customer_service">Customer Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {actionType === 'resolve' ? 'Resolution Notes' : 'Notes (Optional)'}
              </label>
              <Textarea
                placeholder={actionType === 'resolve' ? 'Describe how the issue was resolved...' : 'Add any notes...'}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmAction}
              disabled={updateStatusMutation.isPending || (actionType === 'escalate' && !escalateTo)}
            >
              {updateStatusMutation.isPending ? 'Updating...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Exception Dialog */}
      <Dialog open={addExceptionOpen} onOpenChange={setAddExceptionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log New Exception</DialogTitle>
            <DialogDescription>
              Record an exception for this shipment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Exception Type</label>
              <Select value={newExceptionType} onValueChange={(v) => setNewExceptionType(v as ExceptionType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(exceptionConfig).map(([type, config]) => (
                    <SelectItem key={type} value={type}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Describe the exception..."
                value={newExceptionDescription}
                onChange={(e) => setNewExceptionDescription(e.target.value)}
              />
            </div>
            {newExceptionType && (
              <div className="text-sm text-muted-foreground">
                <strong>Suggested Resolution:</strong> {exceptionConfig[newExceptionType]?.resolutionPath}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddExceptionOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => addExceptionMutation.mutate()}
              disabled={addExceptionMutation.isPending || !newExceptionDescription.trim()}
            >
              {addExceptionMutation.isPending ? 'Logging...' : 'Log Exception'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
