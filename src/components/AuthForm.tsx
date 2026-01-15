import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { Mail, Lock, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import tmsLogo from "@/assets/tms-logo.png";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

const signInSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }),
});

export function AuthForm() {
  const navigate = useNavigate();
  const { signIn, user, isSuperadmin, loading, isPasswordRecovery, clearPasswordRecovery } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

  // Show password reset form if in recovery mode
  if (isPasswordRecovery) {
    return <ResetPasswordForm onComplete={clearPasswordRecovery} />;
  }

  // Redirect if already logged in
  if (!loading && user && isSuperadmin) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  const handleSignIn = async () => {
    const validation = signInSchema.safeParse({ email, password });
    
    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    const { error } = await signIn(email, password);
    
    setIsLoading(false);

    if (error) {
      toast({
        title: "Sign In Failed",
        description: error.message === "Invalid login credentials" 
          ? "Invalid email or password. Please try again."
          : error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Welcome back!",
      description: "Successfully signed in",
    });
    navigate("/dashboard");
  };

  const handleForgotPassword = async () => {
    const validation = forgotPasswordSchema.safeParse({ email: resetEmail });
    
    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: redirectUrl,
    });
    
    setIsLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setResetSent(true);
    toast({
      title: "Email Sent",
      description: "Check your email for the password reset link",
    });
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-auth-background p-4">
        <Card className="w-full max-w-md shadow-lg border-auth-border">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <img src={tmsLogo} alt="TMS Logo" className="h-16 w-auto" />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">
              Reset Password
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {resetSent 
                ? "Check your email for the reset link"
                : "Enter your email to receive a password reset link"
              }
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {!resetSent ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="reset-email" className="text-sm font-medium text-foreground">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="Enter your email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="pl-10"
                      onKeyDown={(e) => e.key === "Enter" && handleForgotPassword()}
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleForgotPassword}
                  disabled={isLoading}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? "Sending..." : "Send Reset Link"}
                </Button>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-4">
                  We've sent a password reset link to <strong>{resetEmail}</strong>
                </p>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setResetSent(false);
                    setResetEmail("");
                  }}
                  className="mr-2"
                >
                  Send Again
                </Button>
              </div>
            )}

            <Button 
              variant="ghost"
              onClick={() => {
                setShowForgotPassword(false);
                setResetSent(false);
                setResetEmail("");
              }}
              className="w-full"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-auth-background p-4">
      <Card className="w-full max-w-md shadow-lg border-auth-border">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <img src={tmsLogo} alt="TMS Logo" className="h-16 w-auto" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">
            Trip Management System
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Sign in with your credentials to continue
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="signin-email" className="text-sm font-medium text-foreground">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="signin-email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label htmlFor="signin-password" className="text-sm font-medium text-foreground">
                  Password
                </label>
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-xs text-primary"
                  onClick={() => setShowForgotPassword(true)}
                >
                  Forgot Password?
                </Button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="signin-password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                />
              </div>
            </div>

            <Button 
              onClick={handleSignIn}
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Contact your administrator if you need an account
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
