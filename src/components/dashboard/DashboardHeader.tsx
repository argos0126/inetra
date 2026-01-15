import { Calendar } from "lucide-react";
import { format } from "date-fns";

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
}

export function DashboardHeader({ title, subtitle }: DashboardHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
        {subtitle && (
          <p className="text-xs sm:text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center space-x-2">
        <Calendar className="h-4 w-4" />
        <span className="text-xs sm:text-sm text-muted-foreground">
          {format(new Date(), 'MMM d, yyyy')}
        </span>
      </div>
    </div>
  );
}
