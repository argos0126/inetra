import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, CheckCircle, XCircle, RefreshCw, LucideIcon } from "lucide-react";

export interface IntegrationSetting {
  key: string;
  label: string;
  type: "number" | "toggle";
  value: string;
  description?: string;
  suffix?: string;
}

interface IntegrationCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  isEnabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  settings: IntegrationSetting[];
  onSettingChange: (key: string, value: string) => void;
  status?: "connected" | "disconnected" | "error";
  tokenExpiry?: string;
  onRefreshToken?: () => void;
  isRefreshing?: boolean;
}

export function IntegrationCard({
  title,
  description,
  icon: Icon,
  isEnabled,
  onEnabledChange,
  settings,
  onSettingChange,
  status = "connected",
  tokenExpiry,
  onRefreshToken,
  isRefreshing,
}: IntegrationCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getStatusBadge = () => {
    switch (status) {
      case "connected":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        );
      case "disconnected":
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            <XCircle className="h-3 w-3 mr-1" />
            Disconnected
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
    }
  };

  const formatInterval = (seconds: string) => {
    const secs = parseInt(seconds, 10);
    if (secs >= 3600) {
      return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
    } else if (secs >= 60) {
      return `${Math.floor(secs / 60)}m`;
    }
    return `${secs}s`;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    {title}
                    {getStatusBadge()}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Label htmlFor={`enable-${title}`} className="text-sm text-muted-foreground">
                    {isEnabled ? "Enabled" : "Disabled"}
                  </Label>
                  <Switch
                    id={`enable-${title}`}
                    checked={isEnabled}
                    onCheckedChange={onEnabledChange}
                  />
                </div>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 border-t">
            <div className="space-y-4 mt-4">
              {settings.map((setting) => (
                <div key={setting.key} className="space-y-2">
                  {setting.type === "number" ? (
                    <div className="grid grid-cols-2 gap-4 items-center">
                      <div>
                        <Label htmlFor={setting.key}>{setting.label}</Label>
                        {setting.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {setting.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          id={setting.key}
                          type="number"
                          value={setting.value}
                          onChange={(e) => onSettingChange(setting.key, e.target.value)}
                          className="w-24"
                          disabled={!isEnabled}
                        />
                        {setting.suffix && (
                          <span className="text-sm text-muted-foreground whitespace-nowrap">
                            {setting.suffix}
                            {setting.key.includes("Interval") && setting.value && (
                              <span className="ml-1">({formatInterval(setting.value)})</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor={setting.key}>{setting.label}</Label>
                        {setting.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {setting.description}
                          </p>
                        )}
                      </div>
                      <Switch
                        id={setting.key}
                        checked={setting.value === "true"}
                        onCheckedChange={(checked) =>
                          onSettingChange(setting.key, checked ? "true" : "false")
                        }
                        disabled={!isEnabled}
                      />
                    </div>
                  )}
                </div>
              ))}

              {onRefreshToken && (
                <div className="pt-4 border-t flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">API Token</p>
                    {tokenExpiry && (
                      <p className="text-xs text-muted-foreground">Expires: {tokenExpiry}</p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRefreshToken}
                    disabled={isRefreshing || !isEnabled}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                    Refresh Token
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
