import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface QuickAction {
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "secondary" | "outline" | "ghost";
}

interface QuickActionCardProps {
  title?: string;
  actions: QuickAction[];
  className?: string;
}

export function QuickActionCard({ title = "Quick Actions", actions, className }: QuickActionCardProps) {
  const navigate = useNavigate();

  const handleAction = (action: QuickAction) => {
    if (action.onClick) {
      action.onClick();
    } else if (action.href) {
      navigate(action.href);
    }
  };

  return (
    <Card className={className}>
      <CardContent className="p-4">
        {title && (
          <h3 className="text-sm font-medium text-muted-foreground mb-3">{title}</h3>
        )}
        <div className="flex flex-wrap gap-2">
          {actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant || "outline"}
              size="sm"
              onClick={() => handleAction(action)}
              className="gap-2"
            >
              <action.icon className="h-4 w-4" />
              {action.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
