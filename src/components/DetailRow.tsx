interface DetailRowProps {
  label: string;
  value: string | number | null | undefined;
  className?: string;
}

export function DetailRow({ label, value, className = "" }: DetailRowProps) {
  return (
    <div className={`flex flex-col space-y-1 ${className}`}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "-"}</span>
    </div>
  );
}
