import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface StatusToggleProps {
  isActive: boolean;
  onToggle: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export function StatusToggle({ isActive, onToggle, disabled = false, label = "Active Status" }: StatusToggleProps) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
      <div className="space-y-0.5">
        <Label className="text-base font-medium">{label}</Label>
        <p className="text-sm text-muted-foreground">
          {isActive ? "This record is currently active" : "This record is currently inactive"}
        </p>
      </div>
      <Switch
        checked={isActive}
        onCheckedChange={onToggle}
        disabled={disabled}
      />
    </div>
  );
}
