import { ReactNode } from "react";

interface SummaryCardProps {
  title: string;
  value: number;
  icon: ReactNode;
  iconColor: string;
}

export function SummaryCard({ title, value, icon, iconColor }: SummaryCardProps) {
  return (
    <div className="bg-card rounded-xl card-shadow p-6 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${iconColor}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-3xl font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}
