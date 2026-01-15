import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/contexts/PermissionContext";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { toast } from "@/hooks/use-toast";
import { Shield, ShieldOff, Trash2, UserPlus, Key, History } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";

interface Superadmin {
  id: string;
  email: string;
  created_at: string;
}

interface AuditLog {
  id: string;
  action: string;
  performed_by: string | null;
  target_user_email: string | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
  details: Record<string, unknown> | null;
}

export default function AdminManagement() {
  const { isSuperAdmin, loading: permissionsLoading } = usePermissions();
  const queryClient = useQueryClient();
  const [promoteEmail, setPromoteEmail] = useState("");
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
  const [recoveryDialogOpen, setRecoveryDialogOpen] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [auditLogsOpen, setAuditLogsOpen] = useState(false);

  // Confirmation dialog states
  const [demoteTarget, setDemoteTarget] = useState<Superadmin | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Superadmin | null>(null);

  // Fetch superadmins
  const { data: superadmins, isLoading } = useQuery({
    queryKey: ["superadmins"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("admin-management", {
        body: { action: "list_superadmins" },
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`,
        },
      });
      if (response.error) throw new Error(response.error.message);
      return response.data.superadmins as Superadmin[];
    },
    enabled: isSuperAdmin,
  });

  // Fetch audit logs
  const { data: auditLogs, isLoading: auditLogsLoading } = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as AuditLog[];
    },
    enabled: isSuperAdmin && auditLogsOpen,
  });

  // Promote mutation
  const promoteMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data: session } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("admin-management", {
        body: { action: "promote_to_superadmin", targetEmail: email },
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`,
        },
      });
      if (response.error) throw new Error(response.error.message);
      if (!response.data.success) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmins"] });
      toast({ title: "Success", description: "User promoted to superadmin" });
      setPromoteEmail("");
      setPromoteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Demote mutation
  const demoteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data: session } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("admin-management", {
        body: { action: "demote_superadmin", targetUserId: userId },
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`,
        },
      });
      if (response.error) throw new Error(response.error.message);
      if (!response.data.success) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmins"] });
      toast({ title: "Success", description: "Superadmin demoted" });
      setDemoteTarget(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data: session } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("admin-management", {
        body: { action: "delete_user", targetUserId: userId },
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`,
        },
      });
      if (response.error) throw new Error(response.error.message);
      if (!response.data.success) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmins"] });
      toast({ title: "Success", description: "User deleted" });
      setDeleteTarget(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Recovery mutation
  const recoveryMutation = useMutation({
    mutationFn: async ({ code, email }: { code: string; email: string }) => {
      const response = await supabase.functions.invoke("admin-management", {
        body: { action: "recover_superadmin", recoveryCode: code, targetEmail: email },
      });
      if (response.error) throw new Error(response.error.message);
      if (!response.data.success) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmins"] });
      toast({ title: "Success", description: "Superadmin recovered successfully" });
      setRecoveryCode("");
      setRecoveryEmail("");
      setRecoveryDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (permissionsLoading) {
    return (
      <Layout>
        <LoadingSpinner />
      </Layout>
    );
  }

  if (!isSuperAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">Access denied. Superadmin privileges required.</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title="Admin Management"
        description="Manage superadmin users and access recovery"
      />

      <div className="space-y-6 p-6">
        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setPromoteDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Promote User
          </Button>
          <Button variant="outline" onClick={() => setRecoveryDialogOpen(true)}>
            <Key className="h-4 w-4 mr-2" />
            Emergency Recovery
          </Button>
          <Button variant="outline" onClick={() => setAuditLogsOpen(true)}>
            <History className="h-4 w-4 mr-2" />
            View Audit Logs
          </Button>
        </div>

        {/* Superadmins List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Superadmins
            </CardTitle>
            <CardDescription>Users with full system access</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingSpinner />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role Assigned</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {superadmins?.map((admin) => {
                    const isOnlySuperadmin = superadmins.length === 1;
                    return (
                      <TableRow key={admin.id}>
                        <TableCell className="font-medium">{admin.email}</TableCell>
                        <TableCell>
                          <Badge variant="default">
                            <Shield className="h-3 w-3 mr-1" />
                            Superadmin
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {isOnlySuperadmin ? (
                            <span className="text-sm text-muted-foreground italic">
                              Last superadmin - cannot modify
                            </span>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDemoteTarget(admin)}
                              >
                                <ShieldOff className="h-4 w-4 mr-1" />
                                Demote
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setDeleteTarget(admin)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!superadmins || superadmins.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No superadmins found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Promote Dialog */}
        <Dialog open={promoteDialogOpen} onOpenChange={setPromoteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Promote User to Superadmin</DialogTitle>
              <DialogDescription>
                Enter the email of the user you want to promote. They must already have an account.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="promoteEmail">Email Address</Label>
                <Input
                  id="promoteEmail"
                  type="email"
                  placeholder="user@example.com"
                  value={promoteEmail}
                  onChange={(e) => setPromoteEmail(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPromoteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => promoteMutation.mutate(promoteEmail)}
                disabled={!promoteEmail || promoteMutation.isPending}
              >
                {promoteMutation.isPending ? "Promoting..." : "Promote"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Recovery Dialog */}
        <Dialog open={recoveryDialogOpen} onOpenChange={setRecoveryDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Emergency Superadmin Recovery</DialogTitle>
              <DialogDescription>
                Use your recovery code to regain superadmin access. This should only be used in emergencies.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="recoveryEmail">Your Email Address</Label>
                <Input
                  id="recoveryEmail"
                  type="email"
                  placeholder="your@email.com"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recoveryCode">Recovery Code</Label>
                <Input
                  id="recoveryCode"
                  type="password"
                  placeholder="Enter recovery code"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRecoveryDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => recoveryMutation.mutate({ code: recoveryCode, email: recoveryEmail })}
                disabled={!recoveryCode || !recoveryEmail || recoveryMutation.isPending}
              >
                {recoveryMutation.isPending ? "Recovering..." : "Recover Access"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Audit Logs Dialog */}
        <Dialog open={auditLogsOpen} onOpenChange={setAuditLogsOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Admin Audit Logs</DialogTitle>
              <DialogDescription>
                Recent administrative actions
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {auditLogsLoading ? (
                <LoadingSpinner />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs?.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {format(new Date(log.created_at), "MMM d, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>{log.action}</TableCell>
                        <TableCell>{log.target_user_email || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={log.success ? "default" : "destructive"}>
                            {log.success ? "Success" : "Failed"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!auditLogs || auditLogs.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No audit logs found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Demote Confirmation */}
        <ConfirmDialog
          open={!!demoteTarget}
          onOpenChange={(open) => !open && setDemoteTarget(null)}
          title="Demote Superadmin"
          description={`Are you sure you want to demote ${demoteTarget?.email}? They will lose all superadmin privileges.`}
          confirmText="Demote"
          onConfirm={() => demoteTarget && demoteMutation.mutate(demoteTarget.id)}
        />

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title="Delete User"
          description={`Are you sure you want to permanently delete ${deleteTarget?.email}? This action cannot be undone.`}
          confirmText="Delete"
          variant="destructive"
          onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        />
      </div>
    </Layout>
  );
}
