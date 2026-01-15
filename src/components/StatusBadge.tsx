import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
}

export function StatusBadge({ status, variant }: StatusBadgeProps) {
  const getStatusVariant = (status: string) => {
    if (variant) return variant;
    
    switch (status.toLowerCase()) {
      case "active":
      case "available":
      case "delivered":
      case "completed":
      case "approved":
        return "default";
      case "inactive":
      case "unavailable":
      case "pending":
      case "in transit":
      case "loading":
        return "secondary";
      case "maintenance":
      case "delayed":
      case "cancelled":
      case "rejected":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
      case "available":
      case "delivered":
      case "completed":
      case "approved":
        return "bg-green-500 text-white";
      case "in transit":
      case "loading":
        return "bg-blue-500 text-white";
      case "pending":
        return "bg-orange-500 text-white";
      case "maintenance":
      case "delayed":
      case "cancelled":
      case "rejected":
        return "bg-red-500 text-white";
      case "inactive":
      case "unavailable":
        return "bg-gray-500 text-white";
      default:
        return "";
    }
  };

  return (
    <Badge 
      variant={getStatusVariant(status)} 
      className={getStatusColor(status)}
    >
      {status}
    </Badge>
  );
}