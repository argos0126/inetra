import { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
}

export function PageHeader({ title, description, children, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4 sm:mb-6">
      <div className="space-y-0.5 sm:space-y-1 min-w-0">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground truncate">{title}</h1>
        {description && (
          <p className="text-xs sm:text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {(children || action) && (
        <div className="flex items-center space-x-2 flex-shrink-0">
          {children}
          {action && (
            <Button onClick={action.onClick} className="bg-primary hover:bg-primary-hover" size="sm">
              {action.icon && <span className="mr-1 sm:mr-2">{action.icon}</span>}
              <span className="text-sm">{action.label}</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}