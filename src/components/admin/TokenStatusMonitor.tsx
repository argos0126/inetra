import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TokenInfo {
  token_type: string;
  expires_at: string;
  updated_at: string;
}

export function TokenStatusMonitor() {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchTokenStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('integration_tokens')
        .select('token_type, expires_at, updated_at')
        .order('token_type');

      if (error) throw error;
      setTokens(data || []);
    } catch (error: any) {
      console.error('Error fetching tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokenStatus();
    // Refresh every minute
    const interval = setInterval(fetchTokenStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const refreshTokens = async (type?: "authentication" | "access" | "all") => {
    setRefreshing(true);
    try {
      const endpoint = type === "all" ? "refresh-all" : `refresh-${type}`;

      const { error } = await supabase.functions.invoke(
        `telenity-token-refresh/${endpoint}`,
        {
          body: {},
        }
      );

      if (error) throw error;

      toast({ title: "Tokens refreshed successfully" });
      fetchTokenStatus();
    } catch (error: any) {
      toast({
        title: "Failed to refresh tokens",
        description: error?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const getTokenStatus = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffMinutes = (expiry.getTime() - now.getTime()) / (1000 * 60);

    if (diffMinutes < 0) {
      return { status: 'expired', variant: 'destructive' as const, icon: XCircle };
    } else if (diffMinutes < 10) {
      return { status: 'expiring', variant: 'secondary' as const, icon: AlertTriangle };
    }
    return { status: 'valid', variant: 'default' as const, icon: CheckCircle };
  };

  const getTokenLabel = (type: string) => {
    switch (type) {
      case 'authentication':
        return 'Telenity Auth Token';
      case 'access':
        return 'Telenity Access Token';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">API Token Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-12 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg">API Token Status</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refreshTokens('all')}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh All
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {tokens.length === 0 ? (
          <p className="text-muted-foreground text-sm">No tokens configured</p>
        ) : (
          tokens.map((token) => {
            const { status, variant, icon: StatusIcon } = getTokenStatus(token.expires_at);
            const expiresIn = formatDistanceToNow(new Date(token.expires_at), { addSuffix: true });

            return (
              <div
                key={token.token_type}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <StatusIcon
                    className={`h-5 w-5 ${
                      status === 'expired' ? 'text-destructive' :
                      status === 'expiring' ? 'text-yellow-500' :
                      'text-green-500'
                    }`}
                  />
                  <div>
                    <p className="font-medium text-sm">{getTokenLabel(token.token_type)}</p>
                    <p className="text-xs text-muted-foreground">
                      {status === 'expired' ? `Expired ${expiresIn}` : `Expires ${expiresIn}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={variant}>
                    {status === 'expired' ? 'Expired' : status === 'expiring' ? 'Expiring Soon' : 'Valid'}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refreshTokens(token.token_type as 'authentication' | 'access')}
                    disabled={refreshing}
                  >
                    <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
