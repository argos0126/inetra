import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { DataTable } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ResetPasswordDialog } from "@/components/user/ResetPasswordDialog";
import { format } from "date-fns";
import { UserPlus, RefreshCw, KeyRound, ToggleLeft, ToggleRight, Truck, Package } from "lucide-react";
import { getDisplayErrorMessage, logError } from "@/utils/errorHandler";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface OngoingWork {
  trips: number;
  shipments: number;
}

interface User {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  ongoing_work?: OngoingWork;
}

const roleColors: Record<string, string> = {
  superadmin: "bg-red-600",
  admin: "bg-blue-600",
  user: "bg-green-600",
};

const roleLabels: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  user: "User",
};

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [ongoingWorkMap, setOngoingWorkMap] = useState<Map<string, OngoingWork>>(new Map());
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{ open: boolean; user: User | null }>({ 
    open: false, 
    user: null 
  });
  const [resetting, setResetting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Real-time subscription for profiles
    const profilesChannel = supabase
      .channel('users-profiles-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchUsers())
      .subscribe();

    // Real-time subscription for user_roles
    const rolesChannel = supabase
      .channel('users-roles-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => fetchUsers())
      .subscribe();

    fetchUsers();

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(rolesChannel);
    };
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select(`id, user_id, first_name, last_name, company, is_active, created_at`)
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      const usersData: User[] = (profiles || []).map(profile => ({
        id: profile.id,
        user_id: profile.user_id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        company: profile.company,
        role: roleMap.get(profile.user_id) || "user",
        is_active: profile.is_active ?? true,
        created_at: profile.created_at,
      }));

      setUsers(usersData);
      
      // Fetch ongoing work for all users in the background
      fetchOngoingWorkForUsers(usersData);
    } catch (error: any) {
      logError(error, "fetchUsers");
      toast({
        title: "Error loading users",
        description: getDisplayErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchOngoingWorkForUsers = async (usersData: User[]) => {
    try {
      const userIds = usersData.map(u => u.user_id);
      
      // Fetch all drivers, customers, transporters linked to these users
      const [driversRes, customersRes, transportersRes] = await Promise.all([
        supabase.from("drivers").select("id, user_id").in("user_id", userIds),
        supabase.from("customers").select("id, user_id").in("user_id", userIds),
        supabase.from("transporters").select("id, user_id").in("user_id", userIds),
      ]);

      const driverMap = new Map(driversRes.data?.map(d => [d.user_id, d.id]) || []);
      const customerMap = new Map(customersRes.data?.map(c => [c.user_id, c.id]) || []);
      const transporterMap = new Map(transportersRes.data?.map(t => [t.user_id, t.id]) || []);

      // Get all entity IDs for batch queries
      const driverIds = driversRes.data?.map(d => d.id) || [];
      const customerIds = customersRes.data?.map(c => c.id) || [];
      const transporterIds = transportersRes.data?.map(t => t.id) || [];

      // Fetch ongoing trips for all entities
      const [driverTripsRes, customerTripsRes, transporterTripsRes, customerShipmentsRes] = await Promise.all([
        driverIds.length > 0 
          ? supabase.from("trips").select("driver_id").in("driver_id", driverIds).in("status", ["created", "ongoing"])
          : Promise.resolve({ data: [] }),
        customerIds.length > 0
          ? supabase.from("trips").select("customer_id").in("customer_id", customerIds).in("status", ["created", "ongoing"])
          : Promise.resolve({ data: [] }),
        transporterIds.length > 0
          ? supabase.from("trips").select("transporter_id").in("transporter_id", transporterIds).in("status", ["created", "ongoing"])
          : Promise.resolve({ data: [] }),
        customerIds.length > 0
          ? supabase.from("shipments").select("customer_id").in("customer_id", customerIds).in("status", ["created", "confirmed", "mapped", "in_pickup", "in_transit", "out_for_delivery"])
          : Promise.resolve({ data: [] }),
      ]);

      // Count trips per entity
      const driverTripCounts = new Map<string, number>();
      driverTripsRes.data?.forEach(t => {
        driverTripCounts.set(t.driver_id, (driverTripCounts.get(t.driver_id) || 0) + 1);
      });

      const customerTripCounts = new Map<string, number>();
      customerTripsRes.data?.forEach(t => {
        customerTripCounts.set(t.customer_id, (customerTripCounts.get(t.customer_id) || 0) + 1);
      });

      const transporterTripCounts = new Map<string, number>();
      transporterTripsRes.data?.forEach(t => {
        transporterTripCounts.set(t.transporter_id, (transporterTripCounts.get(t.transporter_id) || 0) + 1);
      });

      const customerShipmentCounts = new Map<string, number>();
      customerShipmentsRes.data?.forEach(s => {
        customerShipmentCounts.set(s.customer_id, (customerShipmentCounts.get(s.customer_id) || 0) + 1);
      });

      // Build ongoing work map per user
      const workMap = new Map<string, OngoingWork>();
      
      for (const user of usersData) {
        let trips = 0;
        let shipments = 0;

        const driverId = driverMap.get(user.user_id);
        if (driverId) {
          trips += driverTripCounts.get(driverId) || 0;
        }

        const customerId = customerMap.get(user.user_id);
        if (customerId) {
          trips += customerTripCounts.get(customerId) || 0;
          shipments += customerShipmentCounts.get(customerId) || 0;
        }

        const transporterId = transporterMap.get(user.user_id);
        if (transporterId) {
          trips += transporterTripCounts.get(transporterId) || 0;
        }

        if (trips > 0 || shipments > 0) {
          workMap.set(user.user_id, { trips, shipments });
        }
      }

      setOngoingWorkMap(workMap);
    } catch (error) {
      console.error("Error fetching ongoing work:", error);
    }
  };

  const syncEntityAccounts = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-missing-entity-users");
      
      if (error) throw error;

      const result = data as { 
        success: boolean; 
        message: string; 
        results: {
          drivers: { created: number; failed: number; errors: string[] };
          customers: { created: number; failed: number; errors: string[] };
          transporters: { created: number; failed: number; errors: string[] };
        };
        tempPassword: string;
      };

      toast({ title: "Sync Complete", description: result.message });
      await fetchUsers();
    } catch (error: any) {
      logError(error, "syncEntityAccounts");
      toast({
        title: "Sync Failed",
        description: getDisplayErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleResetPassword = async (newPassword: string) => {
    if (!resetPasswordDialog.user) return;
    
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-user-password", {
        body: { userId: resetPasswordDialog.user.user_id, newPassword }
      });
      
      if (error) throw error;

      toast({
        title: "Password Reset",
        description: `Password has been reset successfully`,
      });

      setResetPasswordDialog({ open: false, user: null });
    } catch (error: any) {
      logError(error, "handleResetPassword");
      toast({
        title: "Reset Failed",
        description: getDisplayErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  };

  // Check if user has ongoing trips/shipments
  const checkOngoingWork = async (userIdToCheck: string): Promise<{ hasOngoing: boolean; message: string }> => {
    try {
      // Check if user is a driver with ongoing trips
      const { data: driver } = await supabase
        .from("drivers")
        .select("id")
        .eq("user_id", userIdToCheck)
        .maybeSingle();

      if (driver) {
        const { count: driverTrips } = await supabase
          .from("trips")
          .select("id", { count: "exact", head: true })
          .eq("driver_id", driver.id)
          .in("status", ["created", "ongoing"]);

        if (driverTrips && driverTrips > 0) {
          return { hasOngoing: true, message: `${driverTrips} ongoing trip(s) as driver` };
        }
      }

      // Check if user is linked to a customer with ongoing shipments/trips
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("user_id", userIdToCheck)
        .maybeSingle();

      if (customer) {
        const { count: customerTrips } = await supabase
          .from("trips")
          .select("id", { count: "exact", head: true })
          .eq("customer_id", customer.id)
          .in("status", ["created", "ongoing"]);

        if (customerTrips && customerTrips > 0) {
          return { hasOngoing: true, message: `${customerTrips} ongoing trip(s) as customer` };
        }

        const { count: customerShipments } = await supabase
          .from("shipments")
          .select("id", { count: "exact", head: true })
          .eq("customer_id", customer.id)
          .in("status", ["created", "confirmed", "mapped", "in_pickup", "in_transit", "out_for_delivery"]);

        if (customerShipments && customerShipments > 0) {
          return { hasOngoing: true, message: `${customerShipments} ongoing shipment(s) as customer` };
        }
      }

      // Check if user is linked to a transporter with ongoing trips
      const { data: transporter } = await supabase
        .from("transporters")
        .select("id")
        .eq("user_id", userIdToCheck)
        .maybeSingle();

      if (transporter) {
        const { count: transporterTrips } = await supabase
          .from("trips")
          .select("id", { count: "exact", head: true })
          .eq("transporter_id", transporter.id)
          .in("status", ["created", "ongoing"]);

        if (transporterTrips && transporterTrips > 0) {
          return { hasOngoing: true, message: `${transporterTrips} ongoing trip(s) as transporter` };
        }
      }

      return { hasOngoing: false, message: "" };
    } catch (error) {
      console.error("Error checking ongoing work:", error);
      return { hasOngoing: false, message: "" };
    }
  };

  const handleStatusToggle = async (user: User) => {
    // Prevent deactivating superadmins
    if (user.role === 'superadmin' && user.is_active) {
      toast({
        title: "Action Not Allowed",
        description: "Superadmin users cannot be deactivated",
        variant: "destructive",
      });
      return;
    }

    // Check for ongoing work when deactivating
    if (user.is_active) {
      const { hasOngoing, message } = await checkOngoingWork(user.user_id);
      if (hasOngoing) {
        toast({
          title: "Action Not Allowed",
          description: `Cannot deactivate user. Has ${message}. Complete or reassign first.`,
          variant: "destructive",
        });
        return;
      }
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: !user.is_active })
        .eq("id", user.id);

      if (error) throw error;

      setUsers(users.map(u => 
        u.id === user.id ? { ...u, is_active: !u.is_active } : u
      ));

      toast({
        title: "Status Updated",
        description: `User is now ${!user.is_active ? 'active' : 'inactive'}`,
      });
    } catch (error: any) {
      logError(error, "handleStatusToggle");
      toast({
        title: "Error",
        description: getDisplayErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  // Bulk selection handlers
  const handleSelectUser = (userId: string, checked: boolean) => {
    setSelectedUserIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(userId);
      } else {
        newSet.delete(userId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUserIds(new Set(users.map(u => u.id)));
    } else {
      setSelectedUserIds(new Set());
    }
  };

  const handleBulkStatusUpdate = async (setActive: boolean) => {
    if (selectedUserIds.size === 0) return;

    // Filter out superadmins when deactivating
    let idsToUpdate = Array.from(selectedUserIds);
    let skippedSuperadmins = 0;
    let skippedWithOngoingWork = 0;

    if (!setActive) {
      const originalCount = idsToUpdate.length;
      
      // Filter out superadmins
      idsToUpdate = idsToUpdate.filter(id => {
        const user = users.find(u => u.id === id);
        if (user?.role === 'superadmin') {
          skippedSuperadmins++;
          return false;
        }
        return true;
      });

      // Check for ongoing work for each remaining user
      const validIds: string[] = [];
      for (const id of idsToUpdate) {
        const user = users.find(u => u.id === id);
        if (user && user.is_active) {
          const { hasOngoing } = await checkOngoingWork(user.user_id);
          if (hasOngoing) {
            skippedWithOngoingWork++;
          } else {
            validIds.push(id);
          }
        } else {
          validIds.push(id);
        }
      }
      idsToUpdate = validIds;
    }

    if (idsToUpdate.length === 0) {
      let reason = "";
      if (skippedSuperadmins > 0 && skippedWithOngoingWork > 0) {
        reason = `${skippedSuperadmins} superadmin(s) and ${skippedWithOngoingWork} user(s) with ongoing work`;
      } else if (skippedSuperadmins > 0) {
        reason = "Superadmin users cannot be deactivated";
      } else if (skippedWithOngoingWork > 0) {
        reason = "Users have ongoing trips/shipments";
      }
      toast({
        title: "Action Not Allowed",
        description: reason,
        variant: "destructive",
      });
      return;
    }

    setBulkUpdating(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: setActive })
        .in("id", idsToUpdate);

      if (error) throw error;

      const updatedIds = new Set(idsToUpdate);
      setUsers(users.map(u => 
        updatedIds.has(u.id) ? { ...u, is_active: setActive } : u
      ));

      let message = `${idsToUpdate.length} user(s) set to ${setActive ? 'active' : 'inactive'}`;
      const skipped = skippedSuperadmins + skippedWithOngoingWork;
      if (skipped > 0) {
        message += `. ${skipped} user(s) skipped.`;
      }

      toast({
        title: "Bulk Update Complete",
        description: message,
      });

      setSelectedUserIds(new Set());
    } catch (error: any) {
      logError(error, "handleBulkStatusUpdate");
      toast({
        title: "Bulk Update Failed",
        description: getDisplayErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setBulkUpdating(false);
    }
  };

  const isAllSelected = users.length > 0 && selectedUserIds.size === users.length;
  const isIndeterminate = selectedUserIds.size > 0 && selectedUserIds.size < users.length;

  const columns = [
    {
      key: "select",
      label: (
        <Checkbox
          checked={isAllSelected}
          onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
          aria-label="Select all"
          className={isIndeterminate ? "data-[state=checked]:bg-primary/50" : ""}
        />
      ),
      render: (_: any, row: User) => (
        <Checkbox
          checked={selectedUserIds.has(row.id)}
          onCheckedChange={(checked) => handleSelectUser(row.id, checked as boolean)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${row.first_name || 'user'}`}
        />
      )
    },
    { 
      key: "name", 
      label: "Name",
      render: (_: any, row: User) => (
        <div>
          <div className="font-medium">
            {row.first_name || row.last_name 
              ? `${row.first_name || ''} ${row.last_name || ''}`.trim()
              : 'Unnamed User'
            }
          </div>
          <div className="text-xs text-muted-foreground">{row.user_id.slice(0, 8)}...</div>
        </div>
      )
    },
    { 
      key: "company", 
      label: "Company",
      render: (value: string | null) => value || "-"
    },
    { 
      key: "role", 
      label: "Role", 
      render: (value: string) => (
        <Badge className={roleColors[value] || "bg-gray-600"}>
          {roleLabels[value] || value}
        </Badge>
      ) 
    },
    {
      key: "ongoing_work",
      label: "Ongoing Work",
      render: (_: any, row: User) => {
        const work = ongoingWorkMap.get(row.user_id);
        if (!work || (work.trips === 0 && work.shipments === 0)) {
          return <span className="text-muted-foreground text-sm">-</span>;
        }
        return (
          <TooltipProvider>
            <div className="flex items-center gap-2">
              {work.trips > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                      <Truck className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">{work.trips}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{work.trips} ongoing trip(s)</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {work.shipments > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                      <Package className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">{work.shipments}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{work.shipments} ongoing shipment(s)</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </TooltipProvider>
        );
      }
    },
    {
      key: "is_active",
      label: "Status",
      render: (value: boolean, row: User) => {
        const work = ongoingWorkMap.get(row.user_id);
        const hasOngoingWork = work && (work.trips > 0 || work.shipments > 0);
        const isSuperadmin = row.role === 'superadmin';
        const cannotDeactivate = value && (isSuperadmin || hasOngoingWork);
        
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant={value ? "default" : "secondary"}
                  className={cannotDeactivate ? "cursor-not-allowed opacity-80" : "cursor-pointer"}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!cannotDeactivate || !value) {
                      handleStatusToggle(row);
                    }
                  }}
                >
                  {value ? "Active" : "Inactive"}
                </Badge>
              </TooltipTrigger>
              {cannotDeactivate && (
                <TooltipContent>
                  <p>
                    {isSuperadmin 
                      ? "Superadmins cannot be deactivated" 
                      : "Has ongoing trips/shipments"}
                  </p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        );
      }
    },
    { 
      key: "created_at", 
      label: "Created",
      render: (value: string) => format(new Date(value), "MMM d, yyyy")
    },
    {
      key: "actions",
      label: "Actions",
      render: (_: any, row: User) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setResetPasswordDialog({ open: true, user: row });
          }}
        >
          <KeyRound className="h-4 w-4 mr-1" />
          Reset Password
        </Button>
      )
    }
  ];

  const handleView = (user: User) => {
    navigate(`/users/${user.id}`);
  };

  const handleEdit = (user: User) => {
    navigate(`/users/${user.id}/edit`);
  };

  const handleAdd = () => {
    navigate("/users/add");
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">User Management</h1>
            <p className="text-muted-foreground">Manage users and their roles</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={syncEntityAccounts} disabled={syncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Entity Accounts'}
            </Button>
            <Button onClick={handleAdd}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedUserIds.size > 0 && (
          <div className="flex items-center gap-4 p-3 bg-muted rounded-lg border">
            <span className="text-sm font-medium">
              {selectedUserIds.size} user(s) selected
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkStatusUpdate(true)}
                disabled={bulkUpdating}
              >
                <ToggleRight className="h-4 w-4 mr-1" />
                Set Active
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkStatusUpdate(false)}
                disabled={bulkUpdating}
              >
                <ToggleLeft className="h-4 w-4 mr-1" />
                Set Inactive
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedUserIds(new Set())}
              >
                Clear Selection
              </Button>
            </div>
          </div>
        )}

        <DataTable
          title=""
          columns={columns}
          data={users}
          onView={handleView}
          onEdit={handleEdit}
          searchPlaceholder="Search users..."
        />

        {users.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No users found. Click "Add User" to create a new user.</p>
          </div>
        )}

        <ResetPasswordDialog
          open={resetPasswordDialog.open}
          onOpenChange={(open) => setResetPasswordDialog({ open, user: open ? resetPasswordDialog.user : null })}
          userName={resetPasswordDialog.user?.first_name || 'this user'}
          onConfirm={handleResetPassword}
          isLoading={resetting}
        />
      </div>
    </Layout>
  );
}