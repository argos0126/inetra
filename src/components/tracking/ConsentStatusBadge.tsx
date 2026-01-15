import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, HelpCircle } from "lucide-react";

type ConsentStatus = "pending" | "allowed" | "not_allowed" | "expired" | null;

interface ConsentStatusBadgeProps {
  status: ConsentStatus;
  showIcon?: boolean;
}

const statusConfig = {
  pending: {
    icon: Clock,
    variant: "secondary" as const,
    label: "Consent Pending",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  },
  allowed: {
    icon: CheckCircle,
    variant: "default" as const,
    label: "Consent Granted",
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  not_allowed: {
    icon: XCircle,
    variant: "destructive" as const,
    label: "Consent Denied",
    className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
  expired: {
    icon: XCircle,
    variant: "outline" as const,
    label: "Consent Expired",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  },
};

export function ConsentStatusBadge({ status, showIcon = true }: ConsentStatusBadgeProps) {
  if (!status) {
    return (
      <Badge variant="outline" className="gap-1">
        {showIcon && <HelpCircle className="h-3 w-3" />}
        No Consent
      </Badge>
    );
  }

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  );
}
