import { ReactNode } from "react";

interface SummaryCardProps {
  title: string;
  value: number;
  icon: ReactNode;
  iconColor: string;
  trend?: string;
}

export function SummaryCard({ title, value, icon, iconColor, trend }: SummaryCardProps) {
  return (
    <div className="bg-card rounded-lg border border-border shadow-sm p-3 flex items-center gap-3 transition-all hover:shadow-md">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconColor}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground leading-tight">{title}</p>
        <p className="text-2xl font-heading font-semibold text-foreground leading-tight">{value}</p>
        {trend && (
          <p className="text-xs text-muted-foreground mt-0.5">{trend}</p>
        )}
      </div>
    </div>
  );
}
