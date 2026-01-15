import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Key, Shield, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function AdminRecovery() {
  const navigate = useNavigate();
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");

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
      toast({ title: "Success", description: "Superadmin access restored. Please log in." });
      setRecoveryCode("");
      setRecoveryEmail("");
      navigate("/");
    },
    onError: (error: Error) => {
      toast({ title: "Recovery Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryCode || !recoveryEmail) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }
    recoveryMutation.mutate({ code: recoveryCode, email: recoveryEmail });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Emergency Admin Recovery</CardTitle>
          <CardDescription>
            Use your recovery code to restore superadmin access. This should only be used when all superadmins have been locked out.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recoveryEmail">Your Email Address</Label>
              <Input
                id="recoveryEmail"
                type="email"
                placeholder="your@email.com"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                The email of the account you want to grant superadmin access to
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="recoveryCode">Recovery Code</Label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="recoveryCode"
                  type="password"
                  placeholder="Enter your recovery code"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                The secret code stored in your Supabase secrets
              </p>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={recoveryMutation.isPending}
            >
              {recoveryMutation.isPending ? "Recovering Access..." : "Recover Superadmin Access"}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <Link 
              to="/" 
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
